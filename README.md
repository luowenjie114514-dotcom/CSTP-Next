# add 分支 · 必要的后端修改

> **本分支在优化要求下，不可避免地修改了 CST Pilot 的后端源码。**
>
> ⚠️ **改动是可回滚的，且只附加功能**——不移除、不改写任何既有行为。
> 但**改动原版文件**不变，请知情后再使用。

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
