# WEB_INP

会话导入（Web 端，半自动）。

## 功能

设置 → 常规页新增「导入会话记录（CSTP Next）」：

1. 填目标项目目录
2. 选之前导出的 `.json` 文件
3. 浏览器内转成 Pi 会话 `.jsonl` 并下载
4. 界面给出目标目录完整路径，支持一键复制
5. 把文件拖进该目录 → 重启 → 会话出现在列表，可继续对话

支持的输入：本插件导出的 JSON、JSON 数组、JSONL 原文。

仅导入文本消息，图片与工具调用参数会被忽略。

## 文件

| 文件 | 作用 |
| --- | --- |
| `CSTPN-apply-idimp.ps1` | 安装（同时装 WEB_ID 与 WEB_INP） |
| `CSTPN-rollback-idimp.ps1` | 一键撤回 |
| `CSTPN-session-import.js` | 前端脚本 |

## 用法

```powershell
.\CSTPN-apply-idimp.ps1    -Target 'C:\path\to\cst-pilot' -DryRun
.\CSTPN-apply-idimp.ps1    -Target 'C:\path\to\cst-pilot'
.\CSTPN-rollback-idimp.ps1 -Target 'C:\path\to\cst-pilot'
```

> `CSTPN-session-import.js` 需与 `.ps1` 放在同一目录，或用 `-Source` 指定。

## 说明

写回会话目录需要落盘，浏览器无法写入任意路径，因此本分支为半自动（多一步拖放）。

需要全自动请使用 [`add`](../tree/add) 分支。

## 会话文件格式

```
~/.pi/agent/sessions/<cwd 编码目录>/<ISO时间戳>_<session.id>.jsonl
```

- 目录编码：`"--" + cwd 中所有 / \ : 替换为 "-" + "--"`
- 每行一个 JSON，首行 `type=session`，其后 `message` 行用 `id`/`parentId` 串链
- 文件名中的 UUID 必须与 `session.id` 一致
