# test 分支 · 待测功能

> 本分支仅用于测试，测试通过后移入 `patch`。

## 待测

| 脚本 | 功能 |
| --- | --- |
| `TEST/CSTPN-tool-summary.js` | 会话「更多」菜单新增「工具调用」，按轮次展示工具调度 |
| `TEST/CSTPN-turn-nav.js` | 会话右侧轮次导航条，明暗分层 + 悬停摘要 |

试用：拷 `.js` 进 `cst-pilot\agent\home\extensions\web\static\`，
在 `index.html` 的 `</head>` 前加对应 `<script type="module" src="/xxx.js"></script>`，
重启 + `Ctrl + F5`。
