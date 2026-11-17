/**
 * CSTP Next · 会话导出（浏览器下载版 + 导出选项页接管）。
 *
 * 两处生效：
 * 1. 会话右键菜单新增「导出 html（CSTP Next）」—— 快捷导出，直接下载。
 * 2. /s/<id>/export 导出页 —— 接管原「导出选项」面板，保留原有选项
 *    （格式 / 主题 / 包含思考过程 / 包含工具调用结果），
 *    但「生成并保存」改为浏览器下载，由用户选择保存位置。
 *
 * 为什么接管后端导出：
 * 后端 /api/sessions/<id>/exports 依赖 puppeteer-core 驱动本机 Edge/Chrome。
 * 管理员权限或受限环境下常报 export_browser_launch_failed；
 * 且导出目录固定为 artifacts/<日期>/sessions/，用户无法选择位置。
 *
 * 本实现：GET /api/sessions/<id> 取快照 → 页面内生成自包含 HTML →
 * Blob + <a download> 触发浏览器「另存为」。
 *
 * 安全：只读 GET；内容全部 HTML 转义；不删除任何 React 管理的 DOM 节点。
 */
(() => {
	const MENU = ".session-menu";
	const ITEM = '[role="menuitem"]';
	const MARK = "data-cstpn-export";
	const ROW = "[data-session-id]";
	const TICK_MS = 400;

	// 导出页选择器
	const EXPORT_PAGE = "main.export-workspace";
	const EXPORT_FIELDSET = ".export-controls fieldset";
	const TAKEN = "data-cstpn-taken";

	const state = { busy: false, toast: null };

	const options = {
		format: "html",
		theme: "dark",
		includeThinking: false,
		includeTools: false,
	};

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
.${MARK}-badge{font-weight:400;opacity:.62;font-size:.78em;margin-left:.4em}
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

	function messageText(message, opts) {
		if (!message) return "";
		const content = message.content;
		if (typeof content === "string") return content;
		if (!Array.isArray(content)) return "";
		const parts = [];
		for (const part of content) {
			if (!part || typeof part !== "object") continue;
			if (part.type === "text" && typeof part.text === "string") {
				parts.push(part.text);
			} else if (part.type === "thinking" && typeof part.thinking === "string") {
				if (opts.includeThinking) parts.push(`〔思考〕\n${part.thinking}`);
			} else if (part.type === "toolCall") {
				if (!opts.includeTools) continue;
				const name = part.name ?? "tool";
				let args = "";
				try {
					args = JSON.stringify(part.arguments ?? {}, null, 2);
				} catch {
					args = "";
				}
				parts.push(`〔调用 ${name}〕\n${args}`);
			}
		}
		return parts.join("\n\n");
	}

	const LIGHT = {
		bodyBg: "#fafbfc",
		bodyInk: "#1a2024",
		userBg: "rgba(59,130,246,.07)",
		userBorder: "rgba(59,130,246,.28)",
		asstBg: "rgba(127,127,127,.07)",
		cardBorder: "rgba(127,127,127,.22)",
		codeBg: "rgba(127,127,127,.16)",
		hr: "rgba(127,127,127,.34)",
	};
	const DARK = {
		bodyBg: "#16191d",
		bodyInk: "#e8ecef",
		userBg: "rgba(96,165,250,.10)",
		userBorder: "rgba(96,165,250,.34)",
		asstBg: "rgba(148,163,184,.08)",
		cardBorder: "rgba(148,163,184,.20)",
		codeBg: "rgba(148,163,184,.18)",
		hr: "rgba(148,163,184,.28)",
	};

	const ROLE_LABEL = {
		user: "用户",
		assistant: "助手",
		toolResult: "工具结果",
		branchSummary: "分支总结",
	};

	function buildHtml(sessions, opts) {
		const t = opts.theme === "light" ? LIGHT : DARK;
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
					messages.find((m) => typeof m.content === "string")?.content?.slice(0, 60) ||
					snapshot?.id ||
					"会话";

				const rows = messages
					.map((message) => {
						const role = message.role ?? "unknown";
						const label = ROLE_LABEL[role] ?? role;
						const body = messageText(message, opts).trim();
						if (!body) return "";
						const time = message.timestamp ? new Date(message.timestamp).toLocaleString("zh-CN") : "";
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
*{box-sizing:border-box}
body{margin:0;padding:32px 20px 64px;font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;line-height:1.7;background:${t.bodyBg};color:${t.bodyInk}}
main{max-width:860px;margin:0 auto}
h1{font-size:20px;margin:0 0 6px}
.meta{margin:0 0 20px;font-size:12px;opacity:.62}
code{font-size:12px;padding:1px 5px;border-radius:4px;background:${t.codeBg}}
.session{margin-bottom:36px}
.msg{margin:0 0 14px;padding:12px 14px;border-radius:10px;border:1px solid ${t.cardBorder};background:${t.asstBg}}
.msg-user{background:${t.userBg};border-color:${t.userBorder}}
.msg header{display:flex;gap:10px;align-items:baseline;margin-bottom:6px}
.role{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;opacity:.72}
time{font-size:11px;opacity:.5}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:inherit;font-size:14px}
.empty{opacity:.6;font-size:13px}
hr{border:none;border-top:1px dashed ${t.hr};margin:34px 0}
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
		return `${name}-${stamp}`;
	}

	function download(content, filename, mime) {
		const blob = new Blob([content], { type: mime || "text/html;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");
		anchor.href = url;
		anchor.download = filename;
		anchor.rel = "noopener";
		anchor.style.display = "none";
		document.body.appendChild(anchor);
		anchor.click();
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
	async function runExport(sessionIds, opts) {
		if (state.busy) return;
		if (!sessionIds || !sessionIds.length) {
			toast("没有可导出的会话", "error");
			window.setTimeout(clearToast, 2600);
			return;
		}
		state.busy = true;
		const total = sessionIds.length;
		const useOpts = { ...options, ...(opts || {}) };

		try {
			const snapshots = [];
			for (let i = 0; i < sessionIds.length; i += 1) {
				toast(total > 1 ? `正在导出 ${i + 1}/${total}…` : "正在导出会话…", "info");
				snapshots.push(await fetchSnapshot(sessionIds[i]));
			}

			const first = snapshots[0];
			const title =
				first?.title ||
				(Array.isArray(first?.entries)
					? first.entries.find((e) => e?.message?.role === "user")?.message?.content
					: "") ||
				"会话";
			const base = safeFileName(String(title));

			let content;
			let extension;
			let mime;
			if (useOpts.format === "json") {
				const payload = snapshots.map((snapshot) => ({
					id: snapshot?.id,
					title: snapshot?.title,
					exportedAt: new Date().toISOString(),
					options: {
						includeThinking: useOpts.includeThinking,
						includeTools: useOpts.includeTools,
					},
					messages: (Array.isArray(snapshot?.entries) ? snapshot.entries : [])
						.map((entry) => entry?.message ?? entry)
						.filter((m) => m && typeof m === "object")
						.map((m) => {
							const text = messageText(m, useOpts).trim();
							return { role: m.role, timestamp: m.timestamp ?? null, content: text };
						})
						.filter((m) => m.content),
				}));
				content = JSON.stringify(total > 1 ? payload : payload[0], null, 2);
				extension = "json";
				mime = "application/json;charset=utf-8";
			} else {
				content = buildHtml(snapshots, useOpts);
				extension = "html";
				mime = "text/html;charset=utf-8";
			}

			const filename =
				total > 1
					? `会话导出-${total}个-${base.replace(/^[^-]*-/, "")}.${extension}`
					: `${base}.${extension}`;

			download(content, filename, mime);
			toast(`已导出 ${total} 个会话，请在浏览器保存对话框中确认位置`, "ok");
			window.setTimeout(clearToast, 5000);
		} catch (error) {
			toast(error instanceof Error && error.message ? error.message : "导出失败，请重试", "error");
			window.setTimeout(clearToast, 6000);
		} finally {
			state.busy = false;
		}
	}

	// ---------------------------------------------------------------- 右键菜单
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
		button.appendChild(document.createTextNode("导出 html（CSTP Next）"));
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const ids = targetSessionIds();
			void runExport(ids, options);
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

	// ---------------------------------------------------------------- 导出页接管
	function fieldRow(labelText, node) {
		const wrap = document.createElement("div");
		wrap.className = "cstpn-field";
		const label = document.createElement("span");
		label.className = "cstpn-field-label";
		label.textContent = labelText;
		wrap.append(label, node);
		return wrap;
	}

	function segmented(name, items, value, onChange) {
		const group = document.createElement("div");
		group.className = "cstpn-segmented";
		group.setAttribute("role", "radiogroup");
		group.setAttribute("aria-label", name);
		const buttons = [];
		for (const item of items) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "cstpn-seg";
			b.textContent = item.label;
			b.dataset.value = item.id;
			b.setAttribute("role", "radio");
			b.addEventListener("click", () => {
				for (const x of buttons) {
					x.dataset.active = x === b ? "true" : "false";
					x.setAttribute("aria-checked", x === b ? "true" : "false");
				}
				onChange(item.id);
			});
			buttons.push(b);
			group.appendChild(b);
		}
		for (const b of buttons) {
			b.dataset.active = b.dataset.value === value ? "true" : "false";
			b.setAttribute("aria-checked", b.dataset.active === "true" ? "true" : "false");
		}
		return group;
	}

	function checkbox(labelText, checked, onChange) {
		const label = document.createElement("label");
		label.className = "cstpn-check";
		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = checked;
		input.addEventListener("change", () => onChange(input.checked));
		const span = document.createElement("span");
		span.textContent = labelText;
		label.append(input, span);
		return label;
	}

	function injectPageStyle() {
		if (document.getElementById("cstpn-page-style")) return;
		const style = document.createElement("style");
		style.id = "cstpn-page-style";
		style.textContent = `
.cstpn-panel{display:grid;gap:var(--space-group,16px)}
.cstpn-field{display:grid;gap:6px;font-size:var(--font-ui,13px);line-height:var(--line-ui,1.5)}
.cstpn-field-label{font-weight:600;opacity:.78}
.cstpn-segmented{display:inline-flex;padding:3px;border-radius:10px;background:rgba(127,127,127,.13);gap:2px}
.cstpn-seg{border:none;background:transparent;color:inherit;font:inherit;font-size:var(--font-ui,13px);padding:6px 14px;border-radius:8px;cursor:pointer;opacity:.72}
.cstpn-seg[data-active="true"]{background:rgba(127,127,127,.28);opacity:1;font-weight:600}
.cstpn-seg:hover{opacity:1}
.cstpn-check{display:flex;align-items:center;gap:8px;font-size:var(--font-ui,13px);cursor:pointer}
.cstpn-check input{margin:0;cursor:pointer}
.cstpn-generate{justify-self:start;align-items:center;gap:var(--space-inline,8px);min-height:var(--control-field,38px);padding:10px var(--space-section,20px);border:none;border-radius:var(--radius-control,10px);color:var(--app-send-icon,#fff);background:var(--app-send,#1a2024);font-size:var(--font-ui,13px);font-weight:600;display:inline-flex;cursor:pointer;font-family:inherit}
.cstpn-generate:disabled{opacity:.6;cursor:default}
.cstpn-note{font-size:var(--font-ui,13px);color:var(--chat-muted,#6b7280);margin:0}
.${MARK}-badge{font-weight:400;opacity:.6;font-size:.8em;margin-left:.4em}
`;
		document.head.appendChild(style);
	}

	/** 接管导出页的「导出选项」面板。 */
	function ensureExportPage() {
		const main = document.querySelector(EXPORT_PAGE);
		if (!main) return;

		// 1) 标题加 (CSTP Next) 标识
		const h1 = main.querySelector(".export-toolbar h1");
		if (h1 && !h1.querySelector(`.${MARK}-badge`)) {
			injectStyle();
			const badge = document.createElement("span");
			badge.className = `${MARK}-badge`;
			badge.textContent = "（CSTP Next）";
			h1.appendChild(badge);
		}

		// 2) 接管导出选项面板
		const fieldset = main.querySelector(EXPORT_FIELDSET);
		if (!fieldset || fieldset.hasAttribute(TAKEN)) return;

		injectPageStyle();
		fieldset.setAttribute(TAKEN, "");
		// 保留 legend 文案，清空其余内容（原按钮与复选框都替换掉）
		const legend = fieldset.querySelector("legend");
		const legendText = legend?.textContent ?? "导出选项";
		while (fieldset.firstChild) fieldset.removeChild(fieldset.firstChild);

		const legendEl = document.createElement("legend");
		legendEl.textContent = legendText;
		fieldset.appendChild(legendEl);

		const panel = document.createElement("div");
		panel.className = "cstpn-panel";

		const sessionId = /\/s\/([a-zA-Z0-9_-]+)\/export/.exec(location.pathname)?.[1] ?? "";

		panel.appendChild(
			fieldRow(
				"格式",
				segmented(
					"格式",
					[
						{ id: "html", label: "离线 HTML" },
						{ id: "json", label: "JSON 数据" },
					],
					options.format,
					(value) => {
						options.format = value;
					},
				),
			),
		);

		panel.appendChild(
			fieldRow(
				"主题",
				segmented(
					"主题",
					[
						{ id: "light", label: "日间" },
						{ id: "dark", label: "夜间" },
					],
					options.theme,
					(value) => {
						options.theme = value;
					},
				),
			),
		);

		panel.appendChild(
			checkbox("包含思考过程", options.includeThinking, (v) => {
				options.includeThinking = v;
			}),
		);
		panel.appendChild(
			checkbox("包含工具调用结果", options.includeTools, (v) => {
				options.includeTools = v;
			}),
		);

		const button = document.createElement("button");
		button.type = "button";
		button.className = "cstpn-generate";
		button.textContent = "导出并下载";
		button.addEventListener("click", () => {
			if (!sessionId) {
				toast("未能识别会话 ID", "error");
				window.setTimeout(clearToast, 3000);
				return;
			}
			void runExport([sessionId], { ...options });
		});
		panel.appendChild(button);

		const note = document.createElement("p");
		note.className = "cstpn-note";
		note.textContent = "由浏览器下载保存，可在保存对话框中选择位置。";
		panel.appendChild(note);

		fieldset.appendChild(panel);
	}

	// ---------------------------------------------------------------- 调度
	function tick() {
		try {
			ensureMenu();
			ensureExportPage();
		} catch {
			/* 静默跳过 */
		}
	}

	window.__cstpnExport = { runExport, targetSessionIds, buildHtml, options };

	document.addEventListener("contextmenu", trackContextMenu, true);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
