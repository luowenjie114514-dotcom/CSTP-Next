# add 分支 · 必要的后端修改

> 在优化要求下不可避免地修改了后端源码。**改动可回滚、只附加功能**，但改动原版文件是事实，请知情后使用。

## 声明

| 项目 | 说明 |
| --- | --- |
| 改动范围 | patch 全部内容 **+ `web/server/api.ts`（新增一条路由）** |
| 新增接口 | `POST /api/cstpn/sessions/import` |
| 既有功能 | 不变（只新增，不移除不改写） |
| `SHA256SUMS` | **失效**（`api.ts` 被改动） |
| 升级 CST Pilot 后 | **会被覆盖，需重新应用** |
| 回滚 | 删除新增代码即可，备份在 `patch-backup-*` |

## 安全设计

导入接口不接受客户端指定目录：目录由 `cwd` 推导且必须在会话根目录内；
`cwd` 含 `..` 直接拒绝；文件名白名单；内容逐行校验；写入用 `flag: "wx"` 防覆盖。

## 安装

```powershell
# 1. 前端与 patch 相同
.\WEB_INP\CSTPN-apply-idimp.ps1 -Target 'C:\path\to\cst-pilot'

# 2. 把 CSTPN-backend-import.ts 合并进 agent/home/extensions/web/server/api.ts
```

## 回滚

前端跑回滚脚本；后端删除 `cstpn-import.ts` 与 `api.ts` 里那两处新增。
