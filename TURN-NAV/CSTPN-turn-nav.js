/**
 * CSTP Next · 轮次导航滚动条。
 *
 * 在会话区右侧叠加一条竖向导航条：
 *   - 每一轮对话对应一个刻度
 *   - 明暗区分：当前轮最亮、最近几轮次之、更早的（未加载）更淡
 *   - 悬停刻度显示该轮的用户指令与 AI 回复摘要
 *   - 点击刻度滚动到该轮
 *
 * DOM 依据（实测确认）：
 *   .chat-loaded[data-session-id]   当前会话
 *   .conversation > .turn           每轮对话容器
 *   .conversation 是可滚动容器
 *   「显示更早的消息」按钮 .show-earlier 表示上方还有未加载轮次
 *
 * 实现约束：
 *   - 只读 DOM 与计算位置，不移动、不删除任何节点
 *   - 导航条自身绝对定位于滚动容器旁，pointer-events 只在自身
 *   - 轮次数量变化时重建刻度
 */
(() => {
	const MARK = "data-cstpn-nav";
	const STYLE_ID = "cstpn-nav-style";
	const TICK_MS = 600;
	const RECENT = 3;

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
.cstpn-nav-host{position:relative}
.cstpn-nav{position:absolute;top:50%;right:8px;transform:translateY(-50%);width:60px;z-index:20;display:flex;flex-direction:column;justify-content:center;gap:0;padding:16px 0;pointer-events:auto;max-height:86%}
.cstpn-nav::before{content:"";position:absolute;left:50%;top:10px;bottom:10px;width:3px;border-radius:2px;background:rgba(127,127,127,.18);transform:translateX(-50%)}
.cstpn-nav-mark{position:relative;flex:none;width:60px;border:none;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:20px}
.cstpn-nav-mark::after{content:"";width:18px;height:5px;border-radius:3px;background:rgba(127,127,127,.38);transition:background .14s ease,width .16s ease,height .16s ease}
.cstpn-nav-mark[data-tier="recent"]::after{background:rgba(127,127,127,.72);width:32px;height:7px}
.cstpn-nav-mark[data-tier="current"]::after{background:var(--app-send,#8ab4f8);width:52px;height:11px;box-shadow:0 0 0 1px rgba(138,180,248,.35),0 0 8px rgba(138,180,248,.45)}
.cstpn-nav-mark:hover::after{width:46px;height:9px;background:var(--app-send,#8ab4f8);opacity:.85}
.cstpn-nav-tip{position:fixed;z-index:2147000000;max-width:min(360px,70vw);padding:8px 11px;border-radius:9px;background:rgba(24,29,34,.97);color:#f2f5f7;font-size:12px;line-height:1.55;box-shadow:0 10px 26px rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.1);pointer-events:none;opacity:0;transition:opacity .12s ease}
.cstpn-nav-tip[data-show="1"]{opacity:1}
.cstpn-nav-tip .u{opacity:.62;font-size:11px;display:block;margin-bottom:3px}
.cstpn-nav-tip .q{font-weight:600;display:block;margin-bottom:4px}
.cstpn-nav-tip .a{opacity:.8;display:block}
`;
		document.head.appendChild(style);
	}

	function shorten(text, max) {
		const s = String(text ?? "").replace(/\s+/g, " ").trim();
		return s.length > max ? s.slice(0, max) + "…" : s;
	}

	function messageText(m) {
		if (!m) return "";
		if (typeof m.content === "string") return m.content;
		if (!Array.isArray(m.content)) return "";
		const parts = [];
		for (const p of m.content) {
			if (p && typeof p === "object" && p.type === "text" && typeof p.text === "string") parts.push(p.text);
		}
		return parts.join(" ");
	}

	// ---------------------------------------------------------------- 提示浮层
	let tip = null;

	function ensureTip() {
		if (tip && tip.isConnected) return tip;
		tip = document.createElement("div");
		tip.className = "cstpn-nav-tip";
		document.body.appendChild(tip);
		return tip;
	}

	function showTip(el, turnIndex, prompt, answer) {
		const t = ensureTip();
		t.textContent = "";
		const u = document.createElement("span");
		u.className = "u";
		u.textContent = `第 ${turnIndex} 轮`;
		const q = document.createElement("span");
		q.className = "q";
		q.textContent = prompt || "(无指令)";
		const a = document.createElement("span");
		a.className = "a";
		a.textContent = answer;
		t.append(u, q, a);
		t.dataset.show = "1";
		const rect = el.getBoundingClientRect();
		const tw = t.getBoundingClientRect();
		let left = rect.left - tw.width - 10;
		if (left < 8) left = rect.right + 10;
		const top = Math.max(8, Math.min(rect.top - 8, window.innerHeight - tw.height - 8));
		t.style.left = `${left}px`;
		t.style.top = `${top}px`;
	}

	function hideTip() {
		if (tip) tip.dataset.show = "0";
	}

	// ---------------------------------------------------------------- 构建
	function findScroller() {
		const conv = document.querySelector(".conversation");
		if (!conv) return null;
		if (conv.scrollHeight > conv.clientHeight + 4) return conv;
		let node = conv.parentElement;
		while (node && node !== document.body) {
			const style = getComputedStyle(node);
			if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) return node;
			node = node.parentElement;
		}
		return conv;
	}

	/**
	 * 找挂载点：必须是不随内容滚动的祖先。
	 * .conversation 自身是滚动容器，把导航条挂上去会跟着内容一起滚走，
	 * 所以改挂到 .chat-message-surface（position:relative + overflow:hidden）。
	 */
	function findAnchor() {
		const scroller = findScroller();
		if (!scroller) return null;
		if (scroller.classList.contains("conversation")) {
			return document.querySelector(".chat-message-surface") ?? scroller.parentElement;
		}
		return scroller;
	}

	function buildNav() {
		const anchor = findAnchor();
		if (!anchor) return;
		const turns = [...document.querySelectorAll(".conversation > .turn")];
		if (!turns.length) return;

		const host = anchor;
		if (getComputedStyle(host).position === "static") host.classList.add("cstpn-nav-host");

		let nav = host.querySelector(`[${MARK}]`);
		if (!nav) {
			nav = document.createElement("div");
			nav.className = "cstpn-nav";
			nav.setAttribute(MARK, "");
			host.appendChild(nav);
		}

		// 轮次数量没变就不重建
		if (nav.dataset.count === String(turns.length)) {
			markCurrent(nav, turns);
			return;
		}

		injectStyle();
		nav.textContent = "";
		nav.dataset.count = String(turns.length);

		const total = turns.length;
		turns.forEach((turn, i) => {
			const mark = document.createElement("button");
			mark.type = "button";
			mark.className = "cstpn-nav-mark";
			// 层级：最后一个是 current，往前 RECENT 个是 recent，其余 early
			const fromEnd = total - 1 - i;
			mark.dataset.tier = fromEnd === 0 ? "current" : fromEnd <= RECENT ? "recent" : "early";
			mark.setAttribute("aria-label", `第 ${i + 1} 轮`);
			// 轮次少时刻度高（自中心向上下延伸），轮次多时压缩到最小
			mark.style.minHeight = `${Math.max(18, Math.min(42, Math.floor(430 / total)))}px`;

			// 提示内容：本轮用户指令 + 首条助手回复
			const userText = messageText(turn.querySelector(".chat-message-surface, .user-message, p"));
			let prompt = "";
			const userBlock = turn.firstElementChild;
			if (userBlock) prompt = shorten(messageText(userBlock) || userBlock.textContent, 90);
			const assistantBlock = turn.querySelector(".markdown");
			const answer = assistantBlock ? shorten(assistantBlock.textContent, 110) : "(暂无回复)";

			mark.addEventListener("mouseenter", () => showTip(mark, i + 1, prompt, answer));
			mark.addEventListener("mouseleave", hideTip);
			mark.addEventListener("click", () => {
				turn.scrollIntoView({ behavior: "smooth", block: "start" });
			});

			nav.appendChild(mark);
		});

		markCurrent(nav, turns);
	}

	/**
	 * 更新刻度层级。
	 * 语义（互斥）：
	 *   current —— 当前正在阅读的那一轮（最亮、最宽）
	 *   recent  —— 距离当前 RECENT 轮以内
	 *   early   —— 更早的轮次（最淡）
	 */
	function markCurrent(nav, turns) {
		// 导航条挂在 anchor 上，滚动容器需要单独取（可能是 .conversation）
		const scroller = findScroller();
		if (!scroller) return;
		const box = scroller.getBoundingClientRect();
		let active = 0;
		turns.forEach((turn, i) => {
			const r = turn.getBoundingClientRect();
			if (r.top - box.top <= box.height * 0.34) active = i;
		});
		const marks = nav.querySelectorAll(".cstpn-nav-mark");
		marks.forEach((m, i) => {
			const distance = Math.abs(i - active);
			m.dataset.tier = distance === 0 ? "current" : distance <= RECENT ? "recent" : "early";
		});
	}

	function tick() {
		try {
			buildNav();
		} catch {
			/* 静默 */
		}
	}

	window.__cstpnNav = { tick };

	// 滚动时更新当前刻度
	document.addEventListener(
		"scroll",
		() => {
			const nav = document.querySelector(`[${MARK}]`);
			const turns = [...document.querySelectorAll(".conversation > .turn")];
			if (nav && turns.length) markCurrent(nav, turns);
			hideTip();
		},
		true,
	);

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
