# TURN-NAV

会话右侧轮次导航条。

## 功能

竖向刻度条，显示本会话每一轮的位置：

| 层级 | 含义 | 刻度长 |
| --- | --- | --- |
| `current` | 当前阅读的那一轮 | 44px |
| `recent` | 当前轮往前 3 轮以内 | 30px |
| `early` | 更早的轮次 | 20px |

- 细线风格（2~3px 高），右对齐贴边
- 轮次少时自动拉高间隔，多时压缩（6~14px/格）
- 悬停刻度：显示该轮用户指令与 AI 回复摘要
- 点击刻度：滚动到该轮

## 文件

| 文件 | 作用 |
| --- | --- |
| `CSTPN-turn-nav.js` | 前端脚本 |

## 安装

无独立安装脚本，用管理器或手工拷入：

```powershell
Copy-Item .\CSTPN-turn-nav.js 'C:\path\to\cst-pilot\agent\home\extensions\web\static\'
```

然后在 `index.html` 的 `</head>` 前加：

```html
<script type="module" src="/CSTPN-turn-nav.js"></script>
```

重启 + `Ctrl + F5`。

## 说明

挂载在 `.chat-message-surface`（非滚动容器），因此滚动时导航条位置固定。
