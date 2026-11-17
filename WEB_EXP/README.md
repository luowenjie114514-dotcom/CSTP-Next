# WEB_EXP

CSTP Next · **会话导出**增强（Web 端）。

与 [WEB_OTP](../WEB_OTP)（登录相关）完全独立，可单独安装或回滚。

## 功能

在会话列表右键菜单新增「导出（CSTP Next）」：

| 模式 | 行为 |
| --- | --- |
| 单选 | 导出被右键的会话 |
| 管理模式多选 | 逐个导出全部已勾选会话 |

导出完成后自动弹出资源管理器，定位到 `artifacts\<日期>\sessions\`。

菜单位置保持「危险操作在最后」的语义：

```
单选：重命名 | 管理 | 导出（CSTP Next） | ─── | 删除
多选：              导出（CSTP Next） | 删除
```

## 文件

| 文件 | 说明 |
| --- | --- |
| `CSTPN-apply-export.ps1` | 安装 |
| `CSTPN-rollback-export.ps1` | 一键撤回 |
| `CSTPN-session-export.js` | 前端脚本（安装时拷贝到 cst-pilot） |

## 用法

```powershell
# 预演
.\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot' -DryRun

# 安装
.\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot'

# 回滚
.\CSTPN-rollback-export.ps1 -Target 'C:\path\to\cst-pilot'
```

> `CSTPN-session-export.js` 需与 `.ps1` 放在同一目录，或安装时用 `-Source` 指定。

## 复用后端既有接口

不新增路由、不接受任意路径：

| 接口 | 用途 |
| --- | --- |
| `POST /api/sessions/<id>/exports` | 创建导出任务 |
| `GET /api/exports/<exportId>` | 轮询状态 |
| `POST /api/exports/<exportId>/open` | 启动本机文件管理器 |

保存目录由后端固定在 `artifacts/<日期>/sessions/`，页面无法指定路径。

导出参数：

```json
{ "format": "html", "theme": "dark", "includeThinking": false, "includeTools": false }
```

## 说明

- 安装前自动备份 `index.html` 到 `<目标>\patch-backup-cstpn-exp-<时间戳>`
- 可重复运行，已就位则跳过
- 修改后需重启 CST Pilot，并按 `Ctrl+F5` 强刷
