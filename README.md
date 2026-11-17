# test 分支 · 待测补丁

> 仅用于测试，通过后移入 `patch`。每个补丁独立目录，互不依赖。

| 目录 | 补丁 | 功能 |
| --- | --- | --- |
| [`TOOL-SUM`](TOOL-SUM) | `CSTPN-tool-summary.js` | 更多菜单「工具调用」面板，按轮次展示工具调度 |
| [`TURN-NAV`](TURN-NAV) | `CSTPN-turn-nav.js` | 会话右侧轮次导航条，居中、自中心向两侧延伸 |
| [`SESSION-PLUS`](SESSION-PLUS) | `CSTPN-session-plus.js` | 置顶 / 行内重命名 / 会话内搜索 |

## 安装

测试期无补丁脚本，直接拷入或用管理器：

```powershell
# 用管理器（推荐，自动处理 index.html 引用）
.\CSTPN-manager.ps1 -Target 'C:\path\to\cst-pilot'

# 或手工
Copy-Item .\TOOL-SUM\CSTPN-tool-summary.js 'C:\path\to\cst-pilot\agent\home\extensions\web\static\'
# 然后在 index.html 的 </head> 前加：
# <script type="module" src="/CSTPN-tool-summary.js"></script>
```

重启 + `Ctrl + F5`。
