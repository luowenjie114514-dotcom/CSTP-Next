# WEB_EXP

CSTP Next · **会话导出**增强（Web 端）。

与 [WEB_OTP](../WEB_OTP)（登录相关）完全独立。

## 右键菜单

右键会话 → **「导出（CSTP Next）」**：

| 模式 | 行为 |
| --- | --- |
| 单选 | 跳转 `/s/<id>/export` 导出选项页 |
| 管理模式多选 | **多文件导出**：每个会话各下载一个文件 |

```
单选：重命名 | 管理 | 导出（CSTP Next） | ─── | 删除
多选：              导出（CSTP Next） | 删除
```

## 导出选项页

访问 `/s/<id>/export`，标题显示 **导出会话（CSTP Next）**，
原「导出选项」面板被接管，保留全部选项、改走浏览器下载：

| 选项 | 说明 |
| --- | --- |
| 格式 | 离线 HTML / JSON 数据 |
| 主题 | 日间 / 夜间 |
| 包含思考过程 | 默认关闭 |
| 包含工具调用结果 | 默认关闭 |
| 按钮 | **导出并下载** → 浏览器「另存为」，自选路径 |

## 关键设计：捕获阶段事件拦截

导出页由 React 渲染，**直接替换 DOM 会被重渲染冲掉**（实测存在约 1.5s 空窗，
期间点到的是原来那个失败的「生成并保存」）。

因此功能保障改为：

```js
document.addEventListener("click", interceptExportClick, true);
```

监听器挂在 `document` 上、capture 阶段先手，命中 `.export-generate` 时
`preventDefault + stopImmediatePropagation`，用我们的导出流程替代。
React 无论怎么重渲染都换不掉这个监听器。

DOM 改写（标题标识、面板替换）只负责**视觉呈现**，
配合 `MutationObserver` 立即补回，不再是功能依赖。

## 为什么不用后端导出接口

`POST /api/sessions/<id>/exports` 依赖 `puppeteer-core` 驱动本机 Edge/Chrome，
实际报 `export_browser_launch_failed`；且目录固定为
`artifacts/<日期>/sessions/`，使用者无法选择位置。

## 安全性

- 只读 `GET /api/sessions/<id>`，不写本地文件
- 会话内容全部 HTML 转义，防 `<script>` / `<img onerror>` 注入
- 不删除任何 React 管理的 DOM 节点（避免 `removeChild` 崩溃）

## 文件

| 文件 | 说明 |
| --- | --- |
| `CSTPN-apply-export.ps1` | 安装 |
| `CSTPN-rollback-export.ps1` | 一键撤回 |
| `CSTPN-session-export.js` | 前端脚本（安装时拷贝到 cst-pilot） |

## 用法

```powershell
.\CSTPN-apply-export.ps1    -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-export.ps1    -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-export.ps1 -Target 'C:\path\to\cst-pilot'           # 回滚
```

> `CSTPN-session-export.js` 需与 `.ps1` 放在同一目录，或用 `-Source` 指定。

## 实测验证（真实 Edge 157 headless）

- 注入后标题带标识、面板被接管、按钮为「导出并下载」 ✓
- **React 重建 DOM 后立即点击原按钮 → 仍被拦截并成功下载** ✓
- 多选导出 → 生成 2 个独立文件 ✓
- 单选右键 → 跳转 `/s/<id>/export` ✓
- 默认不含思考/工具调用，勾选后包含 ✓
- HTML 自包含无外部资源，JSON 合法 ✓
