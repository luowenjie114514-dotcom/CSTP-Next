# WEB_OTP

CSTP Next · **登录相关**增强（Web 端）。

所有脚本统一使用 **`CSTPN-` 前缀**。

> 会话**导出**相关脚本已拆分到 [WEB_EXP](../WEB_EXP)，两者互不依赖，可单独安装或回滚。

## 补丁一览

| 补丁 | 安装 | 回滚 |
| --- | --- | --- |
| 动态码登录入口 | `CSTPN-apply-otp.ps1` | `CSTPN-rollback-otp.ps1` |
| 账户页 OA 登录文案 | `CSTPN-apply-oa-login-text.ps1` / `.cmd` | `CSTPN-rollback-oa-login-text.ps1` / `.cmd` |

## 动态码登录入口

CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」，在新标签页打开官方授权页。

### 文件

| 文件 | 说明 |
| --- | --- |
| `CSTPN-apply-otp.ps1` | 安装 |
| `CSTPN-rollback-otp.ps1` | 一键撤回 |
| `CSTPN-cstoa-open-auth.js` | 前端脚本（安装时拷贝到 cst-pilot） |

### 用法

```powershell
.\CSTPN-apply-otp.ps1      -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-otp.ps1      -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-otp.ps1   -Target 'C:\path\to\cst-pilot'           # 回滚
```

> `CSTPN-cstoa-open-auth.js` 需与 `.ps1` 放在同一目录，或用 `-Source` 指定。

### 地址来源

从后端状态接口读取，不构造、不猜测：

```
GET /api/auth/cstoa/oauth/status
  → deviceCode.verificationUri
    = https://www.cstoa.top/#/oauth/device?code=XXXXXX
```

即服务端下发的 `verification_uri_complete`，本身是 CSTOA 官方授权页。

### 为什么需要

`oauth-panel` 在 CSTOA OAuth 模式下刻意不渲染「打开授权页面」链接
（源码中 `x = method==="oauth" && providerId==="cstoa"`，随后用 `!x &&` 隐藏），
只显示二维码。桌面端用户无手机可扫时因此没有可用入口。

只读 DOM 与只读 GET 状态接口，不拦截、不改写任何请求，失败时静默不干预原有流程。

## 账户页 OA 登录文案

把「重新扫码登录」「扫码登录」改为「OA登录」，`APIKEY 登录` 与 `退出 CSTOA` 保持不变。

```bat
CSTPN-apply-oa-login-text.cmd -DryRun    rem 预演
CSTPN-apply-oa-login-text.cmd            rem 安装
CSTPN-rollback-oa-login-text.cmd         rem 回滚
```

## 说明

- 两个补丁互相独立，可单独安装/回滚
- 安装前自动备份到 `<目标>\patch-backup-cstpn-*`
- 可重复运行，已就位的项自动跳过
- 修改后需重启 CST Pilot，并按 `Ctrl+F5` 强刷
