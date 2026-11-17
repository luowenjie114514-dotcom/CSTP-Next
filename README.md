# test 分支 · 待测功能

> **本分支仅用于测试，内容可能不稳定。**
> 请在测试通过后再合入 `patch` 或 `add`。

## 如何试用

本分支的三个脚本是**独立单文件**，无需补丁脚本即可直接试用：

```powershell
# 1. 把 .js 拷进 cst-pilot 的静态目录
Copy-Item .\CSTPN-*.js 'C:\path\to\cst-pilot\agent\home\extensions\web\static\'

# 2. 在 index.html 的 </head> 前加引用
#    <script type="module" src="/CSTPN-code-copy.js"></script>
#    <script type="module" src="/CSTPN-session-search.js"></script>
#    <script type="module" src="/CSTPN-message-time.js"></script>

# 3. 重启 CST Pilot + Ctrl+F5
```

卸载：删掉那几行 `<script>` 和对应的 `.js` 即可。

---

## 本次待测功能

### 1. 代码块一键复制 `CSTPN-code-copy.js`

鼠标移到任意代码块上，右上角浮出「复制」按钮，附带语言标签。

- 复制的文本是**原始源码**（`textContent`），保留缩进与换行，不含高亮标签
- 支持 `navigator.clipboard`，失败回退 `execCommand`
- 复制成功按钮变绿显示「已复制」

**依据**：markdown 渲染器输出标准 `<pre><code class="language-xxx hljs">`。

---

### 2. 会话列表快速搜索 `CSTPN-session-search.js`

侧栏顶部注入搜索框，输入即按标题 / sessionID 过滤。

- `Ctrl/Cmd + K` 聚焦
- `Esc` 清空
- 清除按钮「×」
- 只改 `display`，不移动不删除节点

**注意**：只过滤侧栏行（`.sidebar-session[data-session-id]`），
**不会误伤聊天区**——聊天区的 `.chat-loaded` 也带 `data-session-id`，
早期版本踩过这个坑，已修复并验证。

---

### 3. 消息时间戳与轮次耗时 `CSTPN-message-time.js`

每条消息右下角浅色显示：

```
04:53            ← 绝对时间
04:53  +2.4s     ← 与上一条的间隔
```

- 时间来自 `GET /api/sessions/<id>` 的 `entries[].message.timestamp`
- **对不齐就不显示**（元素数与时间戳数差超过 2 时跳过），宁缺勿错

---

## 实测验证（真实 Edge 157 headless）

| 功能 | 结果 |
| --- | --- |
| 代码块复制 | 按钮注入 ✓ 语言标签 `python` ✓ 复制内容 `def hello():\n    print("hi")` ✓ |
| 会话搜索 | 过滤精确（只留匹配项）✓ 聊天区不受影响 ✓ 清空恢复 ✓ |
| 消息时间 | 2 条消息均显示，间隔 `+2.4s` 计算正确 ✓ |
| 控制台错误 | 无 |

---

## 反馈

遇到问题时请记录：

1. 提交号（`git rev-parse --short HEAD`）
2. 现象与 F12 Console 报错
3. 是否在 `patch` 分支可复现
