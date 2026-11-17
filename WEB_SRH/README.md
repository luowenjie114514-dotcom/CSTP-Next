# WEB_SRH

会话列表快速搜索（Web 端）。

## 功能

侧栏会话列表顶部注入搜索框：

| 交互 | 行为 |
| --- | --- |
| 输入 | 按标题 / sessionID 实时过滤 |
| `Ctrl / Cmd + K` | 聚焦搜索框 |
| `Esc` | 清空并失焦 |

## 文件

| 文件 | 作用 |
| --- | --- |
| `CSTPN-apply-srh.ps1` | 安装 |
| `CSTPN-rollback-srh.ps1` | 一键撤回 |
| `CSTPN-session-search.js` | 前端脚本 |

## 用法

```powershell
.\CSTPN-apply-srh.ps1    -Target 'C:\path\to\cst-pilot' -DryRun
.\CSTPN-apply-srh.ps1    -Target 'C:\path\to\cst-pilot'
.\CSTPN-rollback-srh.ps1 -Target 'C:\path\to\cst-pilot'
```

> `CSTPN-session-search.js` 需与 `.ps1` 放在同一目录，或用 `-Source` 指定。

## 说明

原生搜索仅覆盖设置页与分支树，侧栏会话列表没有搜索。
