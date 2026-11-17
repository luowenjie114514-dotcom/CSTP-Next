# test 分支 · 待测功能

> **本分支仅用于测试，内容可能不稳定。**
> 测试通过后移入 `patch`。

## 当前状态

**无待测内容。**

前一轮的三个候选经核查后处理如下：

| 功能 | 原生是否已有 | 处理 |
| --- | --- | --- |
| 代码块一键复制 | ✅ 已有 | 移除 |
| 消息时间戳与耗时 | ✅ 已有 | 移除 |
| 会话列表搜索 | ❌ 没有 | **已升入 [`patch`](../tree/patch) 的 `WEB_SRH`** |

### 核查依据

**代码块复制** — 原生 `error-notice` 模块已提供：

```
div.code-block
  ├─ pre.code-block-content
  ├─ button.code-copy-button
  └─ output.code-copy-feedback
```

**消息时间戳** — 原生在每轮对话的操作栏里已渲染：

```js
div.answer-actions
  ├─ 复制回答按钮
  ├─ 从此处分支新会话按钮
  └─ span: toLocaleTimeString("zh-CN", {hour:"2-digit", minute:"2-digit"})
```

耗时同样已有：`firstProcessLabel` 会显示「工作中 / 已完成 / 已工作 1m23s」。

**会话列表搜索** — 原生搜索只有设置页（`.settings-search`）
与分支树（`.tree-search`），侧栏没有。

---

## 反馈

1. 提交号（`git rev-parse --short HEAD`）
2. 现象与 F12 Console 报错
3. 是否在 `patch` 分支可复现
