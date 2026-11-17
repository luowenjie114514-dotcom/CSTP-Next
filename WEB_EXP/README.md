# WEB_EXP

CSTP Next · **会话导出**增强（Web 端）。

与 [WEB_OTP](../WEB_OTP)（登录相关）完全独立。

## 两处生效

### 1. 右键快捷导出

会话列表右键菜单新增 **「导出 html（CSTP Next）」**：

| 模式 | 行为 |
| --- | --- |
| 单选 | 导出被右键的会话 |
| 管理模式多选 | 合并为一个文件导出 |

```
单选：重命名 | 管理 | 导出 html（CSTP Next） | ─── | 删除
多选：              导出 html（CSTP Next） | 删除
```

### 2. 接管导出选项页

访问 `/s/<id>/export` 时，标题显示 **导出会话（CSTP Next）**，
原有「导出选项」面板整体接管，保留全部选项但改用浏览器下载：

| 选项 | 说明 |
| --- | --- |
| 格式 | 离线 HTML / JSON 数据 |
| 主题 | 日间 / 夜间 |
| 包含思考过程 | 默认关闭 |
| 包含工具调用结果 | 默认关闭 |
| 按钮 | **导出并下载**（触发浏览器「另存为」，自选路径） |

## 为什么接管后端导出

后端 `POST /api/sessions/<id>/exports` 依赖 `puppeteer-core` 驱动本机 Edge/Chrome 渲染，
实际会报：

```
export_browser_launch_failed — 导出浏览器无法启动
```

且导出目录固定为 `artifacts/<日期>/sessions/`，使用者无法选择位置。

本实现绕开这两个限制。

## 实现方式

1. `GET /api/sessions/<id>` 读取会话快照
2. 页面内生成自包含 HTML（样式内嵌、零外部资源）或 JSON
3. `Blob` + `<a download>` 触发浏览器下载

**安全性**

- 只读 GET，不写本地文件
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

## 验证

已在真实 Edge（157 headless）中验证：

- 标题标识、面板接管、按钮替换均生效
- 默认导出不含思考/工具调用，勾选后包含
- HTML 自包含无外部资源，文件名带时间戳
- JSON 格式输出合法，含会话 ID 与消息数组
