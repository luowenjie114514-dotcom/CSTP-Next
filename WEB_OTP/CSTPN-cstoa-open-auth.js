/**
 * CSTP Next · CSTOA 登录卡片「使用动态码登录（CSTP Next）」入口。
 *
 * 背景：oauth-panel 在 CSTOA OAuth 模式下刻意不渲染「打开授权页面」链接
 * （源码中 x = method==="oauth" && providerId==="cstoa"，随后用 !x && 隐藏），
 * 只显示二维码。桌面端用户无手机可扫时因此没有可用入口。
 *
 * 取址方式：直接读取后端状态接口 /api/auth/cstoa/oauth/status 返回的
 * deviceCode.verificationUri——即服务端下发的 verification_uri_complete
 * （https://www.cstoa.top/#/oauth/device?code=XXXXXX），本身是官方授权页。
 * 不构造、不猜测地址，地址永远与后端一致。
 *
 * 安全性：只读 DOM 与只读 GET 状态接口，不拦截、不改写任何请求，
 * 不参与登录逻辑，失败时静默不干预原有流程。
 */
(() => {
	const STATUS = "/api/auth/cstoa/oauth/status";
	const CARD = '[data-method="cstoa"]';
	const MARK = "data-cstoa-open-auth";
	const TICK_MS = 1000;
	const FAIL_BACKOFF_MS = 15000;

	let lastFetch = 0;
	let cachedUrl = "";
	let styleDone = false;

	function injectStyle() {
		if (styleDone || document.getElementById("cstoa-open-auth-style")) return;
		styleDone = true;
		const style = document.createElement("style");
		style.id = "cstoa-open-auth-style";
		style.textContent = `
.${MARK}-btn{display:flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;width:100%;margin-top:10px;padding:9px 14px;border-radius:10px;border:1px solid rgba(26,32,36,.18);background:transparent;color:inherit;font-size:13px;font-family:inherit;line-height:1.3;text-decoration:none;cursor:pointer;opacity:.9;transition:opacity .15s ease,border-color .15s ease}
.${MARK}-btn:hover{opacity:1;border-color:rgba(26,32,36,.42)}
.${MARK}-btn:active{opacity:.7}
.${MARK}-note{margin:6px 0 0;font-size:11px;line-height:1.5;text-align:center;opacity:.55}
`;
		document.head.appendChild(style);
	}

	async function fetchAuthUrl() {
		const now = Date.now();
		if (now - lastFetch < FAIL_BACKOFF_MS && !cachedUrl) return "";
		lastFetch = now;
		try {
			const response = await fetch(STATUS, {
				method: "GET",
				headers: { Accept: "application/json" },
				credentials: "same-origin",
			});
			if (!response.ok) return "";
			const state = await response.json();
			const uri = state?.deviceCode?.verificationUri;
			if (typeof uri !== "string" || !/^https?:\/\//i.test(uri)) return "";
			cachedUrl = uri;
			return uri;
		} catch {
			return "";
		}
	}

	function render(qr, url) {
		const existing = qr.querySelector(`:scope > [${MARK}]`);
		if (existing) {
			const anchor = existing.querySelector("a[href]");
			if (anchor && anchor.getAttribute("href") !== url) anchor.setAttribute("href", url);
			return;
		}
		injectStyle();
		const group = document.createElement("div");
		group.setAttribute(MARK, "");

		const open = document.createElement("a");
		open.className = `${MARK}-btn`;
		open.setAttribute("href", url);
		open.setAttribute("target", "_blank");
		open.setAttribute("rel", "noopener noreferrer");
		open.textContent = "使用动态码登录（Next）";

		const note = document.createElement("p");
		note.className = `${MARK}-note`;
		note.textContent = "在新标签页完成 CSTOA 授权，回到本页会自动继续。";

		group.append(open, note);
		qr.appendChild(group);
	}

	async function tick() {
		try {
			if (!document.querySelector(CARD)) {
				cachedUrl = "";
				return;
			}
			const qr = document.querySelector(`${CARD} .login-qr`);
			if (!qr) return;
			const existing = qr.querySelector(`:scope > [${MARK}]`);
			if (existing && cachedUrl) {
				const anchor = existing.querySelector("a[href]");
				if (anchor && anchor.getAttribute("href") === cachedUrl) return;
			}
			const url = await fetchAuthUrl();
			if (url) render(qr, url);
		} catch {
			// 页面结构变化或接口异常时静默跳过，绝不影响登录流程。
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => void tick(), { once: true });
	} else {
		void tick();
	}
	window.setInterval(() => void tick(), TICK_MS);
})();
