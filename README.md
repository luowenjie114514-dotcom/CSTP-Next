# add 分支 · 必要的后端修改

> **本分支在优化要求下，不可避免地修改了 CST Pilot 的后端源码。**
>
> ⚠️ **改动是可回滚的，且只附加功能**——不移除、不改写任何既有行为。
> 但**改动原版文件就是改动原版文件**，请知情后再使用。

---

## 声明

| 项目 | 说明 |
| --- | --- |
| 改动范围 | 前端静态资源 **+ `web/server/api.ts`（新增一条路由）** |
| 是否触碰后端 | **是** |
| 是否新增接口 | **是**：`POST /api/cstpn/sessions/import` |
| 既有功能是否改变 | **否**，只新增，不移除也不改写 |
| 是否可回滚 | **是**，回滚脚本 + 备份可精确还原 |
| `SHA256SUMS` 校验 | **失效**（`api.ts` 被改动） |
| 升级 CST Pilot 后 | **会被覆盖，必须重新应用本补丁** |

---

## 为什么必须改后端

「导入会话并继续对话」需要把对话写回 Pi 的会话目录：

```
~/.pi/agent/sessions/<cwd 编码目录>/<时间戳>_<UUID>.jsonl
```

这是**文件系统写入**。浏览器出于安全沙箱，无法写入用户任意路径。

- **`patch` 分支**：让浏览器生成文件 → 用户手动拖进目录（半自动，不碰后端）
- **`add` 分支（本分支）**：给后端开一个受控写接口 → 一步完成（全自动）

严格说，全自动**不可能**在不改后端的前提下实现。

---

## 改了什么

只新增一个文件 + 一处挂载：

### 1. 新增 `web/server/cstpn-import.ts`

```ts
POST /api/cstpn/sessions/import
{
  "cwd": "C:\\Users\\A\\proj",
  "sessionId": "<UUID>",
  "fileName": "<时间戳>_<UUID>.jsonl",
  "content": "<JSONL 文本>"
}
→ { imported: true, directory, fileName, sessionId }
```

### 2. 在 `web/server/api.ts` 里挂载

```ts
import { createCstpnImportRoutes } from "./cstpn-import.ts";
const cstpnImport = createCstpnImportRoutes();
// 路由入口处：
if (await cstpnImport.route(request, response, pathname, method)) return true;
```

> 就这两处，没有动任何既有逻辑。

---

## 安全设计

| 措施 | 说明 |
| --- | --- |
| 不接受客户端目录 | 目标目录由 `cwd` 按 Pi 规则**推导**，客户端不能指定路径 |
| 越界检查 | 推导结果必须位于会话根目录之内，否则 400 |
| `..` 直接拒绝 | `cwd` 含 `..` 立即报错，不生成可疑目录名 |
| 文件名白名单 | `^[0-9A-Za-z._-]+\.jsonl$`，且必须包含 `sessionId` |
| 内容逐行校验 | 必须 `type=session` 开头、`id` 为 UUID、`cwd` 非空、至少一条 `message` |
| 覆盖保护 | 写入用 `flag: "wx"`，已存在即 409 |
| 请求体上限 | 4 MiB |
| 根目录可覆盖 | `CSTPN_SESSIONS_ROOT` 环境变量（便于测试，亦可收紧） |

即便有这些措施，**它仍是一条「从浏览器写本地文件」的通道**，
扩大了安全面。这是全自动必须付出的代价。

---

## 本分支能做什么

与 `patch` 相同的全部前端优化，**外加**全自动导入：

| 目录 | 功能 |
| --- | --- |
| [`WEB_EXP`](WEB_EXP) | 会话导出（与 patch 相同） |
| [`WEB_ID`](WEB_ID) | 会话 ID 显示与复制（与 patch 相同） |
| [`WEB_INP`](WEB_INP) | 会话导入 —— **额外提供 `CSTPN-backend-import.ts`** |
| [`WEB_OTP`](WEB_OTP) | 登录相关（与 patch 相同） |

---

## 安装

前端部分与 `patch` 相同。后端接口需手工接入：

```powershell
# 1. 先按 patch 的方式装好前端
.\WEB_INP\CSTPN-apply-idimp.ps1 -Target 'C:\path\to\cst-pilot'

# 2. 把 CSTPN-backend-import.ts 的内容合并进：
#    agent/home/extensions/web/server/api.ts
#    （按上文「改了什么」的两处位置）
```

---

## 回滚

```powershell
# 前端
.\WEB_INP\CSTPN-rollback-idimp.ps1 -Target 'C:\path\to\cst-pilot'

# 后端：删掉 cstpn-import.ts，以及 api.ts 里那两处新增即可
# 备份在 cst-pilot\patch-backup-* 下
```

由于只新增、不修改既有逻辑，回滚只需要**删除**，不涉及恢复被改写的代码。

---

## 该选哪个分支

| 你的情况 | 选择 |
| --- | --- |
| 不想动后端、能接受多一步拖放 | **[`patch`](../tree/patch)** ← 推荐 |
| 需要一步到位的全自动导入，接受上述代价 | **本分支（`add`）** |
| 想尝鲜新功能、能接受不稳定 | [`test`](../tree/test) |
