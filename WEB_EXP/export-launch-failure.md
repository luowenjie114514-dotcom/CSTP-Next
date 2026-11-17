# 原生导出失败根因分析

> 适用版本：cst-pilot v0.6.2（pi 0.85.1，puppeteer-core 25.16.0）
> 结论：**CST Pilot 强制管理员运行，puppeteer 在提权上下文无法启动 Edge**（Windows 完整性级别隔离）。

## 错误现场

```
错误码：export_browser_launch_failed
提示：导出浏览器无法启动，请检查浏览器版本、运行权限或 CST_EXPORT_BROWSER 路径。
```

真实失败记录 5 条（`agent/home/session-exports/`），
另有 1 条卡在 `rendering`（失败无清理，前端会一直显示"正在生成"）。

## 排查矩阵

| 环节 | 结果 | 证据 |
| --- | --- | --- |
| 浏览器存在性 | ✅ | Edge 157 在候选路径首位 |
| 版本 ≥ 111 | ✅ | Edg/157.0.4341.60 |
| 命令行无头启动 | ✅ | `msedge --headless=new --dump-dom` 退出码 0 |
| `CST_EXPORT_BROWSER` 被清洗 | ❌ 未发生 | 不在 launcher.ps1 环境清洗列表 |
| puppeteer 参数问题 | ❌ 排除 | 同参数非提权环境全部成功 |
| **管理员上下文启动** | **❌ 复现** | **UAC 提权后三种参数组合全部失败** |

## 关键对照实验

同一份脚本、同一台机器、同一 Edge，仅提权状态不同：

| 参数组合 | 非提权 | UAC 提权（runas） |
| --- | --- | --- |
| 原参数 `pipe: true` | ✅ Edg/157 启动 | ❌ `Protocol error (Target.setDiscoverTargets): Target closed` |
| `pipe: false` | ✅ | ❌ `Failed to launch: Code: 0` |
| `pipe: true, shell: true` | ✅ | ❌ 同 pipe=true |

提权下 Edge **退出码为 0**（非崩溃）——是 Chromium 对 High IL 父进程的自保护：
渲染/GPU 子进程的沙箱在提权父进程下拒绝启动，浏览器静默退出。

## 机制说明

`launcher.ps1` 强制 UAC（`Verb = 'runas'`），主进程完整性级别为 High；
Chromium 检测到父进程完整性级别异常时主动退出，puppeteer 侧表现为管道握手失败。

## 处置建议

| 方案 | 说明 |
| --- | --- |
| 推荐：CSTPN 导出补丁 | 纯前端 canvas 渲染 + 浏览器下载，完全绕开 puppeteer（见本目录） |
| 降级运行 | 非管理员运行 CST Pilot（可能影响工具包其他功能） |
| 环境变量 | 设 `CST_EXPORT_BROWSER` 指定浏览器（不在清洗列表，可传入） |

## 证据文件

- `export_records.json`：`session-exports` 里的全部失败记录原文
- `admin_elevation_test.json`：提权/非提权对照实验原始数据
