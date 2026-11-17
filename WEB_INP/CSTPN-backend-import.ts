/**
 * CSTP Next [add 分支 / 全自动方案] · 会话导入后端接口。
 *
 * ⚠️ 风险说明（务必先读）
 * 本文件是「激进方案」的一部分：直接给 web/server/api.ts 增加写接口，
 * 让浏览器可以把导入的会话直接写进 Pi 的会话目录。
 *
 * 代价：
 *   1. 会修改 SHA256SUMS 覆盖的原版文件，完整性校验不再通过；
 *   2. 升级 CST Pilot 后本补丁会被覆盖，需要重新应用；
 *   3. 新增了一条「从浏览器写本地文件」的通道，安全面变大。
 *
 * 因此与半自动方案（patch 分支）分开维护：
 *   - patch 分支：浏览器生成 + 拖入目录，零风险，可随升级保留；
 *   - add 分支（本文件）：全自动，一步到位，但有上述代价。
 *
 * 接口设计要点：
 *   - 只接受 POST /api/cstpn/sessions/import；
 *   - 只写 .jsonl 到 Pi 会话目录，路径由服务端按 cwd 推导，不接受任意路径；
 *   - 文件名与内容经严格校验，拒绝路径穿越；
 *   - 内容和文件名都必须符合 Pi 的会话格式，否则 400。
 */

import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { body, send } from "./http.ts";

/** Pi 的会话根目录。 */
function sessionsRoot(): string {
	const override = process.env.CSTPN_SESSIONS_ROOT?.trim();
	if (override) return override;
	return join(homedir(), ".pi", "agent", "sessions");
}

/**
 * 复刻 Pi 的会话目录命名规则（用真实目录名反推验证过）：
 *   "--" + cwd 中所有 / \ : 替换为 "-" + "--"
 * 例：C:\Users\A\proj → --C--Users-A-proj--
 *
 * 安全性：会话目录是 join(root, 该名)，而该名中不含任何路径分隔符，
 * 因此天然无法越出 root。但仍显式拒绝包含 ".." 的输入，
 * 避免生成语义可疑的目录名。
 */
export function sessionDirFor(cwd: string): string {
	const raw = String(cwd);
	if (raw.includes("..")) throw new Error("目标项目目录不能包含 ..");
	return `--${raw.replace(/[/\\:]/g, "-")}--`;
}

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const FILE_NAME = /^[0-9A-Za-z._-]+\.jsonl$/;

interface ImportInput {
	cwd?: unknown;
	sessionId?: unknown;
	fileName?: unknown;
	content?: unknown;
}

/** 逐行校验 JSONL 结构，返回错误信息或 null。 */
function validateJsonl(content: string): string | null {
	const lines = content.split(/\r?\n/).filter((l) => l.trim());
	if (!lines.length) return "内容为空";

	let header: Record<string, unknown> | null = null;
	let messageCount = 0;

	for (const line of lines) {
		let value: unknown;
		try {
			value = JSON.parse(line);
		} catch {
			return "存在无法解析的行";
		}
		if (!value || typeof value !== "object" || Array.isArray(value)) return "行内容不是对象";
		const record = value as Record<string, unknown>;
		const type = record.type;
		if (type === "session") {
			if (header) return "出现多个 session 头";
			if (typeof record.id !== "string" || !UUID.test(record.id)) return "session.id 不是合法 UUID";
			if (typeof record.cwd !== "string" || !record.cwd) return "session.cwd 缺失";
			header = record;
		} else if (type === "message") {
			const message = record.message;
			if (!message || typeof message !== "object") return "message 行缺少 message 字段";
			const role = (message as Record<string, unknown>).role;
			if (typeof role !== "string") return "message.role 缺失";
			messageCount += 1;
		}
	}

	if (!header) return "缺少 type=session 的首行";
	if (!messageCount) return "没有任何 message 行";
	return null;
}

export function createCstpnImportRoutes(options: { sessionsRoot?: string } = {}) {
	const root = options.sessionsRoot ?? sessionsRoot();

	const route = async (
		request: IncomingMessage,
		response: ServerResponse,
		pathname: string,
		method: string,
	): Promise<boolean> => {
		if (pathname !== "/api/cstpn/sessions/import") return false;
		if (method !== "POST") {
			send(response, 405, { error: { code: "method_not_allowed", message: "只接受 POST" } });
			return true;
		}

		let input: ImportInput;
		try {
			input = (await body(request, 4 * 1024 * 1024)) as ImportInput;
		} catch {
			send(response, 400, { error: { code: "bad_request", message: "请求体不是合法 JSON" } });
			return true;
		}

		const { cwd, sessionId, fileName, content } = input;

		// ---- 参数校验：全部按白名单 ----
		if (typeof cwd !== "string" || !cwd.trim() || cwd.length > 512) {
			send(response, 400, { error: { code: "bad_cwd", message: "目标项目目录无效" } });
			return true;
		}
		if (cwd.includes("\0")) {
			send(response, 400, { error: { code: "bad_cwd", message: "目标项目目录含非法字符" } });
			return true;
		}
		if (typeof sessionId !== "string" || !UUID.test(sessionId)) {
			send(response, 400, { error: { code: "bad_session_id", message: "会话 ID 必须是 UUID" } });
			return true;
		}
		if (typeof fileName !== "string" || !FILE_NAME.test(fileName) || fileName.includes("..")) {
			send(response, 400, { error: { code: "bad_file_name", message: "文件名非法" } });
			return true;
		}
		if (typeof content !== "string" || !content.trim()) {
			send(response, 400, { error: { code: "bad_content", message: "内容为空" } });
			return true;
		}

		// ---- 内容结构校验 ----
		const invalid = validateJsonl(content);
		if (invalid) {
			send(response, 400, { error: { code: "invalid_jsonl", message: invalid } });
			return true;
		}

		// 文件名里的 UUID 必须与内容里的 session.id 一致（Pi 的约定）
		if (!fileName.includes(sessionId)) {
			send(response, 400, { error: { code: "id_mismatch", message: "文件名与会话 ID 不一致" } });
			return true;
		}

		// ---- 目录推导与写入（不接受客户端给路径）----
		let directory: string;
		try {
			directory = join(root, sessionDirFor(cwd));
		} catch (error) {
			send(response, 400, {
				error: { code: "bad_cwd", message: (error as Error).message },
			});
			return true;
		}
		// 防御：推导结果必须仍在 root 之内
		if (!directory.startsWith(root)) {
			send(response, 400, { error: { code: "bad_cwd", message: "目录越界" } });
			return true;
		}

		const target = join(directory, fileName);
		try {
			await mkdir(directory, { recursive: true });
			await writeFile(target, content, { encoding: "utf8", flag: "wx" });
		} catch (error) {
			const code = (error as { code?: string }).code;
			if (code === "EEXIST") {
				send(response, 409, { error: { code: "exists", message: "目标文件已存在，请重试" } });
				return true;
			}
			send(response, 500, {
				error: { code: "write_failed", message: `写入失败：${(error as Error).message}` },
			});
			return true;
		}

		send(response, 200, { imported: true, directory, fileName, sessionId });
		return true;
	};

	return { route, sessionDirFor };
}
