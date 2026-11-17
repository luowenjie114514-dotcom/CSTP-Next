# WEB_SRH

CSTP Next · **会话列表快速搜索**（Web 端）。

与 [WEB_EXP](../WEB_EXP)、[WEB_ID](../WEB_ID)、[WEB_INP](../WEB_INP)、[WEB_OTP](../WEB_OTP) 互相独立。

## 功能

侧栏会话列表顶部注入搜索框，输入即按**标题 / sessionID** 过滤。

| 交互 | 行为 |
| --- | --- |
| 输入 | 实时过滤，不匹配的行 `display:none` |
| `Ctrl / Cmd + K` | 聚焦搜索框并全选 |
| `Esc` | 清空并失焦 |
| 右侧 × | 清空 |

## 为什么不是重复实现

实测确认原生搜索只有两处：

| 位置 | 组件 |
| --- | --- |
| 设置页 | `.settings-search` |
| 分支树 | `.tree-search` |

**侧栏会话列表没有搜索**（`session-list` 里 `搜索` 出现 0 次）。
所以这是真正的新功能，不是重新造轮子。

## 实现要点

- 只改会话行的 `style.display`，**不移动、不删除**任何 React 管理的节点
- 精确锁定 `.sidebar-session[data-session-id]`——聊天区的 `.chat-loaded`
  也带 `data-session-id`，早期版本误把它一起过滤，会导致整个对话被隐藏，
  已修复并验证
- 搜索框本身带幂等标记，React 重渲染不会重复注入

## 文件

| 文件 | 说明 |
| --- | --- |
| `CSTPN-apply-srh.ps1` | 安装 |
| `CSTPN-rollback-srh.ps1` | 一键撤回 |
| `CSTPN-session-search.js` | 前端脚本（安装时拷贝到 cst-pilot） |

## 用法

```powershell
.\CSTPN-apply-srh.ps1    -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-srh.ps1    -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-srh.ps1 -Target 'C:\path\to\cst-pilot'           # 回滚
```

> `CSTPN-session-search.js` 需与 `.ps1` 放在同一目录，或用 `-Source` 指定。

## 实测验证（真实 Edge 157 headless）

| 项 | 结果 |
| --- | --- |
| 过滤精确性 | 只留匹配行 ✓ |
| 聊天区不受影响 | `.chat-loaded` / `.conversation` 均可见 ✓ |
| 清空恢复 | 全部行恢复 ✓ |
| 控制台错误 | 无 |
