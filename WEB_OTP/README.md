# WEB_OTP

CSTP Next 为 CST Pilot Web 端提供的体验增强补丁。

所有脚本统一使用 **`CSTPN-` 前缀**。

## 补丁一览

| 补丁 | 安装 | 回滚 |
| --- | --- | --- |
| 会话导出 + 动态码登录 | `CSTPN-apply-web-enhance.ps1` | `CSTPN-rollback-web-enhance.ps1` |
| 账户页 OA 登录文案 | `CSTPN-apply-oa-login-text.ps1` | `CSTPN-rollback-oa-login-text.ps1` |

## Web 增强（会话导出 + 动态码登录）

### 安装

```powershell
# 预演
.\CSTPN-apply-web-enhance.ps1 -Target 'C:\path\to\cst-pilot' -DryRun

# 安装
.\CSTPN-apply-web-enhance.ps1 -Target 'C:\path\to\cst-pilot'
```

### 功能

**会话导出** — 右键会话菜单新增「导出（CSTP Next）」：

- 单选：导出被右键的会话
- 管理模式多选：逐个导出全部已勾选会话
- 导出完成后自动弹出资源管理器，定位到 `artifacts\<日期>\sessions\`

菜单位置保持「危险操作在最后」的语义：

```
单选：重命名 | 管理 | 导出（CSTP Next） | ─── | 删除
多选：        导出（CSTP Next） | 删除
```

**动态码登录** — CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」，
在新标签页打开官方授权页。

### 复用后端既有接口

不新增路由、不接受任意路径：

| 接口 | 用途 |
| --- | --- |
| `POST /api/sessions/<id>/exports` | 创建导出任务 |
| `GET /api/exports/<exportId>` | 轮询状态 |
| `POST /api/exports/<exportId>/open` | 启动本机文件管理器 |

保存目录由后端固定在 `artifacts/<日期>/sessions/`，页面无法指定路径。

### 导出参数

```json
{ "format": "html", "theme": "dark", "includeThinking": false, "includeTools": false }
```

### 回滚

```powershell
.\CSTPN-rollback-web-enhance.ps1 -Target 'C:\path\to\cst-pilot'
```

删除两个 `.js` 并移除 `index.html` 里对应的 `<script>` 引用。

## 账户页 OA 登录文案

把「重新扫码登录」「扫码登录」改为「OA登录」，`APIKEY 登录` 与 `退出 CSTOA` 保持不变。

```powershell
.\CSTPN-apply-oa-login-text.ps1  -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-oa-login-text.ps1  -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-oa-login-text.ps1 -Target 'C:\path\to\cst-pilot'         # 回滚
```

## 说明

- 两个补丁互相独立，可单独安装/回滚
- 安装前自动备份到 `<目标>\patch-backup-*`
- 可重复运行，已就位的项自动跳过
- 修改后需重启 CST Pilot，并按 `Ctrl+F5` 强刷
