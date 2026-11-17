# WEB_EXP

会话导出（Web 端）。

## 功能

右键会话 →「导出（CSTP Next）」：

| 模式 | 行为 |
| --- | --- |
| 单选 | 进入 `/s/<id>/export` 导出选项页 |
| 多选 | 多文件导出，每个会话各一个文件 |

导出选项页：

- 格式：PNG 图片 / 离线 HTML / JSON 数据
- 主题：日间 / 夜间
- 包含思考过程、包含工具调用结果

所有格式走浏览器下载，保存位置自选。

## 文件

| 文件 | 作用 |
| --- | --- |
| `CSTPN-apply-export.ps1` | 安装 |
| `CSTPN-rollback-export.ps1` | 一键撤回 |
| `CSTPN-session-export.js` | 前端脚本 |

## 用法

```powershell
.\CSTPN-apply-export.ps1    -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\CSTPN-apply-export.ps1    -Target 'C:\path\to\cst-pilot'           # 安装
.\CSTPN-rollback-export.ps1 -Target 'C:\path\to\cst-pilot'           # 回滚
```

`.js` 需与 `.ps1` 放同一目录，或用 `-Source` 指定。

## 说明

替代后端自带导出（其依赖本机 Edge 渲染且保存目录固定不可选），改为纯前端渲染与下载。
