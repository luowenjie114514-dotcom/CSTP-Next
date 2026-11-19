/**
 * CSTP Next · WEB_ID：会话 ID 显示与复制。
 *
 * 两个能力：
 * 1. 鼠标悬停在会话行上时，显示该会话的 sessionID（原生 tooltip + 浮层）。
 * 2. 右键菜单新增「复制会话 ID」。
 *
 * 实现约束（踩过的坑）：
 * - 不替换、不删除 React 管理的 DOM 节点，只在既有行上设置 title 等属性；
 * - 菜单项通过 insertBefore 插入，不触碰其他节点；
 * - 所有操作都放在 try/catch 里，异常时静默跳过，绝不打断原生交互。
 */
(() => {
	const MARK = "data-cstpn-id";
	const MENU = ".session-menu";
	const ITEM = '[role="menuitem"]';
	const ROW = "[data-session-id]";
	const TICK_MS = 350;
	const TIP_ID = "cstpn-id-tip";

	const state = { tip: null, tipFor: null };

	function injectStyle() {
		if (document.getElementById("cstpn-id-style")) return;
		const style = document.createElement("style");
		style.id = "cstpn-id-style";
		style.textContent = `
#${TIP_ID}{position:fixed;z-index:2147000000;max-width:min(420px,80vw);padding:7px 11px;border-radius:9px;background:rgba(24,29,34,.96);color:#f2f5f7;font-size:12px;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 8px 24px rgba(0,0,0,.36);border:1px solid rgba(255,255,255,.12);pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${TIP_ID}[hidden]{display:none}
#${TIP_ID} .k{opacity:.55;margin-right:6px;font-family:system-ui,sans-serif}
`;
		document.head.appendChild(style);
	}

	function ensureTip() {
		injectStyle();
		if (state.tip && state.tip.isConnected) return state.tip;
		const tip = document.createElement("div");
		tip.id = TIP_ID;
		tip.hidden = true;
		document.body.appendChild(tip);
		state.tip = tip;
		return tip;
	}

	function showTip(row, text, x, y) {
		const tip = ensureTip();
		tip.textContent = "";
		const k = document.createElement("span");
		k.className = "k";
		k.textContent = "sessionID";
		const v = document.createElement("span");
		v.textContent = text;
		tip.append(k, v);

		tip.hidden = false;
		// 尽量贴着鼠标，并避免越界
		const rect = tip.getBoundingClientRect();
		const left = Math.min(Math.max(8, x + 14), window.innerWidth - rect.width - 8);
		const top = Math.min(Math.max(8, y + 18), window.innerHeight - rect.height - 8);
		tip.style.left = `${left}px`;
		tip.style.top = `${top}px`;
		state.tipFor = row;
	}

	function hideTip() {
		if (state.tip) state.tip.hidden = true;
		state.tipFor = null;
	}

	// ---------------------------------------------------------------- 悬停显示
	/** 给每个会话行补上原生 title（浏览器 tooltip），并挂浮层事件。 */
	function decorateRows() {
		const rows = document.querySelectorAll(ROW);
		for (const row of rows) {
			const id = row.getAttribute("data-session-id");
			if (!id) continue;
			// 原生 tooltip：即使脚本的浮层失效也有兜底
			if (!row.hasAttribute(MARK)) {
				row.setAttribute(MARK, "");
				const previous = row.getAttribute("title");
				row.setAttribute("data-cstpn-old-title", previous ?? "");
				row.setAttribute("title", previous ? `${previous}\nsessionID: ${id}` : `sessionID: ${id}`);

				let hideTimer = null;
				row.addEventListener("mouseenter", (event) => {
					if (hideTimer) {
						window.clearTimeout(hideTimer);
						hideTimer = null;
					}
					const rect = row.getBoundingClientRect();
					showTip(row, id, rect.right, rect.top);
				});
				row.addEventListener("mousemove", (event) => {
					if (state.tipFor === row && state.tip && !state.tip.hidden) {
						const rect = state.tip.getBoundingClientRect();
						const left = Math.max(8, Math.min(event.clientX + 14, window.innerWidth - rect.width - 8));
						const top = Math.max(8, Math.min(event.clientY + 18, window.innerHeight - rect.height - 8));
						state.tip.style.left = `${left}px`;
						state.tip.style.top = `${top}px`;
					}
				});
				row.addEventListener("mouseleave", () => {
					hideTimer = window.setTimeout(() => {
						if (state.tipFor === row) hideTip();
					}, 80);
				});
			} else {
				// 会话标题可能变化，保持 sessionID 尾巴正确
				const wanted = `sessionID: ${id}`;
				const current = row.getAttribute("title") ?? "";
				if (!current.endsWith(wanted)) {
					const old = row.getAttribute("data-cstpn-old-title") ?? "";
					row.setAttribute("title", old ? `${old}\nsessionID: ${id}` : wanted);
				}
			}
		}
		if (state.tipFor && !state.tipFor.isConnected) hideTip();
	}

	// ---------------------------------------------------------------- 右键菜单
	function icon() {
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		for (const [k, v] of Object.entries({
			width: "18", height: "18", viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round",
			"stroke-linejoin": "round", "aria-hidden": "true",
		})) svg.setAttribute(k, v);
		// 两个叠放的矩形 = 复制图标
		for (const d of ["M9 9h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z", "M5 15V5a2 2 0 0 1 2-2h10"]) {
			const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
			p.setAttribute("d", d);
			svg.appendChild(p);
		}
		return svg;
	}

	/** 当前右键上下文对应的会话 ID（与导出插件同一套判定）。 */
	let lastRow = null;

	function currentIds() {
		const rows = [...document.querySelectorAll(ROW)];
		const selected = rows
			.filter((r) => r.hasAttribute("data-selected") && !r.hasAttribute("data-disabled"))
			.map((r) => r.getAttribute("data-session-id"))
			.filter(Boolean);
		if (selected.length) return [...new Set(selected)];
		const id = lastRow?.getAttribute?.("data-session-id");
		if (id) return [id];
		const active = document.querySelector(`${ROW}[aria-current="page"]`);
		const a = active?.getAttribute("data-session-id");
		return a ? [a] : [];
	}

	async function copyText(text) {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
		} catch {
			/* 回退到 execCommand */
		}
		try {
			const ta = document.createElement("textarea");
			ta.value = text;
			ta.setAttribute("readonly", "");
			ta.style.position = "fixed";
			ta.style.left = "-9999px";
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand("copy");
			ta.remove();
			return ok;
		} catch {
			return false;
		}
	}

	function flash(message) {
		let el = document.getElementById("cstpn-id-flash");
		if (!el) {
			el = document.createElement("div");
			el.id = "cstpn-id-flash";
			el.style.cssText =
				"position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147000000;padding:10px 16px;border-radius:11px;background:rgba(22,74,52,.97);color:#fff;font-size:13px;font-family:system-ui,sans-serif;box-shadow:0 10px 28px rgba(0,0,0,.4)";
			document.body.appendChild(el);
		}
		el.textContent = message;
		el.hidden = false;
		window.setTimeout(() => {
			if (el) el.hidden = true;
		}, 2000);
	}

	function buildItem() {
		const button = document.createElement("button");
		button.type = "button";
		button.setAttribute("role", "menuitem");
		button.className = "sidebar-account-item";
		button.setAttribute(MARK, "");
		button.appendChild(icon());
		button.appendChild(document.createTextNode("复制会话 ID（CSTP Next）"));
		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			const ids = currentIds();
			if (!ids.length) {
				flash("没有识别到会话");
				return;
			}
			const text = ids.join("\n");
			const ok = await copyText(text);
			flash(ok ? `已复制 ${ids.length} 个会话 ID` : "复制失败，请手动选中复制");
		});
		return button;
	}

	function ensureMenu() {
		const menu = document.querySelector(MENU);
		if (!menu || menu.querySelector(`[${MARK}]`)) return;
		injectStyle();
		const item = buildItem();
		// 放在分隔线之前（重命名/管理之后），保持「危险操作在最后」的语义
		const divider = menu.querySelector(".session-menu-divider");
		if (divider) menu.insertBefore(item, divider);
		else {
			const del = menu.querySelector(`${ITEM}.sidebar-menu-delete`);
			if (del) menu.insertBefore(item, del);
			else menu.appendChild(item);
		}
	}

	// ---------------------------------------------------------------- 调度
	function trackContextMenu(event) {
		try {
			lastRow = event.target?.closest?.(ROW) || null;
		} catch {
			lastRow = null;
		}
	}

	function tick() {
		try {
			decorateRows();
			ensureMenu();
		} catch {
			/* 静默跳过 */
		}
	}

	document.addEventListener("contextmenu", trackContextMenu, true);
	// 滚动或离开时收起浮层
	window.addEventListener("scroll", hideTip, true);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
