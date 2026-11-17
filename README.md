# add 分支 · 必要的后端修改

> 在优化要求下不可避免地修改了后端源码。**改动可回滚、只附加功能**，但改动原版文件是事实，请知情后使用。

## 本分支只含增量

前端补丁全部在 [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) 分支。
**使用本分支前请先安装 patch**。

本分支唯一内容：

| 文件 | 说明 |
| --- | --- |
| `WEB_INP/CSTPN-backend-import.ts` | 全自动导入的后端接口 |

## 接入方式

```powershell
# 1. 先装 patch 的 WEB_INP（提供前端部分）
.\patch\WEB_INP\CSTPN-apply-idimp.ps1 -Target 'C:\path\to\cst-pilot'

# 2. 把 CSTPN-backend-import.ts 合并进 api.ts：
#    agent/home/extensions/web/server/api.ts
```

合并点（两处）：

```ts
import { createCstpnImportRoutes } from "./cstpn-import.ts";
const cstpnImport = createCstpnImportRoutes();
// 路由入口：
if (await cstpnImport.route(request, response, pathname, method)) return true;
```

## 声明

| 项目 | 说明 |
| --- | --- |
| 改动范围 | `web/server/api.ts`（新增一条路由）+ 新增 `cstpn-import.ts` |
| 新增接口 | `POST /api/cstpn/sessions/import` |
| 既有功能 | 不变（只新增，不移除不改写） |
| `SHA256SUMS` | **失效**（`api.ts` 被改动） |
| 升级 CST Pilot 后 | **会被覆盖，需重新应用** |

## 安全设计

导入接口不接受客户端指定目录：目录由 `cwd` 推导且必须在会话根目录内；
`cwd` 含 `..` 直接拒绝；文件名白名单；内容逐行校验；写入用 `flag: "wx"` 防覆盖。

## 回滚

删除 `cstpn-import.ts` 与 `api.ts` 里那两处新增即可（只新增不修改，回滚即删除）。
