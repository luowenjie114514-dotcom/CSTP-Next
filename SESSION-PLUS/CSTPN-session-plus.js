/**
 * CSTP Next · 会话增强包：内文搜索 / 置顶 / 行内重命名。
 *
 * 三个功能（均已核查原生空白）：
 * 1. 会话内文本搜索：进入会话后页头出现搜索按钮（三点菜单左侧），点击拉起搜索条
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
const TAG_KEY = "cstpn-session-tags";       // { sessionId: [tag, ...] }
const TAGS_KEY = "cstpn-tag-list";          // 已用过的标签集合
const FILTER_KEY = "cstpn-tag-filter";      // 当前筛选的标签（空 = 全部）
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
.cstpn-find-btn{display:inline-flex;align-items:center;justify-content:center}
.cstpn-tag-badge{display:inline-flex;gap:3px;margin-left:6px;vertical-align:middle}
.cstpn-tag-chip{padding:1px 5px;border-radius:4px;background:rgba(138,180,248,.22);color:var(--app-send,#8ab4f8);font-size:10px;line-height:1.4;white-space:nowrap}
.cstpn-tag-more{padding:1px 4px;border-radius:4px;background:rgba(127,127,127,.22);font-size:10px;opacity:.7}
.cstpn-tagbar{display:flex;flex-wrap:wrap;gap:4px;padding:6px 8px 8px}
.cstpn-tagbar-item{padding:2px 8px;border-radius:10px;border:1px solid rgba(127,127,127,.28);background:transparent;color:inherit;font-size:11px;cursor:pointer;font-family:inherit;opacity:.72}
.cstpn-tagbar-item[data-on="1"]{background:var(--app-send,#8ab4f8);border-color:transparent;color:#14181d;opacity:1;font-weight:600}
.cstpn-tagdlg-overlay{position:fixed;inset:0;z-index:2147000000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.52);padding:20px}
.cstpn-tagdlg-card{box-sizing:border-box;width:min(360px,100%);display:flex;flex-direction:column;gap:12px;padding:18px;border-radius:14px;background:#1c1f24;color:#e8ecef;box-shadow:0 18px 48px rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.1);font-family:inherit}
.cstpn-tagdlg-title{margin:0;font-size:15px;font-weight:600}
.cstpn-tagdlg-sub{margin:0;font-size:12px;opacity:.6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cstpn-tagdlg-input{padding:7px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:inherit;font-size:13px;font-family:inherit;outline:none}
.cstpn-tagdlg-input:focus{border-color:rgba(138,180,248,.7)}
.cstpn-tagdlg-list{display:flex;flex-wrap:wrap;gap:5px;min-height:26px}
.cstpn-tagdlg-chip{padding:3px 9px;border-radius:8px;border:none;background:rgba(138,180,248,.22);color:var(--app-send,#8ab4f8);font-size:12px;cursor:pointer;font-family:inherit}
.cstpn-tagdlg-empty{font-size:12px;opacity:.45}
.cstpn-tagdlg-foot{display:flex;justify-content:flex-end;gap:8px}
.cstpn-tagdlg-btn{padding:7px 15px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:transparent;color:inherit;font-size:13px;cursor:pointer;font-family:inherit}
.cstpn-tagdlg-save{background:var(--app-send,#8ab4f8);border-color:transparent;color:#14181d;font-weight:600}
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

	// ================================================================ 标签分类
	function tagMap() {
		try {
			return JSON.parse(localStorage.getItem(TAG_KEY) || "{}") || {};
		} catch {
			return {};
		}
	}

	function saveTagMap(map) {
		localStorage.setItem(TAG_KEY, JSON.stringify(map));
		// 同步标签集合
		const all = new Set();
		for (const list of Object.values(map)) {
			for (const t of list || []) all.add(t);
		}
		localStorage.setItem(TAGS_KEY, JSON.stringify([...all]));
	}

	function allTags() {
		try {
			return JSON.parse(localStorage.getItem(TAGS_KEY) || "[]") || [];
		} catch {
			return [];
		}
	}

	function tagsOf(id) {
		const map = tagMap();
		return Array.isArray(map[id]) ? map[id] : [];
	}

	function setTags(id, list) {
		const map = tagMap();
		const clean = [...new Set((list || []).map((t) => String(t).trim()).filter(Boolean))];
		if (clean.length) map[id] = clean;
		else delete map[id];
		saveTagMap(map);
		applyTags();
		applyTagFilter();
	}

	function toggleTag(id, tag) {
		const cur = tagsOf(id);
		setTags(id, cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]);
	}

	function currentFilter() {
		return localStorage.getItem(FILTER_KEY) || "";
	}

	function setFilter(tag) {
		if (tag) localStorage.setItem(FILTER_KEY, tag);
		else localStorage.removeItem(FILTER_KEY);
		applyTagFilter();
		renderFilterBar();
	}

	/** 给会话行渲染标签徽章。 */
	function applyTags() {
		const rows = [...document.querySelectorAll(ROW)];
		if (!rows.length) return;
		const map = tagMap();
		for (const row of rows) {
			const id = row.getAttribute("data-session-id");
			const list = Array.isArray(map[id]) ? map[id] : [];
			const textEl = row.querySelector(".sidebar-selection-text") || row;

			// 移除旧徽章
			row.querySelectorAll(".cstpn-tag-badge").forEach((el) => el.remove());

			if (!list.length) continue;
			const wrap = document.createElement("span");
			wrap.className = "cstpn-tag-badge";
			for (const t of list.slice(0, 3)) {
				const chip = document.createElement("span");
				chip.className = "cstpn-tag-chip";
				chip.textContent = t;
				wrap.appendChild(chip);
			}
			if (list.length > 3) {
				const more = document.createElement("span");
				more.className = "cstpn-tag-more";
				more.textContent = `+${list.length - 3}`;
				wrap.appendChild(more);
			}
			textEl.appendChild(wrap);
		}
	}

	/** 按当前筛选隐藏不匹配的会话行。 */
	function applyTagFilter() {
		const filter = currentFilter();
		const rows = [...document.querySelectorAll(ROW)];
		for (const row of rows) {
			const id = row.getAttribute("data-session-id");
			const match = !filter || tagsOf(id).includes(filter);
			row.style.display = match ? "" : "none";
		}
	}

	// ================================================================ 标签筛选栏
	let filterBar = null;

	function renderFilterBar() {
		const tags = allTags();
		const cur = currentFilter();

		// 没有标签就不用显示
		if (!tags.length) {
			filterBar?.remove();
			filterBar = null;
			return;
		}

		// 找会话行所在的「分组容器」——它的父级才是列表容器
		const firstRow = document.querySelector(ROW);
		if (!firstRow) return;
		const group = firstRow.parentElement;
		if (!group) return;
		const listRoot = group.parentElement || group;

		if (!filterBar?.isConnected) {
			injectStyle();
			filterBar = document.createElement("div");
			filterBar.className = "cstpn-tagbar";
			// 插到第一个分组之前
			listRoot.insertBefore(filterBar, group);
		} else if (filterBar.parentElement !== listRoot) {
			// 结构变了，重新挂载
			listRoot.insertBefore(filterBar, group);
		}

		filterBar.textContent = "";
		const allBtn = document.createElement("button");
		allBtn.type = "button";
		allBtn.className = "cstpn-tagbar-item";
		allBtn.textContent = "全部";
		if (!cur) allBtn.setAttribute("data-on", "1");
		allBtn.addEventListener("click", () => setFilter(""));
		filterBar.appendChild(allBtn);

		for (const t of tags) {
			const b = document.createElement("button");
			b.type = "button";
			b.className = "cstpn-tagbar-item";
			b.textContent = t;
			if (t === cur) b.setAttribute("data-on", "1");
			b.addEventListener("click", () => setFilter(t === cur ? "" : t));
			filterBar.appendChild(b);
		}
	}

	// ================================================================ 标签编辑对话框
	function openTagDialog(row) {
		const id = row?.getAttribute?.("data-session-id");
		if (!id) return;

		const existing = document.querySelector("[data-cstpn-tagdlg]");
		if (existing) existing.remove();

		injectStyle();
		const overlay = document.createElement("div");
		overlay.className = "cstpn-tagdlg-overlay";
		overlay.setAttribute("data-cstpn-tagdlg", "");

		const card = document.createElement("div");
		card.className = "cstpn-tagdlg-card";

		const title = document.createElement("h3");
		title.className = "cstpn-tagdlg-title";
		title.textContent = "标签（Next）";

		const sub = document.createElement("p");
		sub.className = "cstpn-tagdlg-sub";
		sub.textContent = row.getAttribute("title") || "为该会话设置标签";

		const input = document.createElement("input");
		input.className = "cstpn-tagdlg-input";
		input.placeholder = "输入标签后回车，可多个";
		input.setAttribute("aria-label", "标签名");

		const list = document.createElement("div");
		list.className = "cstpn-tagdlg-list";

		const cur = new Set(tagsOf(id));

		const refresh = () => {
			list.textContent = "";
			if (!cur.size) {
				const empty = document.createElement("span");
				empty.className = "cstpn-tagdlg-empty";
				empty.textContent = "暂无标签";
				list.appendChild(empty);
				return;
			}
			for (const t of cur) {
				const chip = document.createElement("button");
				chip.type = "button";
				chip.className = "cstpn-tagdlg-chip";
				chip.textContent = t + " ×";
				chip.title = "点击移除";
				chip.addEventListener("click", () => {
					cur.delete(t);
					refresh();
				});
				list.appendChild(chip);
			}
		};
		refresh();

		const commit = () => {
			const v = input.value.trim();
			if (!v) return;
			cur.add(v);
			input.value = "";
			refresh();
		};

		input.addEventListener("keydown", (e) => {
			e.stopPropagation();
			if (e.key === "Enter") {
				e.preventDefault();
				commit();
			} else if (e.key === "Escape") {
				overlay.remove();
			}
		});

		const foot = document.createElement("div");
		foot.className = "cstpn-tagdlg-foot";

		const cancel = document.createElement("button");
		cancel.type = "button";
		cancel.className = "cstpn-tagdlg-btn";
		cancel.textContent = "取消";
		cancel.addEventListener("click", () => overlay.remove());

		const save = document.createElement("button");
		save.type = "button";
		save.className = "cstpn-tagdlg-btn cstpn-tagdlg-save";
		save.textContent = "保存";
		save.addEventListener("click", () => {
			setTags(id, [...cur]);
			overlay.remove();
		});

		foot.append(cancel, save);
		card.append(title, sub, input, list, foot);
		overlay.appendChild(card);
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) overlay.remove();
		});
		document.body.appendChild(overlay);
		input.focus();
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
				buildItem(isPinned ? "取消置顶（Next）" : "置顶会话（Next）",
					isPinned ? ["M17 3l4 4-4 4M21 7H9M7 21l-4-4 4-4M3 17h12"] : ["M16 3a2 2 0 0 1 2 2v5.3l1.4 2.8a1 1 0 0 1-.9 1.4H13v6a1 1 0 0 1-2 0v-6H5.5a1 1 0 0 1-.9-1.4L6 10.3V5a2 2 0 0 1 2-2h8Z"],
					() => { togglePin(single); }),
			);

			// 标签（仅单会话）
			items.push(
				buildItem("设置标签（Next）",
					["M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82ZM7 7h.01"],
					() => {
						const row = lastRow || document.querySelector(`${ROW}[aria-current="page"]`);
						openTagDialog(row);
					}),
			);
		}

		// 分隔线的唯一用途是把「删除」这类危险操作隔开。
		// 所有补丁项一律插到分隔线【之前】，绝不越过它。
		if (items.length) {
			const frag = document.createDocumentFragment();
			for (const item of items) {
				item.setAttribute("data-cstpn-menu", "");
				frag.appendChild(item);
			}

			const divider = menu.querySelector(".session-menu-divider");
			if (divider?.parentElement) {
				divider.parentElement.insertBefore(frag, divider);
			} else {
				// 没有分隔线就直接跟在最后一项后
				menu.appendChild(frag);
			}
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
		input.placeholder = "在会话中搜索（Next）…";
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

	// ================================================================ 页头搜索按钮
	/**
	 * 在会话页头「三点菜单」左侧注入搜索按钮。
	 * 只在进入具体会话时出现（.chat-header 存在且非空态）。
	 */
	function ensureHeaderButton() {
		const header = document.querySelector(".chat-header");
		if (!header) return;
		// 已在则只更新提示
		if (header.querySelector("[data-cstpn-find]")) return;

		const trigger = header.querySelector(".chat-menu-trigger");
		if (!trigger) return; // 还没渲染菜单按钮，等下一轮

		injectStyle();
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "chat-menu-trigger cstpn-find-btn";
		btn.setAttribute("data-cstpn-find", "");
		btn.setAttribute("aria-label", "会话内搜索");
		btn.title = "会话内搜索";
		btn.innerHTML =
			'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

		btn.addEventListener("click", (event) => {
			event.preventDefault();
			event.stopPropagation();
			openFindbar();
		});

		// 插在三点菜单按钮之前，保持右侧原有关闭/菜单顺序
		trigger.parentElement.insertBefore(btn, trigger);
	}

	// ================================================================ 快捷键设置项
	/**
	 * 在 设置 → 快捷键 → 聊天操作 列表末尾追加本插件的快捷键说明。
	 * 原生列表是打包文件里的硬编码数组，无法改源码，故用 DOM 追加一行。
	 * 结构与原生一致：.settings-flat-row > span(命令) + kbd(按键)
	 */
	const SHORTCUT_ITEMS = [
		{ command: "会话内搜索", keys: "会话页头搜索按钮" },
	];

	function ensureShortcutRows() {
		const card = document.querySelector(".settings-shortcuts");
		if (!card) return;
		if (card.querySelector("[data-cstpn-sc]")) return;

		for (const item of SHORTCUT_ITEMS) {
			const row = document.createElement("div");
			row.className = "settings-flat-row";
			row.setAttribute("data-cstpn-sc", "");

			const label = document.createElement("span");
			label.textContent = item.command;

			const kbd = document.createElement("kbd");
			kbd.className = "settings-key-kbd";
			kbd.textContent = item.keys;

			row.append(label, kbd);
			card.appendChild(row);
		}
	}

	// ================================================================ 双击重命名
	document.addEventListener("dblclick", (event) => {
		try {
			// 只在双击会话名区域时触发（行内文字），不是整行任意位置
			const textEl = event.target?.closest?.(".sidebar-selection-text");
			const row = textEl?.closest?.(ROW) || event.target?.closest?.(ROW);
			if (!row) return;
			if (row.classList.contains("sidebar-session-select")) return; // 管理态跳过
			if (document.querySelector(".session-management-toolbar")) return;

			// 若已有编辑框在，忽略
			if (row.querySelector(".cstpn-rename")) return;

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
			ensureHeaderButton();
			ensureShortcutRows();
			applyPin();
			applyTags();
			applyTagFilter();
			renderFilterBar();
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

	window.__cstpnSess = { togglePin, pinned, renameInline, openFindbar, ensureShortcutRows, setTags, tagsOf, allTags, setFilter, openTagDialog };
})();
