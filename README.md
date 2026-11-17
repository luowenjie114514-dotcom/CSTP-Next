# add 分支 · 全自动方案（⚠️ 激进改动）

本分支存放**需要修改 CST Pilot 后端**的补丁。

> 若可接受「多一步拖放换取零风险」，请优先使用
> [`patch` 分支](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) 的半自动版本。

## 与 patch 分支的区别

| | patch 分支（半自动） | add 分支（本分支，全自动） |
| --- | --- | --- |
| 用户操作 | 选文件 → 拖进目录 | 选文件 → 完成 |
| 是否改后端 | **否** | **是**（新增 `api.ts` 路由） |
| SHA256SUMS | 保持有效 | **失效** |
| 升级后 | 通常保留 | **会被覆盖，需重新应用** |
| 安全面 | 浏览器内闭环 | 多一条「浏览器写本地文件」通道 |

## 本分支内容

### `CSTPN-backend-import.ts`

为 Web 后端新增一个受控的导入接口：

```
POST /api/cstpn/sessions/import
{
  "cwd": "C:\\Users\\A\\proj",
  "sessionId": "<UUID>",
  "fileName": "<时间戳>_<UUID>.jsonl",
  "content": "<JSONL 文本>"
}
→ { imported: true, directory, fileName, sessionId }
```

### 安全设计

- **不接受客户端指定目录**：目标目录由 `cwd` 按 Pi 规则推导
- 推导结果必须位于会话根目录之内（越界即 400）
- `cwd` 含 `..` 直接拒绝
- 文件名按白名单 `^[0-9A-Za-z._-]+\.jsonl$` 校验，且必须包含 `sessionId`
- 内容逐行校验：必须 `type=session` 开头、`id` 为 UUID、`cwd` 非空、至少一条 `message`
- 请求体上限 4 MiB；写入用 `flag: "wx"` 防覆盖
- 会话根目录可用 `CSTPN_SESSIONS_ROOT` 覆盖（便于测试）

## 安装方式

需要手工把 `CSTPN-backend-import.ts` 的内容接进：

1. `agent/home/extensions/web/server/api.ts`
   - `import { createCstpnImportRoutes } from "./cstpn-import.ts";`
   - 在路由入口处调用 `await cstpnImport.route(request, response, pathname, method)`
2. 前端改用该接口提交（不再需要拖放步骤）

> 由于改动涉及原版文件，升级 CST Pilot 后必须重新应用。

## 为什么单独放一个分支

改后端会破坏 `SHA256SUMS` 完整性校验，且升级即失效。
把风险隔离在独立分支，主线的 `patch` 始终保持「不碰后端」的克制。
