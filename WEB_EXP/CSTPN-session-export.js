/**
 * CSTP Next · 会话右键菜单「导出（CSTP Next）」增强。
 *
 * 为什么是独立脚本：assets/* 是带内容哈希的强缓存文件，改动不会到达已打开过的
 * 浏览器；本文件不带哈希，由 index.html 引入，刷新即生效，删除引用即恢复。
 *
 * 行为：
 * - 单选模式：右键会话 → 菜单多出「导出（CSTP Next）」，导出该会话。
 * - 管理模式：勾选多个会话 → 右键其中任一 → 菜单多出「导出（CSTP Next）」，
 *   逐个导出所有已勾选的会话。
 * - 导出完成后自动调用 /open 接口，弹出资源管理器定位到保存目录。
 *
 * 复用后端既有能力，不新增接口、不落任意路径：
 *   POST /api/sessions/<id>/exports   {format, theme, includeThinking, includeTools}
 *   GET  /api/exports/<exportId>      轮询状态
 *   POST /api/exports/<exportId>/open 启动本机文件管理器
 * 保存目录由后端固定在 artifacts/<日期>/sessions/，页面无法指定路径。
 */
(() => {
	const MENU = ".session-menu";
	const ITEM = '[role="menuitem"]';
	const MARK = "data-cstpn-export";
	const ROW = "[data-session-id]";
	const TICK_MS = 400;

	const EXPORT_OPTIONS = {
		format: "html",
		theme: "dark",
		includeThinking: false,
		includeTools: false,
	};

	const state = {
		busy: false,
		toast: null,
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
`;
		document.head.appendChild(style);
	}

	// ---------------------------------------------------------------- 提示
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
	/** 最近一次右键命中的会话行（单选模式的主依据）。 */
	let lastRow = null;

	/**
	 * 记录 contextmenu 命中的会话行。
	 * 用捕获阶段监听，早于 React 的 onContextMenu，不阻止原事件。
	 */
	function trackContextMenu(event) {
		try {
			const row = event.target?.closest?.(ROW);
			for (const menu of document.querySelectorAll(MENU)) {
				menu.remove();
			}
			lastRow = row || null;
		} catch {
			lastRow = null;
		}
	}

	/** 读取当前右键上下文应导出的会话 ID 列表。 */
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

	// ---------------------------------------------------------------- 导出流程
	async function api(path, init) {
		const response = await fetch(path, {
			cache: "no-store",
			credentials: "same-origin",
			...init,
			headers: {
				...(init?.body ? { "Content-Type": "application/json", "X-CST-Web-Request": "1" } : {}),
				...(init?.headers || {}),
			},
		});
		const data = await response.json().catch(() => null);
		if (!response.ok) {
			const message = data?.error?.message || `请求未完成（HTTP ${response.status}）`;
			throw new Error(message);
		}
		return data;
	}

	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	async function waitForExport(exportId, timeoutMs) {
		const deadline = Date.now() + (timeoutMs || 180000);
		let delay = 600;
		while (Date.now() < deadline) {
			const record = await api(`/api/exports/${encodeURIComponent(exportId)}`);
			if (record?.status === "completed") return record;
			if (record?.status === "failed") {
				throw new Error(record?.error?.message || "导出失败");
			}
			await sleep(delay);
			delay = Math.min(delay + 250, 2000);
		}
		throw new Error("导出超时，请稍后在 artifacts 目录查看");
	}

	async function exportOne(sessionId) {
		const idem = crypto.randomUUID();
		const created = await api(`/api/sessions/${encodeURIComponent(sessionId)}/exports`, {
			method: "POST",
			headers: { "Idempotency-Key": idem },
			body: JSON.stringify(EXPORT_OPTIONS),
		});
		const exportId = created?.id;
		if (!exportId) throw new Error("导出任务创建失败");
		return waitForExport(exportId);
	}

	async function runExport(sessionIds) {
		if (state.busy) return;
		if (!sessionIds || !sessionIds.length) {
			toast("没有可导出的会话", "error");
			window.setTimeout(clearToast, 2600);
			return;
		}
		state.busy = true;
		const total = sessionIds.length;
		let done = 0;
		const lastRecords = [];

		try {
			for (const sessionId of sessionIds) {
				toast(total > 1 ? `正在导出 ${done + 1}/${total}…` : "正在导出会话…", "info");
				const record = await exportOne(sessionId);
				lastRecords.push(record);
				done += 1;
			}

			const last = lastRecords[lastRecords.length - 1];
			let opened = false;
			if (last?.id) {
				try {
					await api(`/api/exports/${encodeURIComponent(last.id)}/open`, {
						method: "POST",
						headers: { "Idempotency-Key": crypto.randomUUID() },
						body: JSON.stringify({}),
					});
					opened = true;
				} catch {
					opened = false;
				}
			}

			const where = last?.directory ? `（${last.directory}）` : "";
			toast(`已导出 ${total} 个会话${opened ? "，已打开保存目录" : "，保存目录未能自动打开"}${where}`, "ok");
			window.setTimeout(clearToast, 6000);
		} catch (error) {
			toast(error instanceof Error && error.message ? error.message : "导出失败，请重试", "error");
			window.setTimeout(clearToast, 6000);
		} finally {
			state.busy = false;
		}
	}

	// ---------------------------------------------------------------- 菜单注入
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
			menu.remove();
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
			// 结构变化时静默跳过，绝不影响原有菜单行为。
		}
	}

	window.__cstpnExport = { runExport, targetSessionIds };

	document.addEventListener("contextmenu", trackContextMenu, true);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
