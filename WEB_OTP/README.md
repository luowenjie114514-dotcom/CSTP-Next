# WEB_OTP

登录相关增强（Web 端）。

## 补丁

| 补丁 | 功能 | 安装 | 回滚 |
| --- | --- | --- | --- |
| 动态码登录入口 | CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」，在新标签页打开官方授权页 | `CSTPN-apply-otp.ps1` | `CSTPN-rollback-otp.ps1` |
| 账户页 OA 登录文案 | 「重新扫码登录」/「扫码登录」→「OA登录」（`APIKEY 登录`、`退出 CSTOA` 不变） | `CSTPN-apply-oa-login-text.ps1` / `.cmd` | `CSTPN-rollback-oa-login-text.ps1` / `.cmd` |

## 用法

```powershell
.\CSTPN-apply-otp.ps1      -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-otp.ps1      -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-otp.ps1   -Target 'C:\path\to\cst-pilot'           # 回滚
```

```bat
CSTPN-apply-oa-login-text.cmd -DryRun    rem 预演
CSTPN-apply-oa-login-text.cmd            rem 安装
CSTPN-rollback-oa-login-text.cmd         rem 回滚
```

`.js` 需与 `.ps1` 放同一目录，或用 `-Source` 指定。

## 说明

动态码入口的授权地址来自 `GET /api/auth/cstoa/oauth/status`（服务端下发），即 CSTOA 官方授权页。
两个补丁互相独立，可单独安装/回滚。
