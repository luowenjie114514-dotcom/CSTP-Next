# WEB_EXP

CSTP Next · **会话导出**增强（Web 端）。

与 [WEB_OTP](../WEB_OTP)（登录相关）完全独立。

## 功能

会话列表右键菜单新增「导出（CSTP Next）」：

| 模式 | 行为 |
| --- | --- |
| 单选 | 导出被右键的会话 |
| 管理模式多选 | 合并为一个 HTML 文件导出 |

导出走**浏览器下载**：弹出「另存为」对话框，由使用者自行选择保存位置。

```
单选：重命名 | 管理 | 导出（CSTP Next） | ─── | 删除
多选：              导出（CSTP Next） | 删除
```

## 为什么不用后端内置导出

后端 `POST /api/sessions/<id>/exports` 依赖 `puppeteer-core` 驱动本机 Edge/Chrome 渲染，
存在两个实际问题：

1. 管理员权限或受限环境下浏览器常启动失败（`export_browser_launch_failed`）；
2. 导出目录固定为 `artifacts/<日期>/sessions/`，用户无法选择位置。

本实现改为纯前端，绕开这两个限制。

## 实现方式

1. `GET /api/sessions/<id>` 读取会话快照
2. 页面内生成自包含 HTML（样式内嵌、无外部资源）
3. `Blob` + `<a download>` 触发浏览器下载

**安全性**

- 只读 GET，不写任何本地文件
- 会话内容全部 HTML 转义，防止 `<script>` / `<img onerror>` 注入
- 生成文件不含任何外部资源引用

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

## 兼容性说明

脚本不手动删除任何 React 管理的 DOM 节点（早期版本调用 `menu.remove()`
会导致 `NotFoundError: removeChild` 整页崩溃，已修复）。
