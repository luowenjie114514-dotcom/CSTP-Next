/**
 * CSTP Next · 会话工具调用摘要。
 *
 * 在会话右上角「更多」菜单里新增「工具调用」，弹出面板按轮次展示
 * 每轮调用了哪些工具（名称 + 参数摘要 + 结果首行）。
 *
 * 数据来源：GET /api/sessions/<id> 的 entries，逐条扫描
 *   message.role === "assistant" 且 content 里 type === "toolCall"
 *   message.role === "toolResult" 且 toolCallId 匹配
 *
 * DOM 依据：
 *   菜单  div.sidebar-account-menu（由 .chat-menu-trigger 打开）
 *   会话  .chat-loaded[data-session-id]
 *   轮次  .conversation > .turn
 */
(() => {
	const MARK = "data-cstpn-tools";
	const STYLE_ID = "cstpn-tools-style";
	const MENU = ".sidebar-account-menu";
	const TICK_MS = 400;

	const cache = new Map();

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
.cstpn-tools-overlay{position:fixed;inset:0;z-index:2147000000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(12,17,22,.56)}
.cstpn-tools-overlay[hidden]{display:none}
.cstpn-tools-card{box-sizing:border-box;width:min(640px,100%);max-height:min(78vh,760px);display:flex;flex-direction:column;border-radius:14px;border:1px solid var(--chat-border,rgba(127,127,127,.3));background:var(--chat-bg,#1c1f24);color:var(--chat-ink,#e8ecef);box-shadow:0 20px 52px rgba(0,0,0,.46);overflow:hidden}
.cstpn-tools-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid var(--chat-border,rgba(127,127,127,.24))}
.cstpn-tools-title{margin:0;font-size:15px;font-weight:600}
.cstpn-tools-sub{margin:0;font-size:12px;opacity:.6}
.cstpn-tools-close{border:none;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer;opacity:.6;padding:0 4px}
.cstpn-tools-close:hover{opacity:1}
.cstpn-tools-body{overflow:auto;padding:8px 18px 18px}
.cstpn-tools-empty{padding:24px 0;text-align:center;font-size:13px;opacity:.6}
.cstpn-turn-sect{margin-top:14px}
.cstpn-turn-head{display:flex;align-items:baseline;gap:8px;font-size:12px;opacity:.66;margin-bottom:7px}
.cstpn-turn-idx{font-weight:600;opacity:.9}
.cstpn-tool{display:flex;gap:9px;padding:7px 10px;border-radius:8px;background:rgba(127,127,127,.1);margin-bottom:6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55}
.cstpn-tool-name{flex:none;font-weight:600;color:var(--app-send,#8ab4f8)}
.cstpn-tool-args{flex:1;min-width:0;opacity:.78;word-break:break-all}
.cstpn-tool-res{flex:none;opacity:.5;font-size:11px}
`;
		document.head.appendChild(style);
	}

	function esc(v) {
		return String(v ?? "");
	}

	function shorten(text, max) {
		const s = String(text ?? "").replace(/\s+/g, " ").trim();
		return s.length > max ? s.slice(0, max) + "…" : s;
	}

	function argsSummary(args) {
		if (!args || typeof args !== "object") return "";
		try {
			return shorten(JSON.stringify(args), 120);
		} catch {
			return "";
		}
	}

	function contentText(content) {
		if (typeof content === "string") return content;
		if (!Array.isArray(content)) return "";
		const parts = [];
		for (const p of content) {
			if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") parts.push(p.text);
		}
		return parts.join(" ");
	}

	/** 从快照里抽取「每轮的工具调用」。 */
	function extractTurns(snapshot) {
		const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];
		const results = new Map();
		for (const e of entries) {
			const m = e?.message ?? e;
			if (m?.role === "toolResult" && typeof m.toolCallId === "string") {
				results.set(m.toolCallId, contentText(m.content));
			}
		}

		const turns = [];
		let current = null;
		for (const e of entries) {
			const m = e?.message ?? e;
			if (!m || typeof m !== "object") continue;

			if (m.role === "user") {
				const text = typeof m.content === "string" ? m.content : contentText(m.content);
				current = { prompt: shorten(text, 60), tools: [] };
				turns.push(current);
				continue;
			}
			if (m.role === "assistant" && Array.isArray(m.content)) {
				if (!current) {
					current = { prompt: "(无提问)", tools: [] };
					turns.push(current);
				}
				for (const part of m.content) {
					if (!part || typeof part !== "object") continue;
					if (part.type === "toolCall") {
						current.tools.push({
							name: part.name ?? "tool",
							args: argsSummary(part.arguments),
							result: shorten(results.get(part.id) ?? "", 40),
						});
					}
				}
			}
		}
		return turns.filter((t) => t.tools.length > 0);
	}

	async function loadTurns(sessionId) {
		if (cache.has(sessionId)) return cache.get(sessionId);
		const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
			cache: "no-store",
			credentials: "same-origin",
		});
		if (!res.ok) throw new Error(`读取会话失败（HTTP ${res.status}）`);
		const data = await res.json();
		const turns = extractTurns(data);
		cache.set(sessionId, turns);
		return turns;
	}

	function currentSessionId() {
		return document.querySelector(".chat-loaded[data-session-id]")?.getAttribute("data-session-id") ?? "";
	}

	// ---------------------------------------------------------------- 面板
	let overlay = null;

	function closePanel(event) {
		if (event) {
			event.preventDefault();
			event.stopPropagation();
		}
		if (overlay) overlay.hidden = true;
	}

	/**
	 * Esc 关闭。
	 * overlay 是普通 div，本身不可聚焦，挂在它身上的 keydown 收不到事件，
	 * 因此改为在 document 上监听；只在面板可见时响应，并阻止事件继续传播。
	 */
	document.addEventListener(
		"keydown",
		(event) => {
			if (event.key !== "Escape") return;
			const el = document.querySelector('[data-cstpn-tools="overlay"]');
			if (!el || el.hidden) return;
			event.preventDefault();
			event.stopPropagation();
			el.hidden = true;
		},
		true,
	);

	function buildPanel() {
		const root = document.createElement("div");
		root.className = "cstpn-tools-overlay";
		root.setAttribute(MARK, "overlay");
		root.hidden = true;

		const card = document.createElement("div");
		card.className = "cstpn-tools-card";

		const head = document.createElement("div");
		head.className = "cstpn-tools-head";
		const left = document.createElement("div");
		const title = document.createElement("h2");
		title.className = "cstpn-tools-title";
		title.textContent = "工具调用（Next）";
		const sub = document.createElement("p");
		sub.className = "cstpn-tools-sub";
		sub.textContent = "按轮次展示本会话的工具调度";
		left.append(title, sub);
		const close = document.createElement("button");
		close.type = "button";
		close.className = "cstpn-tools-close";
		close.setAttribute("aria-label", "关闭");
		close.textContent = "×";
		// 直接在这里设置 hidden，不依赖外层函数引用。
		// 之前绑定 closePanel 时点击无效，改为自包含处理后确认可用。
		close.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			if (overlay) overlay.hidden = true;
			root.hidden = true;
		});
		head.append(left, close);

		const body = document.createElement("div");
		body.className = "cstpn-tools-body";

		card.append(head, body);
		root.appendChild(card);

		root.addEventListener("click", (event) => {
			if (event.target === root) {
				event.preventDefault();
				root.hidden = true;
				if (overlay) overlay.hidden = true;
			}
		});

		document.body.appendChild(root);
		return { root, body };
	}

	async function openPanel() {
		injectStyle();
		if (!overlay) overlay = buildPanel();
		const { root, body } = overlay;
		root.hidden = false;
		body.textContent = "";
		const loading = document.createElement("p");
		loading.className = "cstpn-tools-empty";
		loading.textContent = "正在读取…";
		body.appendChild(loading);

		const sessionId = currentSessionId();
		if (!sessionId) {
			loading.textContent = "未识别到当前会话";
			return;
		}

		let turns;
		try {
			turns = await loadTurns(sessionId);
		} catch (error) {
			loading.textContent = error instanceof Error ? error.message : "读取失败";
			return;
		}
		cache.delete(sessionId); // 下次打开重新取，避免看到旧数据
		body.textContent = "";

		if (!turns.length) {
			const empty = document.createElement("p");
			empty.className = "cstpn-tools-empty";
			empty.textContent = "本会话没有工具调用记录";
			body.appendChild(empty);
			return;
		}

		turns.forEach((turn, i) => {
			const sect = document.createElement("div");
			sect.className = "cstpn-turn-sect";

			const head = document.createElement("div");
			head.className = "cstpn-turn-head";
			const idx = document.createElement("span");
			idx.className = "cstpn-turn-idx";
			idx.textContent = `第 ${i + 1} 轮`;
			const prompt = document.createElement("span");
			prompt.textContent = turn.prompt;
			head.append(idx, prompt);
			sect.appendChild(head);

			for (const tool of turn.tools) {
				const row = document.createElement("div");
				row.className = "cstpn-tool";
				const name = document.createElement("span");
				name.className = "cstpn-tool-name";
				name.textContent = tool.name;
				const args = document.createElement("span");
				args.className = "cstpn-tool-args";
				args.textContent = tool.args;
				row.append(name, args);
				if (tool.result) {
					const res = document.createElement("span");
					res.className = "cstpn-tool-res";
					res.textContent = tool.result;
					row.appendChild(res);
				}
				sect.appendChild(row);
			}
			body.appendChild(sect);
		});
	}

	window.__cstpnTools = { openPanel, extractTurns };

	// ---------------------------------------------------------------- 菜单注入
	function ensureMenuItem() {
		const menu = document.querySelector(MENU);
		if (!menu || menu.querySelector(`[${MARK}]`)) return;
		injectStyle();

		const button = document.createElement("button");
		button.type = "button";
		button.className = "sidebar-account-item";
		button.setAttribute(MARK, "");

		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		for (const [k, v] of Object.entries({
			width: "18", height: "18", viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
			"stroke-linejoin": "round", "aria-hidden": "true",
		})) svg.setAttribute(k, v);
		for (const d of ["M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"]) {
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.setAttribute("d", d);
			svg.appendChild(p);
		}
		button.appendChild(svg);
		button.appendChild(document.createTextNode("工具调用（Next）"));

		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			void openPanel();
		});

		// 插到分隔线之前——分隔线下方只留「删除」这类危险操作
		const divider = menu.querySelector(".session-menu-divider");
		if (divider?.parentElement) {
			divider.parentElement.insertBefore(button, divider);
		} else {
			// 没有分隔线时，跟在最后一个非删除项之后
			const items = [...menu.querySelectorAll(".sidebar-account-item")];
			const del = items.find((el) => el.textContent?.includes("删除"));
			if (del?.parentElement) del.parentElement.insertBefore(button, del);
			else menu.appendChild(button);
		}
	}

	function tick() {
		try {
			ensureMenuItem();
		} catch {
			/* 静默 */
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
