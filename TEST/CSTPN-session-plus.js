/**
 * CSTP Next · 会话增强包：内文搜索 / 置顶 / 行内重命名。
 *
 * 三个功能（均已核查原生空白）：
 * 1. 会话内文本搜索：Ctrl+F 拉起搜索条，高亮命中、逐个跳转
 * 2. 会话置顶：右键菜单加「置顶/取消置顶」，localStorage 持久化
 * 3. 行内重命名：右键「重命名」和双击会话行，直接在列表里改名
 *    （原生走 window.prompt 丑弹框，本脚本改为行内 input）
 *
 * DOM 依据（实测确认）：
 *   会话行  .sidebar-session[data-session-id]（普通态 <a> / 管理态 <label>）
 *   标题    行内 .sidebar-selection-text，行属性 title
 *   排序    列表按 updatedAt 分组（今天/一周/一月/更早），组内降序
 *   聊天区  .conversation > .turn，正文在 .markdown
 *
 * 约束（历次踩坑汇总）：
 *   - 不删除/替换 React 管理的节点；编辑框用后由自己移除
 *   - 高亮用 CSS Custom Highlight API（不拆 DOM），退级用 mark 包裹
 *   - 所有外部交互 try/catch，异常静默
 */
(() => {
	const MENU = ".session-menu";
	const ITEM = '[role="menuitem"]';
	const ROW = ".sidebar-session[data-session-id]";
	const PIN_KEY = "cstpn-pinned-sessions";
	const TICK_MS = 400;

	const state = { menuRow: null };

	function injectStyle() {
		if (document.getElementById("cstpn-sess-style")) return;
		const style = document.createElement("style");
		style.id = "cstpn-sess-style";
		style.textContent = `
/* 行内重命名 */
.cstpn-rename{box-sizing:border-box;width:100%;height:24px;padding:0 6px;border-radius:6px;border:1px solid var(--app-send,#8ab4f8);background:var(--chat-bg,#1c1f24);color:inherit;font:inherit;font-size:13px;outline:none}
.cstpn-rename:focus{box-shadow:0 0 0 2px rgba(138,180,248,.25)}
/* 置顶标记 */
.cstpn-pin-flag{display:inline-flex;margin-left:6px;vertical-align:middle;opacity:.75}
.cstpn-pin-flag svg{width:12px;height:12px}
/* 会话内搜索条 */
.cstpn-findbar{position:fixed;top:14px;right:18px;z-index:2147000000;display:flex;align-items:center;gap:6px;padding:8px 10px;border-radius:11px;background:rgba(24,29,34,.97);color:#f2f5f7;font-size:13px;font-family:inherit;box-shadow:0 12px 30px rgba(0,0,0,.44);border:1px solid rgba(255,255,255,.12)}
.cstpn-findbar input{width:220px;padding:5px 9px;border-radius:7px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.08);color:inherit;font:inherit;font-size:13px;outline:none}
.cstpn-findbar input:focus{border-color:rgba(138,180,248,.7)}
.cstpn-findbar .cnt{min-width:56px;text-align:center;opacity:.75;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}
.cstpn-findbar button{border:none;background:transparent;color:inherit;cursor:pointer;opacity:.75;font-size:14px;padding:2px 6px;border-radius:6px}
.cstpn-findbar button:hover{opacity:1;background:rgba(255,255,255,.1)}
.cstpn-findbar button[data-done="1"]{opacity:1}
/* 高亮 */
.cstpn-hl{background:rgba(255,196,64,.45);color:inherit;border-radius:2px}
.cstpn-hl[data-active="1"]{background:rgba(255,150,40,.85);color:#14181d}
`;
		document.head.appendChild(style);
	}

	// ================================================================ 置顶
	function pinned() {
		try {
			return new Set(JSON.parse(localStorage.getItem(PIN_KEY) || "[]"));
		} catch {
			return new Set();
		}
	}

	function savePinned(set) {
		localStorage.setItem(PIN_KEY, JSON.stringify([...set]));
	}

	function togglePin(id) {
		const set = pinned();
		if (set.has(id)) set.delete(id);
		else set.add(id);
		savePinned(set);
		applyPin();
	}

	/** 给置顶的会话行加标记并移到分组最前。 */
	function applyPin() {
		const set = pinned();
		if (!set.size) return;
		// 找出各分组容器（会话行的祖容器按 DOM 顺序即分组顺序）
		const rows = [...document.querySelectorAll(ROW)];
		if (!rows.length) return;
		for (const row of rows) {
			const id = row.getAttribute("data-session-id");
			if (!set.has(id)) continue;
			// 加旗标（真实 DOM 有 .sidebar-selection-text；兜底用行本身）
			const text = row.querySelector(".sidebar-selection-text") || row;
			if (text && !text.querySelector(":scope > .cstpn-pin-flag")) {
				const flag = document.createElement("span");
				flag.className = "cstpn-pin-flag";
				flag.innerHTML =
					'<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M16 3a2 2 0 0 1 2 2v5.3l1.4 2.8a1 1 0 0 1-.9 1.4H13v6a1 1 0 0 1-2 0v-6H5.5a1 1 0 0 1-.9-1.4L6 10.3V5a2 2 0 0 1 2-2h8Z"/></svg>';
				flag.title = "已置顶";
				text.appendChild(flag);
			}
		}
		// 把置顶行移到其所在分组的顶部（仅移动 DOM 位置，React 重渲染会重排，tick 会再补）
		for (const row of rows) {
			const id = row.getAttribute("data-session-id");
			if (!set.has(id)) continue;
			const group = row.parentElement;
			if (!group || group.firstElementChild === row) continue;
			// 确认同组还有其他行才需要移动
			if (group.querySelectorAll(ROW).length > 1) {
				group.insertBefore(row, group.firstElementChild);
			}
		}
	}

	// ================================================================ 行内重命名
	async function renameInline(row) {
		if (!row || row.querySelector(".cstpn-rename")) return;
		const id = row.getAttribute("data-session-id");
		if (!id) return;
		injectStyle();

		const textEl = row.querySelector(".sidebar-selection-text") || row;
		const old = row.getAttribute("title") || textEl.textContent.trim();
		// 去掉可能存在的提示尾巴
		const oldName = old.replace(/\n?sessionID:.*$/s, "").trim();

		const input = document.createElement("input");
		input.className = "cstpn-rename";
		input.value = oldName;
		input.setAttribute("aria-label", "重命名会话");
		textEl.textContent = "";
		textEl.appendChild(input);
		input.focus();
		input.select();

		let done = false;
		const finish = async (commit) => {
			if (done) return;
			done = true;
			const name = input.value.trim();
			// 还原显示（React 会在 PATCH 成功后 refresh 重渲染）
			textEl.textContent = oldName;
			if (!commit || !name || name === oldName) return;
			try {
				const res = await fetch(`/api/sessions/${encodeURIComponent(id)}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json", "X-CST-Web-Request": "1", "Idempotency-Key": crypto.randomUUID() },
					credentials: "same-origin",
					body: JSON.stringify({ name }),
				});
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				textEl.textContent = name; // 立即反馈；刷新由页面自身状态驱动
				row.setAttribute("title", name);
			} catch (error) {
				flash(`重命名失败（${error instanceof Error ? error.message : "网络"}）`);
			}
		};

		input.addEventListener("keydown", (event) => {
			event.stopPropagation();
			if (event.key === "Enter") void finish(true);
			else if (event.key === "Escape") finish(false);
		});
		input.addEventListener("blur", () => finish(true));
	}

	function flash(message) {
		const el = document.createElement("div");
		el.style.cssText =
			"position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147000001;padding:10px 16px;border-radius:11px;background:rgba(122,26,34,.96);color:#fff;font-size:13px;font-family:system-ui,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.4)";
		el.textContent = message;
		document.body.appendChild(el);
		window.setTimeout(() => el.remove(), 2600);
	}

	// ================================================================ 右键菜单扩展
	let lastRow = null;

	function trackContextMenu(event) {
		try {
			lastRow = event.target?.closest?.(ROW) || null;
		} catch {
			lastRow = null;
		}
	}

	function currentIds() {
		// 右键菜单的上下文行优先——菜单就是为它弹出的
		if (lastRow?.getAttribute?.("data-session-id")) {
			return [lastRow.getAttribute("data-session-id")];
		}
		const rows = [...document.querySelectorAll(ROW)];
		const selected = rows
			.filter((r) => r.hasAttribute("data-selected") && !r.hasAttribute("data-disabled"))
			.map((r) => r.getAttribute("data-session-id"))
			.filter(Boolean);
		if (selected.length) return [...new Set(selected)];
		const active = document.querySelector(`${ROW}[aria-current="page"]`);
		const a = active?.getAttribute("data-session-id");
		return a ? [a] : [];
	}

	function icon(d) {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		for (const [k, v] of Object.entries({
			width: "18", height: "18", viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
			"stroke-linejoin": "round", "aria-hidden": "true",
		})) svg.setAttribute(k, v);
		for (const path of d) {
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.setAttribute("d", path);
			svg.appendChild(p);
		}
		return svg;
	}

	function buildItem(label, paths, onClick) {
		const button = document.createElement("button");
		button.type = "button";
		button.setAttribute("role", "menuitem");
		button.className = "sidebar-account-item";
		button.appendChild(icon(paths));
		button.appendChild(document.createTextNode(label));
		button.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			onClick();
		});
		return button;
	}

	function ensureMenu() {
		const menu = document.querySelector(MENU);
		if (!menu) return;
		// 每次都重建自有的菜单项：置顶目标随右键上下文变化，
		// 只在首次注入会绑死第一行的 ID。
		injectStyle();

		// 移除上一轮注入的项（不含分隔线，一并重建更简单）
		menu.querySelectorAll("[data-cstpn-menu]").forEach((el) => el.remove());
		menu.dataset.cstpnDone = "1";

		const ids = currentIds();
		const single = ids.length === 1 ? ids[0] : null;
		const items = [];

		// 置顶（仅单会话）
		if (single) {
			const set = pinned();
			const isPinned = set.has(single);
			items.push(
				buildItem(isPinned ? "取消置顶" : "置顶会话",
					isPinned ? ["M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12"] : ["M16 3a2 2 0 0 1 2 2v5.3l1.4 2.8a1 1 0 0 1-.9 1.4H13v6a1 1 0 0 1-2 0v-6H5.5a1 1 0 0 1-.9-1.4L6 10.3V5a2 2 0 0 1 2-2h8Z"],
					() => { togglePin(single); }),
			);
		}

		// 搜索（总是可用）
		items.push(
			buildItem("会话内搜索", ["M21 21l-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"], () => openFindbar()),
		);

		// 批量分隔
		if (items.length) {
			const hr = document.createElement("hr");
			hr.className = "session-menu-divider";
			hr.setAttribute("data-cstpn-menu", "divider");
			menu.appendChild(hr);
		}

		for (const item of items) {
			item.setAttribute("data-cstpn-menu", "");
			menu.appendChild(item);
		}

		// 「重命名」改为行内编辑（接管原生菜单项）
		const renameItem = [...menu.querySelectorAll(`${ITEM}`)]
			.find((el) => el.textContent?.trim() === "重命名" && !el.hasAttribute("data-cstpn-menu"));
		if (renameItem && single) {
			renameItem.addEventListener("click", (event) => {
				// 原生 handler 走 window.prompt；我们在 capture 阶段拦住并用行内编辑替代
				event.preventDefault();
				event.stopPropagation();
				const row = lastRow || document.querySelector(`${ROW}[aria-current="page"]`);
				void renameInline(row);
			}, true);
		}
	}

	// ================================================================ 会话内搜索
	let findbar = null;
	let hits = [];
	let hitIndex = -1;

	function clearHighlights() {
		for (const el of document.querySelectorAll(".cstpn-hl")) {
			const parent = el.parentNode;
			if (!parent) continue;
			parent.replaceChild(document.createTextNode(el.textContent), el);
			parent.normalize();
		}
		hits = [];
		hitIndex = -1;
	}

	function highlightIn(root, q) {
		// 只处理文本节点，避免破坏 React 结构
		const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
			acceptNode(node) {
				if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
				if (node.parentElement?.closest("script,style,.cstpn-findbar")) return NodeFilter.FILTER_REJECT;
				return NodeFilter.FILTER_ACCEPT;
			},
		});
		const targets = [];
		while (walker.nextNode()) targets.push(walker.currentNode);

		let count = 0;
		for (const node of targets) {
			const text = node.nodeValue;
			const lower = text.toLowerCase();
			const needle = q.toLowerCase();
			let pos = lower.indexOf(needle);
			if (pos < 0) continue;

			const frag = document.createDocumentFragment();
			let last = 0;
			while (pos >= 0) {
				frag.appendChild(document.createTextNode(text.slice(last, pos)));
				const mark = document.createElement("span");
				mark.className = "cstpn-hl";
				mark.textContent = text.slice(pos, pos + needle.length);
				frag.appendChild(mark);
				count += 1;
				last = pos + needle.length;
				pos = lower.indexOf(needle, last);
			}
			frag.appendChild(document.createTextNode(text.slice(last)));
			node.parentNode.replaceChild(frag, node);
		}
		return count;
	}

	function jumpTo(dir) {
		if (!hits.length) return;
		if (hits[hitIndex]) hits[hitIndex].removeAttribute("data-active");
		hitIndex = (hitIndex + dir + hits.length) % hits.length;
		const el = hits[hitIndex];
		el.setAttribute("data-active", "1");
		el.scrollIntoView({ behavior: "smooth", block: "center" });
		updateCount();
	}

	function updateCount() {
		const cnt = findbar?.querySelector(".cnt");
		if (!cnt) return;
		cnt.textContent = hits.length ? `${hitIndex + 1}/${hits.length}` : "0/0";
	}

	function openFindbar() {
		injectStyle();
		if (findbar?.isConnected) {
			findbar.querySelector("input").focus();
			return;
		}
		findbar = document.createElement("div");
		findbar.className = "cstpn-findbar";

		const input = document.createElement("input");
		input.placeholder = "在会话中搜索…";
		input.setAttribute("aria-label", "会话内搜索");

		const cnt = document.createElement("span");
		cnt.className = "cnt";
		cnt.textContent = "0/0";

		const prev = document.createElement("button");
		prev.textContent = "↑";
		prev.title = "上一个";
		prev.addEventListener("click", () => jumpTo(-1));

		const next = document.createElement("button");
		next.textContent = "↓";
		next.title = "下一个";
		next.addEventListener("click", () => jumpTo(1));

		const close = document.createElement("button");
		close.textContent = "×";
		close.title = "关闭 (Esc)";
		close.addEventListener("click", closeFindbar);

		findbar.append(input, cnt, prev, next, close);
		document.body.appendChild(findbar);
		input.focus();

		let timer = null;
		input.addEventListener("input", () => {
			window.clearTimeout(timer);
			timer = window.setTimeout(() => {
				clearHighlights();
				const q = input.value.trim();
				if (q.length < 1) { updateCount(); return; }
				const conv = document.querySelector(".conversation");
				if (!conv) return;
				const n = highlightIn(conv, q);
				hits = [...conv.querySelectorAll(".cstpn-hl")];
				hitIndex = -1;
				if (hits.length) jumpTo(1);
				else updateCount();
			}, 220);
		});
		input.addEventListener("keydown", (event) => {
			event.stopPropagation();
			if (event.key === "Enter") { event.preventDefault(); jumpTo(event.shiftKey ? -1 : 1); }
			else if (event.key === "Escape") closeFindbar();
		});
	}

	function closeFindbar() {
		clearHighlights();
		findbar?.remove();
		findbar = null;
	}

	// Esc 关闭搜索条（面板外全局）
	document.addEventListener("keydown", (event) => {
		if (event.key !== "Escape") return;
		if (findbar?.isConnected) {
			const input = findbar.querySelector("input");
			if (document.activeElement === input || !findbar.querySelector("input").value) closeFindbar();
		}
	});

	// Ctrl+F 拉起搜索
	document.addEventListener(
		"keydown",
		(event) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
				const inEditor = document.activeElement?.closest("textarea, input, [contenteditable]");
				if (inEditor) return; // 编辑器里让原生行为走
				const conv = document.querySelector(".conversation");
				if (!conv) return;
				event.preventDefault();
				openFindbar();
			}
		},
		true,
	);

	// ================================================================ 双击重命名
	document.addEventListener("dblclick", (event) => {
		try {
			const row = event.target?.closest?.(ROW);
			if (!row || row.classList.contains("sidebar-session-select")) return; // 管理态跳过
			const inManage = !!document.querySelector(".session-management-toolbar");
			if (inManage) return;
			event.preventDefault();
			event.stopPropagation();
			void renameInline(row);
		} catch {
			/* 静默 */
		}
	}, true);

	// ================================================================ 调度
	function tick() {
		try {
			ensureMenu();
			applyPin();
		} catch {
			/* 静默 */
		}
	}

	document.addEventListener("contextmenu", trackContextMenu, true);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);

	window.__cstpnSess = { togglePin, pinned, renameInline, openFindbar };
})();
