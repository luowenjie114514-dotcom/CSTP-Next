# CSTP Next

**CSTP Next** 是在不违反安全政策前提下，为 [CST Pilot](https://github.com/SCAU-Computer-Serving-Team/cst-pilot/) 提供体验优化的补丁集。

> 以 CST Pilot 本体为标准；所有补丁只**附加功能**，均可回滚。

---

## 快速开始

```powershell
git clone -b patch https://github.com/luowenjie114514-dotcom/CSTP-Next.git
cd CSTP-Next

# 先预演，确认它会改哪些文件
.\WEB_EXP\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot' -DryRun

# 确认后正式应用
.\WEB_EXP\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot'
```

改完**重启 CST Pilot**，并 **`Ctrl + F5` 强刷**浏览器。

---

## 分支说明

| 分支 | 性质 | 适合谁 |
| --- | --- | --- |
| [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) | **纯前端优化**，不触碰后端 | 大多数人（推荐） |
| [`add`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/add) | 为达成优化**不可避免地修改了后端**，但**可回滚、仅附加功能** | 需要全自动导入的用户 |
| [`test`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/test) | **测试分支**，功能可能不稳定 | 愿意尝鲜、反馈问题的用户 |
| `main` | 本目录向导 | — |

---

## 补丁目录

### 📤 WEB_EXP — 会话导出

推送 `patch`：

| 文件 | 作用 |
| --- | --- |
| `WEB_EXP/CSTPN-apply-export.ps1` | 安装 |
| `WEB_EXP/CSTPN-rollback-export.ps1` | 一键撤回 |
| `WEB_EXP/CSTPN-session-export.js` | 前端脚本 |

**能做什么**

- 右键会话 →「导出（CSTP Next）」
  - 单选：进入 `/s/<id>/export` 导出选项页
  - 多选：**多文件导出**，每个会话各一个文件
- 导出选项页：格式（离线 HTML / JSON）、主题（日间 / 夜间）、
  是否包含思考过程与工具调用结果
- 走**浏览器下载**，保存位置自选

**为什么替换了原导出**

原导出依赖 `puppeteer-core` 驱动本机 Edge 渲染，实测报
`export_browser_launch_failed`；且目录固定、无法选择位置。

---

### 🆔 WEB_ID — 会话 ID

推送 `patch`：

| 文件 | 作用 |
| --- | --- |
| `WEB_ID/CSTPN-apply-idimp.ps1` | 安装（同时装 WEB_ID 与 WEB_INP） |
| `WEB_ID/CSTPN-rollback-idimp.ps1` | 一键撤回 |
| `WEB_ID/CSTPN-session-id.js` | 前端脚本 |

**能做什么**

- 鼠标悬停会话行 → 浮层显示 `sessionID`（同时写入原生 `title` 兜底）
- 右键菜单 →「复制会话 ID」（多选时复制全部已选）

---

### 📥 WEB_INP — 会话导入

推送 `patch`（半自动）：

| 文件 | 作用 |
| --- | --- |
| `WEB_INP/CSTPN-apply-idimp.ps1` | 安装 |
| `WEB_INP/CSTPN-rollback-idimp.ps1` | 一键撤回 |
| `WEB_INP/CSTPN-session-import.js` | 前端脚本 |

**能做什么**

设置 → 常规页新增「导入会话记录（CSTP Next）」：

1. 填目标项目目录
2. 选之前导出的 `.json` 文件
3. 浏览器内转成 Pi 会话 `.jsonl` 并下载
4. 界面给出完整路径 + 一键复制
5. 拖进目录 → 重启 → 会话出现在列表，**可继续对话**

支持本插件导出的 JSON、JSON 数组、JSONL 原文。
**仅导入文本消息**，图片与工具调用参数会被忽略。

推送 `add` 还额外提供 `WEB_INP/CSTPN-backend-import.ts`（全自动后端接口）。

---

### 🔑 WEB_OTP — 登录相关

推送 `patch`：

| 文件 | 作用 |
| --- | --- |
| `WEB_OTP/CSTPN-apply-otp.ps1` | 动态码登录入口 |
| `WEB_OTP/CSTPN-rollback-otp.ps1` | 撤回 |
| `WEB_OTP/CSTPN-cstoa-open-auth.js` | 前端脚本 |
| `WEB_OTP/CSTPN-apply-oa-login-text.ps1` / `.cmd` | 账户页文案改「OA登录」 |
| `WEB_OTP/CSTPN-rollback-oa-login-text.ps1` / `.cmd` | 撤回 |

**能做什么**

- 账户页按钮文案：「重新扫码登录」/「扫码登录」→「OA登录」
  （`APIKEY 登录`、`退出 CSTOA` 保持不变）
- CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」，
  在新标签页打开官方授权页

---

## 通用约定

- 所有脚本统一 **`CSTPN-` 前缀**
- 每个补丁都配套**回滚脚本**，可单独安装 / 撤销
- 安装前自动备份到 `<目标>\patch-backup-*`
- 可重复运行，已就位的项自动跳过
- 全部支持 `-DryRun` 预演

---

## 排障

| 现象 | 处理 |
| --- | --- |
| 装了没反应 | 是否重启 CST Pilot？是否 `Ctrl + F5` 强刷？ |
| 强刷后仍无变化 | F12 看 Console 报错 |
| 想彻底还原 | 跑对应目录的 `CSTPN-rollback-*.ps1` |
| 脚本说找不到源文件 | `.js` 需与 `.ps1` 放同一目录，或用 `-Source` 指定 |

---

## 历史

`main` 原内容（1485 个文件）完整保留在提交 `7da5585`，可随时检出：

```bash
git checkout 7da5585
```
