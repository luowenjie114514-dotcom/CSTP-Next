/**
 * CSTP Next [test] · 消息时间戳与轮次耗时。
 *
 * 依据（实测确认）：
 *   - 聊天区 `.conversation` / `.turn`，每条消息 `.chat-message-surface`
 *   - 会话快照接口 GET /api/sessions/<id> 返回的 entries[].message.timestamp 是毫秒数
 *   - 会话行带 [data-session-id]，聊天区有 .chat-loaded[data-session-id]
 *
 * 功能：
 *   在每条消息右下角显示：
 *     - 绝对时间（HH:mm）
 *     - 与上一条消息的间隔（如 +2.4s / +1m12s）
 *
 * 实现约束：
 *   - 只追加一个 span，不删除/替换任何节点
 *   - 时间数据来自接口快照，按顺序与消息元素对齐；对不齐就不显示（宁缺勿错）
 *   - 幂等标记，重复扫描不重复插入
 */
(() => {
	const MARK = "data-cstpn-time";
	const STYLE_ID = "cstpn-time-style";
	const TICK_MS = 800;

	/** sessionId -> 消息时间戳数组（按显示顺序）。 */
	const cache = new Map();
	let fetching = new Set();

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
.cstpn-time{display:inline-flex;align-items:center;gap:6px;margin-top:2px;font-size:11px;line-height:1.4;opacity:.42;font-family:ui-monospace,Menlo,Consolas,monospace;user-select:none}
.cstpn-time .gap{opacity:.7}
`;
		document.head.appendChild(style);
	}

	function pad(n) {
		return String(n).padStart(2, "0");
	}

	function clockOf(ts) {
		const d = new Date(ts);
		return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function gapOf(ms) {
		if (!Number.isFinite(ms) || ms <= 0) return "";
		if (ms < 1000) return `+${ms}ms`;
		if (ms < 60_000) return `+${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
		const m = Math.floor(ms / 60_000);
		const s = Math.round((ms % 60_000) / 1000);
		return `+${m}m${s ? `${s}s` : ""}`;
	}

	async function fetchTimes(sessionId) {
		if (cache.has(sessionId) || fetching.has(sessionId)) return;
		fetching.add(sessionId);
		try {
			const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
				cache: "no-store",
				credentials: "same-origin",
			});
			if (!res.ok) return;
			const data = await res.json();
			const entries = Array.isArray(data?.entries) ? data.entries : [];
			const times = [];
			for (const e of entries) {
				const m = e?.message ?? e;
				if (!m || typeof m !== "object") continue;
				if (typeof m.timestamp === "number") times.push(m.timestamp);
			}
			cache.set(sessionId, times);
		} catch {
			/* 静默 */
		} finally {
			fetching.delete(sessionId);
		}
	}

	function applyToChat() {
		const loaded = document.querySelector(".chat-loaded[data-session-id]");
		if (!loaded) return;
		const sessionId = loaded.getAttribute("data-session-id");
		if (!sessionId) return;
		if (!cache.has(sessionId)) {
			void fetchTimes(sessionId);
			return;
		}
		const times = cache.get(sessionId);
		const surfaces = loaded.querySelectorAll(".chat-message-surface, .turn");
		// 只有当元素数与时间戳数接近时才对齐，避免错位显示
		const targets = [...surfaces].filter((el) => !el.querySelector(`[${MARK}]`));
		if (!targets.length) return;
		if (Math.abs(times.length - surfaces.length) > 2) return;

		injectStyle();
		let prev = null;
		for (let i = 0; i < surfaces.length; i += 1) {
			const el = surfaces[i];
			const ts = times[i];
			if (typeof ts !== "number") continue;
			if (el.querySelector(`[${MARK}]`)) {
				prev = ts;
				continue;
			}
			const span = document.createElement("span");
			span.className = "cstpn-time";
			span.setAttribute(MARK, "");
			const clock = document.createElement("span");
			clock.textContent = clockOf(ts);
			span.appendChild(clock);
			const gap = prev === null ? "" : gapOf(ts - prev);
			if (gap) {
				const g = document.createElement("span");
				g.className = "gap";
				g.textContent = gap;
				span.appendChild(g);
			}
			// 追加到消息末尾；找不到合适容器就跳过，不强行插入
			const host = el.querySelector(".markdown") ?? el;
			host.appendChild(span);
			prev = ts;
		}
	}

	function tick() {
		try {
			applyToChat();
		} catch {
			/* 静默 */
		}
	}

	window.__cstpnTime = { clockOf, gapOf, cache };

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
