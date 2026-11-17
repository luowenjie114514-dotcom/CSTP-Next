/**
 * CSTP Next · 会话导出（浏览器下载版）。
 *
 * 为什么不用后端导出：
 * 后端 /api/sessions/<id>/exports 依赖 puppeteer-core 驱动本机 Edge/Chrome 渲染。
 * 在管理员权限或受限环境下浏览器常启动失败（export_browser_launch_failed），
 * 且导出目录固定、无法让用户选位置。
 *
 * 本实现改为纯前端：
 * 1. GET /api/sessions/<id> 取会话快照；
 * 2. 在页面内生成自包含 HTML（样式内嵌，无外部依赖）；
 * 3. 用 Blob + <a download> 触发下载，由浏览器的「另存为」对话框让用户选路径。
 *
 * 优点：不依赖后端渲染、不需要浏览器子进程、路径由用户决定。
 * 安全：只读 GET，不写任何本地文件，不执行会话内容中的脚本。
 */
(() => {
	const MENU = ".session-menu";
	const ITEM = '[role="menuitem"]';
	const MARK = "data-cstpn-export";
	const ROW = "[data-session-id]";
	const TICK_MS = 400;

	const state = { busy: false, toast: null };

	// ---------------------------------------------------------------- 样式
	function injectStyle() {
		if (document.getElementById("cstpn-export-style")) return;
		const style = document.createElement("style");
		style.id = "cstpn-export-style";
		style.textContent = `
.${MARK}-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147000000;max-width:min(520px,90vw);padding:11px 16px;border-radius:12px;background:rgba(24,29,34,.96);color:#f2f5f7;font-size:13px;line-height:1.55;font-family:inherit;box-shadow:0 12px 32px rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;gap:9px;animation:cstpn-export-in .18s ease}
@keyframes cstpn-export-in{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.${MARK}-toast[data-tone="error"]{background:rgba(122,26,34,.97);border-color:rgba(255,255,255,.16)}
.${MARK}-toast[data-tone="ok"]{background:rgba(22,74,52,.97)}
.${MARK}-spin{width:13px;height:13px;border-radius:50%;border:2px solid rgba(255,255,255,.28);border-top-color:#fff;animation:cstpn-export-spin .8s linear infinite;flex:none}
@keyframes cstpn-export-spin{to{transform:rotate(360deg)}}
`;
		document.head.appendChild(style);
	}

	function toast(message, tone) {
		injectStyle();
		if (!state.toast) {
			const el = document.createElement("div");
			el.className = `${MARK}-toast`;
			el.setAttribute("role", "status");
			el.setAttribute("aria-live", "polite");
			document.body.appendChild(el);
			state.toast = el;
		}
		const el = state.toast;
		el.dataset.tone = tone || "info";
		el.textContent = "";
		if (tone === "info") {
			const spin = document.createElement("span");
			spin.className = `${MARK}-spin`;
			el.appendChild(spin);
		}
		const text = document.createElement("span");
		text.textContent = message;
		el.appendChild(text);
		el.hidden = false;
	}

	function clearToast() {
		if (state.toast) state.toast.hidden = true;
	}

	// ---------------------------------------------------------------- 选中会话
	let lastRow = null;

	function trackContextMenu(event) {
		try {
			lastRow = event.target?.closest?.(ROW) || null;
		} catch {
			lastRow = null;
		}
	}

	function targetSessionIds() {
		const rows = [...document.querySelectorAll(ROW)];
		const selected = rows
			.filter((row) => row.hasAttribute("data-selected") && !row.hasAttribute("data-disabled"))
			.map((row) => row.getAttribute("data-session-id"))
			.filter(Boolean);
		if (selected.length > 0) return [...new Set(selected)];

		const id = lastRow?.getAttribute?.("data-session-id");
		if (id) return [id];

		const active = document.querySelector(`${ROW}[aria-current="page"]`);
		const activeId = active?.getAttribute("data-session-id");
		return activeId ? [activeId] : [];
	}

	// ---------------------------------------------------------------- 取数据
	async function fetchSnapshot(sessionId) {
		const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
			cache: "no-store",
			credentials: "same-origin",
		});
		if (!response.ok) throw new Error(`读取会话失败（HTTP ${response.status}）`);
		return response.json();
	}

	// ---------------------------------------------------------------- 渲染
	function escapeHtml(value) {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;");
	}

	/** 把一条消息的内容拆成可读的纯文本片段（不保留 HTML，避免注入）。 */
	function messageText(message) {
		if (!message) return "";
		const content = message.content;
		if (typeof content === "string") return content;
		if (!Array.isArray(content)) return "";
		const parts = [];
		for (const part of content) {
			if (!part || typeof part !== "object") continue;
			if (part.type === "text" && typeof part.text === "string") parts.push(part.text);
			else if (part.type === "thinking" && typeof part.thinking === "string") parts.push(`〔思考〕\n${part.thinking}`);
			else if (part.type === "toolCall") {
				const name = part.name ?? "tool";
				let args = "";
				try {
					args = JSON.stringify(part.arguments ?? {});
				} catch {
					args = "";
				}
				parts.push(`〔调用 ${name}〕\n${args}`);
			}
		}
		return parts.join("\n\n");
	}

	const ROLE_LABEL = {
		user: "用户",
		assistant: "助手",
		toolResult: "工具结果",
		branchSummary: "分支总结",
	};

	function buildHtml(sessions) {
		const now = new Date();
		const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

		const blocks = sessions
			.map((snapshot) => {
				const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
				const messages = entries
					.map((entry) => entry?.message ?? entry)
					.filter((message) => message && typeof message === "object");

				const title =
					snapshot?.title ||
					messages.find((m) => m.role === "user")?.content?.toString?.().slice(0, 60) ||
					snapshot?.id ||
					"会话";

				const rows = messages
					.map((message) => {
						const role = message.role ?? "unknown";
						const label = ROLE_LABEL[role] ?? role;
						const body = messageText(message).trim();
						if (!body) return "";
						const time = message.timestamp
							? new Date(message.timestamp).toLocaleString("zh-CN")
							: "";
						return `<section class="msg msg-${escapeHtml(role)}">
<header><span class="role">${escapeHtml(label)}</span>${time ? `<time>${escapeHtml(time)}</time>` : ""}</header>
<pre>${escapeHtml(body)}</pre>
</section>`;
					})
					.filter(Boolean)
					.join("\n");

				return `<article class="session">
<h1>${escapeHtml(title)}</h1>
<p class="meta">会话 ID：<code>${escapeHtml(snapshot?.id ?? "")}</code> · 消息 ${messages.length} 条</p>
${rows || '<p class="empty">（无可显示的消息）</p>'}
</article>`;
			})
			.join("\n<hr>\n");

		return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>会话导出 · ${escapeHtml(stamp)}</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;padding:32px 20px 64px;font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.7;background:#fafbfc;color:#1a2024}
@media (prefers-color-scheme:dark){body{background:#16191d;color:#e8ecef}}
main{max-width:860px;margin:0 auto}
h1{font-size:20px;margin:0 0 6px}
.meta{margin:0 0 20px;font-size:12px;opacity:.62}
code{font-size:12px;padding:1px 5px;border-radius:4px;background:rgba(127,127,127,.16)}
.session{margin-bottom:36px}
.msg{margin:0 0 14px;padding:12px 14px;border-radius:10px;border:1px solid rgba(127,127,127,.22)}
.msg-user{background:rgba(59,130,246,.07);border-color:rgba(59,130,246,.28)}
.msg-assistant{background:rgba(127,127,127,.07)}
.msg header{display:flex;gap:10px;align-items:baseline;margin-bottom:6px}
.role{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;opacity:.72}
time{font-size:11px;opacity:.5}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:14px}
.empty{opacity:.6;font-size:13px}
hr{border:none;border-top:1px dashed rgba(127,127,127,.34);margin:34px 0}
footer{margin-top:48px;font-size:11px;opacity:.45;text-align:center}
</style>
</head>
<body>
<main>
${blocks}
<footer>由 CSTP Next 导出 · ${escapeHtml(stamp)}</footer>
</main>
</body>
</html>`;
	}

	// ---------------------------------------------------------------- 下载
	function safeFileName(title) {
		const cleaned = String(title ?? "会话")
			.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
			.replace(/\s+/g, " ")
			.trim();
		const name = Array.from(cleaned).slice(0, 60).join("") || "会话";
		const d = new Date();
		const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
		return `${name}-${stamp}.html`;
	}

	function download(html, filename) {
		const blob = new Blob([html], { type: "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		anchor.rel = "noopener";
		anchor.style.display = "none";
		document.body.appendChild(anchor);
		anchor.click();
		// 下载触发后即可移除；这里只删自己创建的节点，不碰 React 的 DOM。
		window.setTimeout(() => {
			try {
				anchor.remove();
			} catch {
				/* 忽略 */
			}
			URL.revokeObjectURL(url);
		}, 1500);
	}

	// ---------------------------------------------------------------- 主流程
	async function runExport(sessionIds) {
		if (state.busy) return;
		if (!sessionIds || !sessionIds.length) {
			toast("没有可导出的会话", "error");
			window.setTimeout(clearToast, 2600);
			return;
		}
		state.busy = true;
		const total = sessionIds.length;

		try {
			const snapshots = [];
			for (let i = 0; i < sessionIds.length; i += 1) {
				toast(total > 1 ? `正在导出 ${i + 1}/${total}…` : "正在导出会话…", "info");
				snapshots.push(await fetchSnapshot(sessionIds[i]));
			}

			const html = buildHtml(snapshots);
			const first = snapshots[0];
			const title =
				first?.title ||
				(Array.isArray(first?.entries)
					? first.entries.find((e) => e?.message?.role === "user")?.message?.content
					: "") ||
				"会话";
			const filename =
				total > 1 ? `会话导出-${total}个-${safeFileName("").replace(/^会话-/, "")}` : safeFileName(String(title));

			download(html, filename);

			toast(`已导出 ${total} 个会话，请在浏览器保存对话框中确认位置`, "ok");
			window.setTimeout(clearToast, 5000);
		} catch (error) {
			toast(error instanceof Error && error.message ? error.message : "导出失败，请重试", "error");
			window.setTimeout(clearToast, 6000);
		} finally {
			state.busy = false;
		}
	}

	// ---------------------------------------------------------------- 菜单
	function icon() {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		svg.setAttribute("width", "18");
		svg.setAttribute("height", "18");
		svg.setAttribute("viewBox", "0 0 24 24");
		svg.setAttribute("fill", "none");
		svg.setAttribute("stroke", "currentColor");
		svg.setAttribute("stroke-width", "2");
		svg.setAttribute("stroke-linecap", "round");
		svg.setAttribute("stroke-linejoin", "round");
		svg.setAttribute("aria-hidden", "true");
		for (const d of ["M12 3v10", "M8 9l4 4 4-4", "M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"]) {
			const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
			path.setAttribute("d", d);
			svg.appendChild(path);
		}
		return svg;
	}

	function buildItem(menu) {
		const button = document.createElement("button");
		button.type = "button";
		button.setAttribute("role", "menuitem");
		button.className = "sidebar-account-item";
		button.setAttribute(MARK, "");
		button.appendChild(icon());
		button.appendChild(document.createTextNode("导出（CSTP Next）"));
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const ids = targetSessionIds();
			// 不手动关闭菜单：节点归 React 所有，remove() 会导致 removeChild 崩溃。
			void runExport(ids);
		});
		return button;
	}

	function ensureMenu() {
		const menu = document.querySelector(MENU);
		if (!menu) return;
		if (menu.querySelector(`[${MARK}]`)) return;
		injectStyle();
		const item = buildItem(menu);
		const divider = menu.querySelector(".session-menu-divider");
		if (divider) {
			menu.insertBefore(item, divider);
		} else {
			const del = menu.querySelector(`${ITEM}.sidebar-menu-delete`);
			if (del) menu.insertBefore(item, del);
			else menu.appendChild(item);
		}
	}

	function tick() {
		try {
			ensureMenu();
		} catch {
			/* 静默跳过 */
		}
	}

	window.__cstpnExport = { runExport, targetSessionIds, buildHtml };

	document.addEventListener("contextmenu", trackContextMenu, true);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
