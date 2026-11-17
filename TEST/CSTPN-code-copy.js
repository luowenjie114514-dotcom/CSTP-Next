/**
 * CSTP Next [test] · 代码块增强：一键复制 + 语言标签。
 *
 * 目标 DOM 依据（实测确认）：
 *   markdown 渲染器输出标准 `<pre><code class="language-xxx hljs">`
 *   CSS 里存在 .code-block / .markdown / .turn / .conversation
 *
 * 功能：
 *   1. 每个代码块右上角浮出「复制」按钮，点击复制原始代码文本
 *   2. 显示语言标签（从 class="language-xxx" 提取）
 *   3. 悬停才显现，不干扰阅读
 *
 * 实现约束（前几轮踩过的坑）：
 *   - 代码块由 React 渲染，**绝不删除/替换既有节点**，只追加按钮
 *   - 按钮带幂等标记，MutationObserver 触发时不重复添加
 *   - 复制内容取 textContent（保留原始换行），不取 innerText（避免高亮拆分）
 *   - 所有逻辑 try/catch 包裹，异常静默，不影响阅读
 */
(() => {
	const BTN = "data-cstpn-copy";
	const STYLE_ID = "cstpn-code-style";
	const TICK_MS = 500;

	function injectStyle() {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = `
.cstpn-pre{position:relative}
.cstpn-copy{position:absolute;top:8px;right:8px;z-index:2;display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:7px;border:1px solid rgba(127,127,127,.32);background:rgba(24,29,34,.82);color:#e8ecef;font-size:11px;line-height:1.4;font-family:inherit;cursor:pointer;opacity:0;transition:opacity .14s ease,background .14s ease;backdrop-filter:blur(4px);white-space:nowrap}
.cstpn-pre:hover .cstpn-copy,.cstpn-copy:focus-visible{opacity:1}
.cstpn-copy:hover{background:rgba(24,29,34,.96)}
.cstpn-copy[data-done="1"]{background:rgba(22,74,52,.95);border-color:rgba(74,222,128,.42)}
.cstpn-copy .cstpn-lang{opacity:.6;font-family:ui-monospace,Menlo,Consolas,monospace}
`;
		document.head.appendChild(style);
	}

	async function copyText(text) {
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(text);
				return true;
			}
		} catch {
			/* 回退 */
		}
		try {
			const ta = document.createElement("textarea");
			ta.value = text;
			ta.setAttribute("readonly", "");
			ta.style.cssText = "position:fixed;left:-9999px;top:0";
			document.body.appendChild(ta);
			ta.select();
			const ok = document.execCommand("copy");
			ta.remove();
			return ok;
		} catch {
			return false;
		}
	}

	/** 从 code 的 class 里取语言名，如 language-ts / hljs。 */
	function languageOf(code) {
		const cls = code.className || "";
		const m = /language-([\w+-]+)/.exec(cls);
		if (m) return m[1];
		return "";
	}

	/** 复制用的原始文本：每个高亮 span 会插入换行，用 textContent 保持源码原貌。 */
	function sourceText(code) {
		return code.textContent ?? "";
	}

	function decorate(pre) {
		if (pre.querySelector(`[${BTN}]`)) return;
		const code = pre.querySelector("code");
		if (!code) return;

		injectStyle();
		pre.classList.add("cstpn-pre");

		const lang = languageOf(code);
		const button = document.createElement("button");
		button.type = "button";
		button.className = "cstpn-copy";
		button.setAttribute(BTN, "");
		button.setAttribute("aria-label", lang ? `复制 ${lang} 代码` : "复制代码");

		const label = document.createElement("span");
		label.textContent = "复制";
		button.appendChild(label);

		if (lang) {
			const tag = document.createElement("span");
			tag.className = "cstpn-lang";
			tag.textContent = lang;
			button.appendChild(tag);
		}

		button.addEventListener("click", async (event) => {
			event.preventDefault();
			event.stopPropagation();
			const ok = await copyText(sourceText(code));
			label.textContent = ok ? "已复制" : "失败";
			button.dataset.done = ok ? "1" : "0";
			window.setTimeout(() => {
				label.textContent = "复制";
				delete button.dataset.done;
			}, 1600);
		});

		pre.appendChild(button);
	}

	function scan() {
		try {
			for (const pre of document.querySelectorAll(".markdown pre, .turn pre, .conversation pre")) {
				decorate(pre);
			}
		} catch {
			/* 静默 */
		}
	}

	window.__cstpnCodeCopy = { scan, languageOf };

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", scan, { once: true });
	} else {
		scan();
	}
	window.setInterval(scan, TICK_MS);
})();
