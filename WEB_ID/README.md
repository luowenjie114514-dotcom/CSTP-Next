# WEB_ID

会话 ID 显示与复制（Web 端）。

## 功能

| 交互 | 行为 |
| --- | --- |
| 悬停会话行 | 浮层显示 `sessionID`（`title` 属性同步兜底） |
| 右键 →「复制会话 ID」 | 多选时复制全部已选，每行一个 |

菜单顺序：`重命名 | 管理 | 复制会话 ID | ─── | 删除`

## 文件

| 文件 | 作用 |
| --- | --- |
| `CSTPN-apply-idimp.ps1` | 安装（同时装 WEB_ID 与 WEB_INP） |
| `CSTPN-rollback-idimp.ps1` | 一键撤回 |
| `CSTPN-session-id.js` | 前端脚本 |

## 用法

```powershell
.\CSTPN-apply-idimp.ps1    -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-idimp.ps1    -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-idimp.ps1 -Target 'C:\path\to\cst-pilot'           # 回滚
```

`.js` 需与 `.ps1` 放同一目录，或用 `-Source` 指定。
