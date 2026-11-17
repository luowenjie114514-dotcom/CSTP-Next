# WEB_OTP

为 CST Pilot 的 **Web 端**提供 CSTP Next 的体验增强补丁。

所有 CSTP Next 脚本统一使用 **`CSTPN-` 前缀**。

## 当前补丁

### OA 登录文案

把账户页的「扫码登录」文案改为「OA登录」，并在 CSTOA 扫码卡片下方新增动态码登录入口。

| 文件 | 说明 |
| --- | --- |
| `CSTPN-apply-oa-login-text.ps1` | 打补丁主脚本（含备份与校验） |
| `CSTPN-apply-oa-login-text.cmd` | Windows 双击入口 |
| `CSTPN-rollback-oa-login-text.ps1` | 一键撤回全部修改 |
| `CSTPN-rollback-oa-login-text.cmd` | Windows 双击入口 |

### 改动内容

1. `assets/account-*.js` 文案：
   - `"重新扫码登录"` → `"OA登录"`
   - `"扫码登录"` → `"OA登录"`
   - `APIKEY 登录`、`退出 CSTOA` 保持不变
2. 新增 `static/CSTPN-cstoa-open-auth.js`
   - 在 CSTOA 扫码卡片下方追加按钮「使用动态码登录（CSTP Next）」
   - 地址取自后端 `GET /api/auth/cstoa/oauth/status` 的
     `deviceCode.verificationUri`（即官方授权页），不构造地址
3. `static/index.html` 的 `</head>` 前引入上述脚本

> 只改文案与新增入口，不触碰任何登录逻辑。

## 用法

```bat
rem 预演（不写文件）
CSTPN-apply-oa-login-text.cmd -DryRun

rem 打补丁
CSTPN-apply-oa-login-text.cmd

rem 指定目标
CSTPN-apply-oa-login-text.cmd -Target D:\kits\cst-pilot

rem 一键撤回
CSTPN-rollback-oa-login-text.cmd
```

## 说明

- 打补丁前自动备份到 `<目标>\patch-backup-oa-text-<时间戳>`
- 回滚优先使用备份还原，只有当前文件被改过才还原，避免覆盖后续升级
- 两个脚本均可重复运行，已处理过的项自动跳过
