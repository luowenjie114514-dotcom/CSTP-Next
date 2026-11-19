/**
 * CSTP Next · 会话导出（浏览器下载版 + 导出选项页接管）。
 *
 * 两处生效：
 * 1. 会话右键菜单「导出（CSTP Next）」
 *    - 单选：跳转 /s/<id>/export
 *    - 多选：多文件导出（每个会话一个文件）
 * 2. /s/<id>/export 导出页
 *    - 标题加「（CSTP Next）」标识
 *    - 接管「导出选项」面板：保留原生三项（PNG / 离线 HTML / JSON 追加）、
 *      主题、两个勾选项，**沿用原生下拉选择器的交互形态**
 *    - 按钮改为「导出并下载」，走浏览器下载
 *
 * 与原生对齐的要点（依据 export-PIXoPwsY.js 实测）：
 *   - 原生格式项：{ id:"png", label:"PNG 图片" }, { id:"html", label:"离线 HTML" }
 *   - 原生主题项：{ id:"light", label:"日间" }, { id:"dark", label:"夜间" }
 *   - 原生控件 T 是下拉选择器：export-select / export-select-trigger /
 *     export-select-popover，点击展开候选列表 —— 不能用平铺按钮替代
 *   - 原生默认 format = "png"，theme 跟随页面
 *
 * 实现约束（踩过的坑）：
 *   - 不删除 React 节点；功能保障用 document 上的 capture 阶段 click 拦截
 *   - DOM 改写只做视觉，MutationObserver 立即补回
 */
(() => {
	const MENU = ".session-menu";
	const ITEM = '[role="menuitem"]';
	const MARK = "data-cstpn-export";
	const ROW = "[data-session-id]";
	const TICK_MS = 300;

	const EXPORT_PAGE = "main.export-workspace";
	const EXPORT_FIELDSET = ".export-controls fieldset";
	const TAKEN = "data-cstpn-taken";

	const state = { busy: false, toast: null };

	/** 与原生默认值保持一致：格式默认 PNG。 */
	const options = {
		format: "png",
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

	function injectPageStyle() {
		if (document.getElementById("cstpn-page-style")) return;
		const style = document.createElement("style");
		style.id = "cstpn-page-style";
		style.textContent = `
/* 下拉选择器：复刻原生 export-select 的形态 */
.cstpn-field{display:grid;gap:6px;font-size:var(--font-ui,13px);line-height:var(--line-ui,1.5)}
.cstpn-field-label{font-weight:600;opacity:.78}
.cstpn-select{position:relative;display:block}
.cstpn-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;box-sizing:border-box;width:100%;min-height:var(--control-field,38px);padding:8px 11px;border-radius:var(--radius-control,10px);border:1px solid var(--chat-border,rgba(127,127,127,.34));background:transparent;color:inherit;font:inherit;font-size:var(--font-ui,13px);cursor:pointer;text-align:left}
.cstpn-select-trigger:hover{border-color:var(--app-send,rgba(127,127,127,.62))}
.cstpn-select-trigger .chev{flex:none;opacity:.6;transition:transform .16s ease}
.cstpn-select[data-open="true"] .chev{transform:rotate(180deg)}
.cstpn-select-popover{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:30;padding:4px;border-radius:10px;border:1px solid var(--chat-border,rgba(127,127,127,.34));background:var(--chat-bg,#1c1f24);box-shadow:0 12px 30px rgba(0,0,0,.34);max-height:240px;overflow:auto}
.cstpn-select-popover[hidden]{display:none}
.cstpn-select-item{display:block;width:100%;box-sizing:border-box;padding:8px 10px;border:none;border-radius:7px;background:transparent;color:inherit;font:inherit;font-size:var(--font-ui,13px);text-align:left;cursor:pointer}
.cstpn-select-item:hover{background:rgba(127,127,127,.16)}
.cstpn-select-item[data-selected="true"]{background:rgba(127,127,127,.24);font-weight:600}
.cstpn-batch-overlay{position:fixed;inset:0;z-index:2147000000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.52);padding:20px}
.cstpn-batch-card{box-sizing:border-box;width:min(380px,100%);display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:14px;background:#1c1f24;color:#e8ecef;box-shadow:0 18px 48px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);font-family:inherit}
.cstpn-batch-title{margin:0;font-size:15px;font-weight:600}
.cstpn-batch-sub{margin:0;font-size:12px;opacity:.6}
.cstpn-batch-row{display:flex;align-items:center;gap:12px}
.cstpn-batch-row>span{flex:none;width:40px;font-size:13px;opacity:.75}
.cstpn-batch-opts{display:flex;gap:6px;flex-wrap:wrap}
.cstpn-batch-opt{padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.16);background:transparent;color:inherit;font-size:12px;cursor:pointer;font-family:inherit}
.cstpn-batch-opt[data-on="1"]{background:var(--app-send,#8ab4f8);border-color:transparent;color:#14181d;font-weight:600}
.cstpn-batch-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}
.cstpn-batch-btn{padding:8px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:transparent;color:inherit;font-size:13px;cursor:pointer;font-family:inherit}
.cstpn-batch-go{background:var(--app-send,#8ab4f8);border-color:transparent;color:#14181d;font-weight:600}
.cstpn-check{display:flex;align-items:center;gap:8px;font-size:var(--font-ui,13px);cursor:pointer}
.cstpn-check input{margin:0;cursor:pointer}
.cstpn-note{font-size:var(--font-ui,13px);color:var(--chat-muted,#6b7280);margin:0}
`;
		document.head.appendChild(style);
	}

	function toast(message, tone, holdMs) {
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
		if (holdMs) window.setTimeout(clearToast, holdMs);
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
				let args = "";
				try {
					args = JSON.stringify(part.arguments ?? {}, null, 2);
				} catch {
					args = "";
				}
				parts.push(`〔调用 ${part.name ?? "tool"}〕\n${args}`);
			}
		}
		return parts.join("\n\n");
	}

	const THEMES = {
		light: {
			bodyBg: "#fafbfc", bodyInk: "#1a2024",
			userBg: "rgba(59,130,246,.07)", userBorder: "rgba(59,130,246,.28)",
			asstBg: "rgba(127,127,127,.07)", cardBorder: "rgba(127,127,127,.22)",
			codeBg: "rgba(127,127,127,.16)", hr: "rgba(127,127,127,.34)",
		},
		dark: {
			bodyBg: "#16191d", bodyInk: "#e8ecef",
			userBg: "rgba(96,165,250,.10)", userBorder: "rgba(96,165,250,.34)",
			asstBg: "rgba(148,163,184,.08)", cardBorder: "rgba(148,163,184,.20)",
			codeBg: "rgba(148,163,184,.18)", hr: "rgba(148,163,184,.28)",
		},
	};

	const ROLE_LABEL = {
		user: "用户", assistant: "助手", toolResult: "工具结果", branchSummary: "分支总结",
	};

	function buildHtml(sessions, opts) {
		const t = THEMES[opts.theme === "light" ? "light" : "dark"];
		const now = new Date();
		const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

		const blocks = sessions
			.map((snapshot) => {
				const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
				const messages = entries.map((e) => e?.message ?? e).filter((m) => m && typeof m === "object");
				const title =
					snapshot?.title ||
					messages.find((m) => typeof m.content === "string")?.content?.slice(0, 60) ||
					snapshot?.id ||
					"会话";

				const rows = messages
					.map((message) => {
						const role = message.role ?? "unknown";
						const body = messageText(message, opts).trim();
						if (!body) return "";
						const time = message.timestamp ? new Date(message.timestamp).toLocaleString("zh-CN") : "";
						return `<section class="msg msg-${escapeHtml(role)}">
<header><span class="role">${escapeHtml(ROLE_LABEL[role] ?? role)}</span>${time ? `<time>${escapeHtml(time)}</time>` : ""}</header>
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

	function buildJson(snapshots, opts) {
		return JSON.stringify(
			snapshots.map((snapshot) => ({
				id: snapshot?.id,
				title: snapshot?.title,
				exportedAt: new Date().toISOString(),
				options: { includeThinking: opts.includeThinking, includeTools: opts.includeTools },
				messages: (Array.isArray(snapshot?.entries) ? snapshot.entries : [])
					.map((e) => e?.message ?? e)
					.filter((m) => m && typeof m === "object")
					.map((m) => ({
						role: m.role,
						timestamp: m.timestamp ?? null,
						content: messageText(m, opts).trim(),
					}))
					.filter((m) => m.content),
			})),
			null,
			2,
		);
	}

	// ---------------------------------------------------------------- 下载
	function fileBase(title) {
		const cleaned = String(title ?? "会话")
			.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
			.replace(/\s+/g, " ")
			.trim();
		const name = Array.from(cleaned).slice(0, 60).join("") || "会话";
		const d = new Date();
		const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}${String(d.getSeconds()).padStart(2, "0")}`;
		return `${name}-${stamp}`;
	}

	function saveFile(content, filename, mime) {
		const blob = new Blob([content], { type: mime || "application/octet-stream" });
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
		}, 2000);
	}

	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

	function titleOf(snapshot) {
		const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
		const firstUser = entries
			.map((e) => e?.message ?? e)
			.find((m) => m?.role === "user" && typeof m?.content === "string");
		return snapshot?.title || firstUser?.content?.slice(0, 60) || snapshot?.id || "会话";
	}

	/**
	 * PNG 导出：用 canvas 把会话渲染成长图。
	 * 这是纯前端实现，不依赖后端 puppeteer。
	 */
	async function buildPng(snapshot, opts) {
		const t = THEMES[opts.theme === "light" ? "light" : "dark"];
		const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
		const messages = entries
			.map((e) => e?.message ?? e)
			.filter((m) => m && typeof m === "object")
			.map((m) => ({ role: m.role ?? "unknown", text: messageText(m, opts).trim() }))
			.filter((m) => m.text);
		if (!messages.length) throw new Error("没有可渲染的消息");

		const WIDTH = 1000;
		const PAD = 40;
		const innerW = WIDTH - PAD * 2;
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		const font = '16px system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
		const titleFont = 'bold 26px system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';
		const metaFont = '13px system-ui, -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif';

		// 逐行折行，先算高度
		function wrap(text, maxW, f) {
			ctx.font = f;
			const out = [];
			for (const raw of String(text).split("\n")) {
				if (!raw) {
					out.push("");
					continue;
				}
				let line = "";
				for (const ch of raw) {
					const test = line + ch;
					if (ctx.measureText(test).width > maxW && line) {
						out.push(line);
						line = ch;
					} else {
						line = test;
					}
				}
				if (line) out.push(line);
			}
			return out;
		}

		const LINE = 24;
		const blocks = [];
		let totalH = PAD + 44; // 标题
		for (const m of messages) {
			const lines = wrap(m.text, innerW - 28, font);
			const h = 34 + lines.length * LINE + 18;
			blocks.push({ role: m.role, lines, h });
			totalH += h + 12;
		}
		totalH += PAD + 20;

		canvas.width = WIDTH;
		canvas.height = Math.min(Math.max(totalH, 240), 20000);

		ctx.fillStyle = t.bodyBg;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		let y = PAD;
		ctx.fillStyle = t.bodyInk;
		ctx.font = titleFont;
		ctx.fillText(titleOf(snapshot).slice(0, 60), PAD, y + 22);
		y += 22;
		ctx.font = metaFont;
		ctx.globalAlpha = 0.6;
		ctx.fillText(`会话 ID：${snapshot?.id ?? ""}`, PAD, y + 20);
		ctx.globalAlpha = 1;
		y += 44;

		for (const b of blocks) {
			const isUser = b.role === "user";
			ctx.fillStyle = isUser ? t.userBg : t.asstBg;
			const rx = PAD;
			const rw = WIDTH - PAD * 2;
			// 圆角矩形
			const r = 10;
			ctx.beginPath();
			ctx.moveTo(rx + r, y);
			ctx.arcTo(rx + rw, y, rx + rw, y + b.h, r);
			ctx.arcTo(rx + rw, y + b.h, rx, y + b.h, r);
			ctx.arcTo(rx, y + b.h, rx, y, r);
			ctx.arcTo(rx, y, rx + rw, y, r);
			ctx.closePath();
			ctx.fill();

			ctx.fillStyle = t.bodyInk;
			ctx.globalAlpha = 0.62;
			ctx.font = metaFont;
			ctx.fillText(ROLE_LABEL[b.role] ?? b.role, rx + 14, y + 22);
			ctx.globalAlpha = 1;
			ctx.font = font;
			let ly = y + 34;
			for (const line of b.lines) {
				ly += LINE;
				ctx.fillText(line, rx + 14, ly);
			}
			y += b.h + 12;
		}

		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (blob) resolve(blob);
				else reject(new Error("PNG 生成失败"));
			}, "image/png");
		});
	}

	function saveBlob(blob, filename) {
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
		}, 2000);
	}

	// ---------------------------------------------------------------- 主流程
	async function runExport(sessionIds, opts) {
		if (state.busy) return;
		if (!sessionIds || !sessionIds.length) {
			toast("没有可导出的会话", "error", 2600);
			return;
		}
		state.busy = true;
		const useOpts = { ...options, ...(opts || {}) };
		const total = sessionIds.length;

		try {
			for (let i = 0; i < total; i += 1) {
				toast(total > 1 ? `正在导出 ${i + 1}/${total}…` : "正在导出…", "info");
				const snapshot = await fetchSnapshot(sessionIds[i]);
				const base = fileBase(titleOf(snapshot));

				if (useOpts.format === "png") {
					const blob = await buildPng(snapshot, useOpts);
					saveBlob(blob, `${base}.png`);
				} else if (useOpts.format === "json") {
					saveFile(buildJson([snapshot], useOpts), `${base}.json`, "application/json;charset=utf-8");
				} else {
					saveFile(buildHtml([snapshot], useOpts), `${base}.html`, "text/html;charset=utf-8");
				}

				if (i < total - 1) await sleep(700);
			}
			toast(`已导出 ${total} 个文件，请在浏览器保存对话框中确认位置`, "ok", 5000);
		} catch (error) {
			toast(error instanceof Error && error.message ? error.message : "导出失败，请重试", "error", 6000);
		} finally {
			state.busy = false;
		}
	}

	// ---------------------------------------------------------------- 右键菜单
	function icon() {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		for (const [k, v] of Object.entries({
			width: "18", height: "18", viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
			"stroke-linejoin": "round", "aria-hidden": "true",
		})) svg.setAttribute(k, v);
		for (const d of ["M12 3v10", "M8 9l4 4 4-4", "M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"]) {
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.setAttribute("d", d);
			svg.appendChild(p);
		}
		return svg;
	}

	// ---------------------------------------------------------------- 批量导出对话框
	/**
	 * 多选导出：先让用户选格式/主题/选项，再逐个下载。
	 * 之前直接 runExport(ids, options) 会以默认 png 立刻开始下载，没有选择机会。
	 */
	function openBatchDialog(ids) {
		const existing = document.querySelector('[data-cstpn-batch]');
		if (existing) existing.remove();

		injectStyle();
		const overlay = document.createElement("div");
		overlay.className = "cstpn-batch-overlay";
		overlay.setAttribute("data-cstpn-batch", "");

		const card = document.createElement("div");
		card.className = "cstpn-batch-card";

		const title = document.createElement("h3");
		title.className = "cstpn-batch-title";
		title.textContent = `批量导出（CSTP Next）· ${ids.length} 个会话`;

		const sub = document.createElement("p");
		sub.className = "cstpn-batch-sub";
		sub.textContent = "每个会话单独生成一个文件";

		// 格式
		const fmtRow = document.createElement("div");
		fmtRow.className = "cstpn-batch-row";
		const fmtLabel = document.createElement("span");
		fmtLabel.textContent = "格式";
		const fmtGroup = document.createElement("div");
		fmtGroup.className = "cstpn-batch-opts";
		const fmtState = { value: options.format || "png" };
		for (const [key, label] of [["png", "PNG 图片"], ["html", "离线 HTML"], ["json", "JSON 数据"]]) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "cstpn-batch-opt";
			b.textContent = label;
			if (key === fmtState.value) b.setAttribute("data-on", "1");
			b.addEventListener("click", () => {
				fmtState.value = key;
				[...fmtGroup.children].forEach((x) => x.removeAttribute("data-on"));
				b.setAttribute("data-on", "1");
			});
			fmtGroup.appendChild(b);
		}
		fmtRow.append(fmtLabel, fmtGroup);

		// 主题
		const themeRow = document.createElement("div");
		themeRow.className = "cstpn-batch-row";
		const themeLabel = document.createElement("span");
		themeLabel.textContent = "主题";
		const themeGroup = document.createElement("div");
		themeGroup.className = "cstpn-batch-opts";
		const themeState = { value: options.theme || "dark" };
		for (const [key, label] of [["dark", "夜间"], ["light", "日间"]]) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "cstpn-batch-opt";
			b.textContent = label;
			if (key === themeState.value) b.setAttribute("data-on", "1");
			b.addEventListener("click", () => {
				themeState.value = key;
				[...themeGroup.children].forEach((x) => x.removeAttribute("data-on"));
				b.setAttribute("data-on", "1");
			});
			themeGroup.appendChild(b);
		}
		themeRow.append(themeLabel, themeGroup);

		// 页脚
		const foot = document.createElement("div");
		foot.className = "cstpn-batch-foot";

		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.className = "cstpn-batch-btn";
		cancel.textContent = "取消";
		cancel.addEventListener("click", () => overlay.remove());

		const go = document.createElement("button");
		go.type = "button";
		go.className = "cstpn-batch-btn cstpn-batch-go";
		go.textContent = "开始导出";
		go.addEventListener("click", () => {
			overlay.remove();
			void runExport(ids, { ...options, format: fmtState.value, theme: themeState.value });
		});

		foot.append(cancel, go);
		card.append(title, sub, fmtRow, themeRow, foot);
		overlay.appendChild(card);

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) overlay.remove();
		});
		const onKey = (e) => {
			if (e.key === "Escape") {
				overlay.remove();
				document.removeEventListener("keydown", onKey, true);
			}
		};
		document.addEventListener("keydown", onKey, true);

		document.body.appendChild(overlay);
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
			if (ids.length === 1) {
				// 单个：进导出选项页
				location.assign(`/s/${encodeURIComponent(ids[0])}/export`);
			} else if (ids.length > 1) {
				// 多个：同样先弹选项面板，不直接下载
				openBatchDialog(ids);
			} else {
				toast("没有识别到会话", "error", 2600);
			}
		});
		return button;
	}

	function ensureMenu() {
		const menu = document.querySelector(MENU);
		if (!menu || menu.querySelector(`[${MARK}]`)) return;
		injectStyle();
		const item = buildItem(menu);
		const divider = menu.querySelector(".session-menu-divider");
		if (divider) menu.insertBefore(item, divider);
		else {
			const del = menu.querySelector(`${ITEM}.sidebar-menu-delete`);
			if (del) menu.insertBefore(item, del);
			else menu.appendChild(item);
		}
	}

	// ---------------------------------------------------------------- 导出页接管
	/** 下拉选择器：与原生 export-select 交互一致（点击展开候选）。 */
	function selectField(labelText, items, value, onChange) {
		const wrap = document.createElement("div");
		wrap.className = "cstpn-field";

		const label = document.createElement("span");
		label.className = "cstpn-field-label";
		label.textContent = labelText;

		const box = document.createElement("div");
		box.className = "cstpn-select";
		box.dataset.open = "false";

		const trigger = document.createElement("button");
		trigger.type = "button";
		trigger.className = "cstpn-select-trigger";

		const text = document.createElement("span");
		text.textContent = items.find((i) => i.id === value)?.label ?? "";

		const chev = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		chev.setAttribute("class", "chev");
		chev.setAttribute("width", "16");
		chev.setAttribute("height", "16");
		chev.setAttribute("viewBox", "0 0 24 24");
		chev.setAttribute("fill", "none");
		chev.setAttribute("stroke", "currentColor");
		chev.setAttribute("stroke-width", "2");
		chev.setAttribute("stroke-linecap", "round");
		chev.setAttribute("stroke-linejoin", "round");
		chev.setAttribute("aria-hidden", "true");
		const cp = document.createElementNS("http://www.w3.org/2000/svg", "path");
		cp.setAttribute("d", "m6 9 6 6 6-6");
		chev.appendChild(cp);

		trigger.append(text, chev);

		const popover = document.createElement("div");
		popover.className = "cstpn-select-popover";
		popover.hidden = true;

		let current = value;
		for (const item of items) {
			const opt = document.createElement("button");
			opt.type = "button";
			opt.className = "cstpn-select-item";
			opt.textContent = item.label;
			opt.dataset.selected = item.id === current ? "true" : "false";
			opt.addEventListener("click", () => {
				current = item.id;
				text.textContent = item.label;
				for (const o of popover.querySelectorAll(".cstpn-select-item")) {
					o.dataset.selected = o === opt ? "true" : "false";
				}
				box.dataset.open = "false";
				popover.hidden = true;
				onChange(item.id);
			});
			popover.appendChild(opt);
		}

		trigger.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			const open = box.dataset.open !== "true";
			box.dataset.open = open ? "true" : "false";
			popover.hidden = !open;
		});

		// 点击外部收起
		const onDocDown = (event) => {
			if (!box.contains(event.target)) {
				box.dataset.open = "false";
				popover.hidden = true;
			}
		};
		document.addEventListener("mousedown", onDocDown, true);

		box.append(trigger, popover);
		wrap.append(label, box);
		return wrap;
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

	function takeOverExportPage() {
		const main = document.querySelector(EXPORT_PAGE);
		if (!main) return;

		injectStyle();
		const h1 = main.querySelector(".export-toolbar h1");
		if (h1 && !h1.querySelector(`.${MARK}-badge`)) {
			const badge = document.createElement("span");
			badge.className = `${MARK}-badge`;
			badge.textContent = "（CSTP Next）";
			h1.appendChild(badge);
		}

		// 原生按钮在 fieldset 之外（section.export-controls 的直接子元素），
		// 因此不能靠清空 fieldset 去掉它。这里改为接管它：
		// 换文案、标记已接管，点击由 capture 阶段的拦截器处理。
		const origin = main.querySelector(".export-generate");
		if (origin && !origin.hasAttribute(TAKEN)) {
			origin.setAttribute(TAKEN, "");
			origin.textContent = "导出并下载";
			origin.removeAttribute("disabled");
		}

		const fieldset = main.querySelector(EXPORT_FIELDSET);
		if (!fieldset || fieldset.hasAttribute(TAKEN)) return;

		injectPageStyle();
		fieldset.setAttribute(TAKEN, "");
		const legendText = fieldset.querySelector("legend")?.textContent ?? "导出选项";
		while (fieldset.firstChild) fieldset.removeChild(fieldset.firstChild);

		const legendEl = document.createElement("legend");
		legendEl.textContent = legendText;
		fieldset.appendChild(legendEl);

		const panel = document.createElement("div");
		panel.style.cssText = "display:grid;gap:var(--space-group,16px)";

		// 格式：保留原生 PNG，追加 JSON
		panel.appendChild(
			selectField(
				"格式",
				[
					{ id: "png", label: "PNG 图片" },
					{ id: "html", label: "离线 HTML" },
					{ id: "json", label: "JSON 数据" },
				],
				options.format,
				(v) => { options.format = v; },
			),
		);

		panel.appendChild(
			selectField(
				"主题",
				[
					{ id: "light", label: "日间" },
					{ id: "dark", label: "夜间" },
				],
				options.theme,
				(v) => { options.theme = v; },
			),
		);

		panel.appendChild(checkbox("包含思考过程", options.includeThinking, (v) => { options.includeThinking = v; }));
		panel.appendChild(checkbox("包含工具调用结果", options.includeTools, (v) => { options.includeTools = v; }));

		const note = document.createElement("p");
		note.className = "cstpn-note";
		note.textContent = "由浏览器下载保存，可在保存对话框中选择位置。";
		panel.appendChild(note);

		fieldset.appendChild(panel);
	}

	// ---------------------------------------------------------------- 捕获阶段拦截
	function interceptExportClick(event) {
		try {
			const target = event.target;
			if (!target?.closest) return;
			const main = target.closest(EXPORT_PAGE);
			if (!main) return;
			const origin = target.closest(".export-generate");
			if (!origin) return;
			event.preventDefault();
			event.stopPropagation();
			event.stopImmediatePropagation();
			const sessionId = /\/s\/([a-zA-Z0-9_-]+)\/export/.exec(location.pathname)?.[1] ?? "";
			if (!sessionId) {
				toast("未能识别会话 ID", "error", 3000);
				return;
			}
			void runExport([sessionId], { ...options });
		} catch {
			/* 不干扰其他交互 */
		}
	}

	// ---------------------------------------------------------------- 调度
	let observer = null;

	function tick() {
		try {
			ensureMenu();
			takeOverExportPage();
		} catch {
			/* 静默跳过 */
		}
	}

	document.addEventListener("click", interceptExportClick, true);
	document.addEventListener("contextmenu", trackContextMenu, true);

	function startObserver() {
		if (observer || typeof MutationObserver === "undefined") return;
		observer = new MutationObserver(() => tick());
		observer.observe(document.documentElement, { childList: true, subtree: true });
	}

	window.__cstpnExport = { runExport, targetSessionIds, buildHtml, buildJson, buildPng, options };

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			tick();
			startObserver();
		}, { once: true });
	} else {
		tick();
		startObserver();
	}
	window.setInterval(tick, TICK_MS);
})();
