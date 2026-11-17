# WEB_OTP

为 CST Pilot 的 **Web 端**增加了**六位动态码（TOTP）支持**。

## 文件

| 文件 | 说明 |
| --- | --- |
| `apply-cstoa-totp.ps1` | 补丁主脚本：校验 SHA256 → 备份 → 写入 |
| `apply-cstoa-totp.cmd` | Windows 双击入口，自动挑选 pwsh / powershell |

## 用法

```bat
rem 预演（不写文件）
apply-cstoa-totp.cmd -DryRun

rem 直接为同目录的 cst-pilot 打补丁
apply-cstoa-totp.cmd

rem 指定目标目录
apply-cstoa-totp.cmd -Target D:\kits\cst-pilot
```

回滚：

```powershell
.\apply-cstoa-totp.ps1 -Restore '.\cst-pilot\patch-backup-cstoa-totp-<时间戳>'
```

## 补丁内容

- 新增 `agent/home/extensions/oauth/login-mode.ts`
- 新增 `agent/home/extensions/web/static/totp-login.js`（二维码下方的入口 + 独立登录页）
- 更新 `oauth/oa.ts`、`oauth/provider.ts`（按登录方式分流，仍走 `/login cstoa`）
- 更新 `web/server/api/auth.ts`（新增 `POST /api/auth/cstoa/totp`）
- 更新 `web/server/api/oauth-flow.ts`（预置回答 + settle）
- 在 `web/static/index.html` 里引入 `/totp-login.js`

## 安全特性

- 写入前逐个校验目标文件与基准版本的 SHA256，任一不匹配即整体放弃
- 写入前自动备份到 `<目标>\patch-backup-cstoa-totp-<时间戳>`
- 脚本可重复运行，已打补丁的文件自动跳过
