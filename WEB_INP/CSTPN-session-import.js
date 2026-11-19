/**
 * CSTP Next · 会话导入（半自动：浏览器生成 + 一键复制路径）。
 *
 * 定位：放在 patch 分支。不改后端、不写文件系统，只做浏览器能安全完成的部分。
 *
 * 为什么是半自动：
 *   把对话写回 Pi 的会话目录必须落盘，而浏览器出于安全沙箱无法写入任意路径。
 *   全自动需要给后端加写接口（改 web/server/api.ts，会破坏 SHA256SUMS 校验），
 *   属于激进方案，已单独放到 add 分支。
 *
 * 本实现的便捷性：
 *   选文件 → 自动解析并生成合法的 .jsonl → 立即下载
 *   → 界面直接给出目标目录的**完整路径**并支持一键复制
 *   → 用户只需把刚下载的文件拖进那个目录（一次拖放）。
 *
 * 依据（实测所得，非猜测）：
 *   - 会话目录：%USERPROFILE%\.pi\agent\sessions\<cwd 编码目录>\
 *   - cwd 编码规则：--<去掉盘符冒号、斜杠与冒号换成横线>--
 *   - 文件名：<ISO 时间戳>_<session.id>.jsonl
 *   - 首行 type=session，其后 message 行用 id/parentId 串链
 */
(() => {
	const PANEL = "data-cstpn-import";
	const TICK_MS = 400;

	function injectStyle() {
		if (document.getElementById("cstpn-import-style")) return;
		const style = document.createElement("style");
		style.id = "cstpn-import-style";
		style.textContent = `
#cstpn-import-card{display:grid;gap:12px;padding:16px;border-radius:12px;border:1px solid var(--chat-border,rgba(127,127,127,.28));background:rgba(127,127,127,.06);margin-top:16px}
.cstpn-imp-title{margin:0;font-size:14px;font-weight:600}
.cstpn-imp-desc{margin:0;font-size:12px;line-height:1.65;opacity:.7}
.cstpn-imp-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cstpn-imp-btn{border:none;border-radius:9px;padding:8px 15px;font-size:13px;font-family:inherit;font-weight:600;cursor:pointer;background:var(--app-send,#1a2024);color:var(--app-send-icon,#fff)}
.cstpn-imp-btn:disabled{opacity:.55;cursor:default}
.cstpn-imp-btn--ghost{background:transparent;border:1px solid var(--chat-border,rgba(127,127,127,.4));color:inherit;font-weight:400}
.cstpn-imp-out{margin:0;font-size:12px;line-height:1.7;padding:10px 12px;border-radius:9px;background:rgba(127,127,127,.12);word-break:break-all;white-space:pre-wrap}
.cstpn-imp-err{color:#bf091b}
.cstpn-imp-path{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.cstpn-imp-path code{flex:1;min-width:0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;padding:7px 9px;border-radius:7px;background:rgba(127,127,127,.18);word-break:break-all}
.cstpn-imp-steps{margin:0;padding-left:18px;font-size:12px;line-height:1.8;opacity:.8}
`;
		document.head.appendChild(style);
	}

	// ---------------------------------------------------------------- 目录推导
	/**
	 * 复刻 Pi 的会话目录命名规则（用真实目录名反推验证过）：
	 *   "--" + cwd 中所有 / \ : 替换为 "-" + "--"
	 * 例：C:\Users\A\proj → --C--Users-A-proj--
	 * 注意：不要先剥掉开头的分隔符，否则会少一个横线。
	 */
	function sessionDirFor(cwd) {
		return `--${String(cwd).replace(/[/\\:]/g, "-")}--`;
	}

	// ---------------------------------------------------------------- 解析
	function normalizeMessage(raw) {
		if (!raw || typeof raw !== "object") return null;
		const role = raw.role;
		if (!["user", "assistant", "toolResult", "system"].includes(role)) return null;
		let content = raw.content;
		if (typeof content === "string") content = content ? [{ type: "text", text: content }] : [];
		if (!Array.isArray(content)) return null;
		const parts = [];
		for (const part of content) {
			if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
				parts.push({ type: "text", text: part.text });
			}
		}
		if (!parts.length) return null;
		return {
			role,
			content: parts,
			timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
		};
	}

	function parseInput(text) {
		const trimmed = text.trim();
		if (!trimmed) throw new Error("文件为空");

		// 先按 JSONL 试
		const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
		if (lines.length > 1) {
			const objects = [];
			let allJson = true;
			for (const line of lines) {
				try {
					objects.push(JSON.parse(line));
				} catch {
					allJson = false;
					break;
				}
			}
			if (allJson) {
				const header = objects.find((o) => o?.type === "session");
				const msgs = objects.filter((o) => o?.type === "message" && o.message).map((o) => o.message);
				if (msgs.length) {
					return { title: header?.title ?? "", messages: msgs, cwd: header?.cwd };
				}
			}
		}

		let data;
		try {
			data = JSON.parse(trimmed);
		} catch {
			throw new Error("不是合法的 JSON / JSONL 文件");
		}
		const one = Array.isArray(data) ? data[0] : data;
		if (!one || typeof one !== "object") throw new Error("文件内容不是对象");
		if (!Array.isArray(one.messages)) throw new Error("缺少 messages 数组，无法识别为会话记录");
		return { title: one.title ?? one.id ?? "", messages: one.messages, cwd: one.cwd };
	}

	// ---------------------------------------------------------------- 生成
	function randomId() {
		return Math.random().toString(16).slice(2, 10);
	}

	function buildJsonl(parsed, cwdOverride) {
		const messages = parsed.messages.map(normalizeMessage).filter(Boolean);
		if (!messages.length) throw new Error("没有可导入的文本消息（仅支持 user / assistant 的文本内容）");

		const sessionId = crypto.randomUUID();
		const now = new Date();
		const iso = now.toISOString();
		// cwd 决定会话落在哪个项目目录下。优先用界面传入的当前 cwd，
		// 其次用导出文件里的 cwd；都没有时留空由使用者填写。
		const cwd = cwdOverride || parsed.cwd || "";
		const lines = [];
		lines.push(JSON.stringify({ type: "session", version: 3, id: sessionId, timestamp: iso, cwd }));

		let parentId = null;
		for (const m of messages) {
			const id = randomId();
			lines.push(
				JSON.stringify({
					type: "message",
					id,
					parentId,
					timestamp: new Date(m.timestamp).toISOString(),
					message: { role: m.role, content: m.content, timestamp: m.timestamp },
				}),
			);
			parentId = id;
		}

		const stamp = iso.replace(/:/g, "-").replace(/\.(\d{3})Z$/, "-$1Z");
		return {
			text: lines.join("\n") + "\n",
			sessionId,
			fileName: `${stamp}_${sessionId}.jsonl`,
			cwd,
			count: messages.length,
		};
	}

	function saveFile(content, filename) {
		const blob = new Blob([content], { type: "application/x-ndjson;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.rel = "noopener";
		a.style.display = "none";
		document.body.appendChild(a);
		a.click();
		window.setTimeout(() => {
			try {
				a.remove();
			} catch {
				/* 忽略 */
			}
			URL.revokeObjectURL(url);
		}, 2000);
	}

	async function copyText(text) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}

	// ---------------------------------------------------------------- 卡片
	function buildCard() {
		const card = document.createElement("section");
		card.id = "cstpn-import-card";
		card.setAttribute(PANEL, "");

		const title = document.createElement("h3");
		title.className = "cstpn-imp-title";
		title.textContent = "导入会话记录（Next）";

		const desc = document.createElement("p");
		desc.className = "cstpn-imp-desc";
		desc.textContent =
			"选择「导出（Next）」生成的 .json 文件，浏览器内转换为 Pi 会话文件并下载，随后把它拖进下方目录即可继续对话。全程不写本地文件。";

		const row = document.createElement("div");
		row.className = "cstpn-imp-row";

		// 目标项目路径：决定导入的会话挂在哪个项目下
		const cwdField = document.createElement("label");
		cwdField.className = "cstpn-imp-desc";
		cwdField.style.cssText = "display:grid;gap:5px;width:100%";
		const cwdLabel = document.createElement("span");
		cwdLabel.textContent = "目标项目目录（会话会出现在这个项目的会话列表里）";
		const cwdInput = document.createElement("input");
		cwdInput.type = "text";
		cwdInput.placeholder = "C:\\Users\\ANWEN\\Desktop\\cst-pilot";
		cwdInput.style.cssText =
			"box-sizing:border-box;width:100%;padding:8px 11px;border-radius:8px;border:1px solid var(--chat-border,rgba(127,127,127,.4));background:transparent;color:inherit;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace";
		cwdField.append(cwdLabel, cwdInput);

		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json,.jsonl,application/json";
		input.hidden = true;

		const pick = document.createElement("button");
		pick.type = "button";
		pick.className = "cstpn-imp-btn";
		pick.textContent = "选择文件并转换";
		pick.addEventListener("click", () => input.click());

		row.append(pick, input);

		const out = document.createElement("p");
		out.className = "cstpn-imp-out";
		out.hidden = true;

		const pathWrap = document.createElement("div");
		pathWrap.className = "cstpn-imp-path";
		pathWrap.hidden = true;
		const pathCode = document.createElement("code");
		const copyBtn = document.createElement("button");
		copyBtn.type = "button";
		copyBtn.className = "cstpn-imp-btn cstpn-imp-btn--ghost";
		copyBtn.textContent = "复制目录";
		copyBtn.addEventListener("click", async () => {
			const ok = await copyText(pathCode.textContent ?? "");
			copyBtn.textContent = ok ? "已复制" : "复制失败";
			window.setTimeout(() => {
				copyBtn.textContent = "复制目录";
			}, 1800);
		});
		pathWrap.append(pathCode, copyBtn);

		const steps = document.createElement("ol");
		steps.className = "cstpn-imp-steps";
		steps.hidden = true;

		input.addEventListener("change", async () => {
			const file = input.files?.[0];
			if (!file) return;
			out.hidden = true;
			pathWrap.hidden = true;
			steps.hidden = true;
			pick.disabled = true;
			pick.textContent = "正在转换…";
			try {
				const text = await file.text();
				const parsed = parseInput(text);
				const cwd = cwdInput.value.trim() || parsed.cwd || "";
				if (!cwd) throw new Error("请先填写目标项目目录");
				const built = buildJsonl(parsed, cwd);
				saveFile(built.text, built.fileName);

				out.hidden = false;
				out.classList.remove("cstpn-imp-err");
				out.textContent = `已生成 ${built.count} 条消息\n${built.fileName}\n（已开始下载）`;

				const dir = sessionDirFor(built.cwd);
				const full = `%USERPROFILE%\\.pi\\agent\\sessions\\${dir}`;
				pathCode.textContent = full;
				pathWrap.hidden = false;

				steps.hidden = false;
				steps.textContent = "";
				for (const t of [
					"把刚下载的 .jsonl 拖进上面这个目录（不存在就新建）。",
					"回到 CST Pilot，切到「会话」列表并刷新（或重启程序）。",
					"新会话会出现在列表里，打开即可继续提问。",
				]) {
					const li = document.createElement("li");
					li.textContent = t;
					steps.appendChild(li);
				}
			} catch (error) {
				out.hidden = false;
				out.classList.add("cstpn-imp-err");
				out.textContent = error instanceof Error ? error.message : "转换失败";
			} finally {
				pick.disabled = false;
				pick.textContent = "选择文件并转换";
				input.value = "";
			}
		});

		// 只校验
		const check = document.createElement("button");
		check.type = "button";
		check.className = "cstpn-imp-btn cstpn-imp-btn--ghost";
		check.textContent = "仅校验";
		const checkInput = document.createElement("input");
		checkInput.type = "file";
		checkInput.accept = ".json,.jsonl,application/json";
		checkInput.hidden = true;
		check.addEventListener("click", () => checkInput.click());
		checkInput.addEventListener("change", async () => {
			const file = checkInput.files?.[0];
			if (!file) return;
			try {
				const parsed = parseInput(await file.text());
				const valid = parsed.messages.map(normalizeMessage).filter(Boolean);
				out.hidden = false;
				out.classList.remove("cstpn-imp-err");
				out.textContent = `格式有效：共 ${parsed.messages.length} 条消息，可导入 ${valid.length} 条文本消息。`;
			} catch (error) {
				out.hidden = false;
				out.classList.add("cstpn-imp-err");
				out.textContent = error instanceof Error ? error.message : "校验失败";
			} finally {
				checkInput.value = "";
			}
		});
		row.append(check, checkInput);

		const note = document.createElement("p");
		note.className = "cstpn-imp-desc";
		note.textContent = "仅导入文本消息；图片与工具调用参数会被忽略。";

		card.append(title, desc, cwdField, row, out, pathWrap, steps, note);
		return card;
	}

	// ---------------------------------------------------------------- 挂载
	function mount() {
		const existing = document.getElementById("cstpn-import-card");
		const page = document.querySelector("main.settings, .settings-page, [class*='settings-workspace']");
		if (!page) return;

		const text = page.textContent || "";
		const isGeneral = text.includes("界面主题") || text.includes("外观");
		if (!isGeneral) {
			// 离开常规页时移除，避免出现在别的分页
			if (existing?.isConnected) existing.remove();
			return;
		}
		if (existing?.isConnected) return;

		injectStyle();
		let host = null;
		for (const c of page.querySelectorAll(".settings-card")) {
			if ((c.textContent || "").includes("界面主题")) host = c;
		}
		const card = buildCard();
		if (host?.parentElement) host.parentElement.insertBefore(card, host.nextSibling);
		else page.appendChild(card);
	}

	function tick() {
		try {
			mount();
		} catch {
			/* 静默跳过 */
		}
	}

	window.__cstpnImport = { parseInput, buildJsonl, sessionDirFor };

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", tick, { once: true });
	} else {
		tick();
	}
	window.setInterval(tick, TICK_MS);
})();
