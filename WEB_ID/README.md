# WEB_ID

CSTP Next · **会话 ID 显示与复制**（Web 端）。

与 [WEB_EXP](../WEB_EXP)、[WEB_OTP](../WEB_OTP) 互相独立。

## 功能

| 交互 | 行为 |
| --- | --- |
| 鼠标悬停会话行 | 浮层显示 `sessionID`；同时写入原生 `title` 作为兜底 |
| 右键会话 → 菜单 | 新增 **「复制会话 ID」** |

菜单顺序保持「危险操作在最后」：

```
重命名 | 管理 | 复制会话 ID | ─── | 删除
```

## 实现要点

- 只在既有会话行上设置 `title` 属性，**不替换、不删除任何 React 管理的节点**
- 浮层是独立的 fixed 定位元素，随鼠标移动，贴边自动收进视口
- 复制优先用 `navigator.clipboard`，失败回退 `execCommand('copy')`
- 多选模式下复制的是全部已选会话 ID（每行一个）

## 文件

| 文件 | 说明 |
| --- | --- |
| `CSTPN-apply-idimp.ps1` | 安装（同时装 WEB_ID 与 WEB_INP） |
| `CSTPN-rollback-idimp.ps1` | 一键撤回 |
| `CSTPN-session-id.js` | 前端脚本 |

## 安装

```powershell
.\CSTPN-apply-idimp.ps1    -Target 'C:\path\to\cst-pilot' -DryRun
.\CSTPN-apply-idimp.ps1    -Target 'C:\path\to\cst-pilot'
.\CSTPN-rollback-idimp.ps1 -Target 'C:\path\to\cst-pilot'
```

> `CSTPN-session-id.js` 需与 `.ps1` 放在同一目录，或用 `-Source` 指定。
