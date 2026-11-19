/**
 * CSTP Next [test] · 会话列表快速搜索。
 *
 * 依据（实测确认）：
 *   侧栏会话行是 [data-session-id]，标题在行内文本 / title 属性；
 *   ".conversation" 是聊天区，"#sidebar" 或含 .sidebar-session 的容器是列表区。
 *
 * 功能：
 *   在侧栏顶部注入一个搜索框，输入即过滤会话行（按标题与 sessionID 匹配）。
 *   清空即恢复。不删除任何节点，只用 display 隐藏。
 *
 * 实现约束：
 *   - 只改行元素的 style.display，不移动、不删除节点（React 重渲染可恢复）
 *   - 搜索框带幂等标记，避免重复插入
 *   - 支持 Ctrl/Cmd + K 聚焦
 *   - Esc 清空
 */
(() => {
	const BOX = "data-cstpn-search";
	const STYLE_ID = "cstpn-search-style";
	// 只处理侧栏会话行。聊天区的 .chat-loaded 也带 data-session-id，
	// 绝不能一起过滤，否则会把整个对话隐藏掉。
	const ROW = ".sidebar-session[data-session-id]";
	const TICK_MS = 500;

	/** 取侧栏里的会话行；找不到 .sidebar-session 时回退到「不在聊天区内的」行。 */
	function sidebarRows() {
		const strict = document.querySelectorAll(ROW);
		if (strict.length) return [...strict];
		return [...document.querySelectorAll("[data-session-id]")].filter(
			(el) => !el.closest(".chat-loaded, .conversation, .chat-message-surface, main"),
		);
	}

	let query = "";

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
.cstpn-search-wrap{padding:8px 12px 6px}
.cstpn-search{display:flex;align-items:center;gap:7px;box-sizing:border-box;width:100%;padding:7px 10px;border-radius:9px;border:1px solid var(--chat-border,rgba(127,127,127,.34));background:rgba(127,127,127,.08);color:inherit;font-size:13px;font-family:inherit;outline:none}
.cstpn-search:focus{border-color:var(--app-send,rgba(127,127,127,.7))}
.cstpn-search input{flex:1;min-width:0;border:none;background:transparent;color:inherit;font:inherit;outline:none}
.cstpn-search input::placeholder{opacity:.5}
.cstpn-search .k{font-size:10px;opacity:.42;padding:1px 5px;border-radius:4px;border:1px solid rgba(127,127,127,.4);font-family:ui-monospace,Menlo,Consolas,monospace}
.cstpn-search-clear{border:none;background:transparent;color:inherit;cursor:pointer;opacity:.55;padding:0 2px;font-size:14px;line-height:1}
.cstpn-search-clear:hover{opacity:.9}
`;
		document.head.appendChild(style);
	}

	/** 找侧栏里会话列表的容器：包含多个 [data-session-id] 的最上层元素。 */
	function listHost() {
		const rows = sidebarRows();
		if (!rows.length) return null;
		let host = rows[0].parentElement;
		while (host && host !== document.body) {
			const inside = rows.filter((r) => host.contains(r)).length;
			if (inside >= Math.min(rows.length, 2)) return host;
			host = host.parentElement;
		}
		return rows[0].parentElement;
	}

	function applyFilter() {
		const q = query.trim().toLowerCase();
		for (const row of sidebarRows()) {
			if (!row.hasAttribute("data-cstpn-hidden")) {
				// 记录原始 display，便于恢复
				row.setAttribute("data-cstpn-prev-display", row.style.display || "");
			}
			if (!q) {
				if (row.hasAttribute("data-cstpn-hidden")) {
					row.style.display = row.getAttribute("data-cstpn-prev-display") || "";
					row.removeAttribute("data-cstpn-hidden");
				}
				continue;
			}
			const text = `${row.textContent ?? ""} ${row.getAttribute("title") ?? ""} ${row.getAttribute("data-session-id") ?? ""}`.toLowerCase();
			if (text.includes(q)) {
				row.style.display = row.getAttribute("data-cstpn-prev-display") || "";
				row.removeAttribute("data-cstpn-hidden");
			} else {
				row.style.display = "none";
				row.setAttribute("data-cstpn-hidden", "");
			}
		}
	}

	function ensureSearch() {
		if (document.querySelector(`[${BOX}]`)) return;
		const host = listHost();
		if (!host?.parentElement) return;

		injectStyle();
		const wrap = document.createElement("div");
		wrap.className = "cstpn-search-wrap";
		wrap.setAttribute(BOX, "");

		const box = document.createElement("div");
		box.className = "cstpn-search";

		const input = document.createElement("input");
		input.type = "search";
		input.placeholder = "搜索会话（Next）…";
		input.value = query;
		input.setAttribute("aria-label", "搜索会话");

		const key = document.createElement("span");
		key.className = "k";
		key.textContent = "⌘K";

		const clear = document.createElement("button");
		clear.type = "button";
		clear.className = "cstpn-search-clear";
		clear.textContent = "×";
		clear.setAttribute("aria-label", "清空搜索");
		clear.addEventListener("click", () => {
			input.value = "";
			query = "";
			applyFilter();
			input.focus();
		});

		input.addEventListener("input", () => {
			query = input.value;
			applyFilter();
		});
		input.addEventListener("keydown", (event) => {
			if (event.key === "Escape") {
				input.value = "";
				query = "";
				applyFilter();
				input.blur();
			}
		});

		box.append(input, key, clear);
		wrap.appendChild(box);
		host.parentElement.insertBefore(wrap, host);
	}

	function tick() {
		try {
			ensureSearch();
			if (query) applyFilter();
		} catch {
			/* 静默 */
		}
	}

	// Ctrl/Cmd + K 聚焦搜索
	document.addEventListener(
		"keydown",
		(event) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				const input = document.querySelector(`[${BOX}] input`);
				if (input) {
					event.preventDefault();
					input.focus();
					input.select();
				}
			}
		},
		true,
	);

	window.__cstpnSearch = { applyFilter, setQuery: (v) => { query = v; applyFilter(); } };

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
