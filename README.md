# test 分支 · 待测功能

> 本分支仅用于测试，测试通过后移入 `patch`。

## 待测

| 脚本 | 功能 |
| --- | --- |
| `TEST/CSTPN-tool-summary.js` | 更多菜单「工具调用」面板，按轮次展示工具调度 |
| `TEST/CSTPN-turn-nav.js` | 会话右侧轮次导航条，居中、自中心向两侧延伸 |
| `TEST/CSTPN-session-plus.js` | 置顶 / 行内重命名 / 会话内搜索 |

试用：拷 `.js` 进 `cst-pilot\agent\home\extensions\web\static\`，
在 `index.html` 的 `</head>` 前加对应 `<script type="module" src="/xxx.js"></script>`，
重启 + `Ctrl + F5`。
