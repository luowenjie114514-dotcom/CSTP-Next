# CSTP Next

CST Pilot 的体验优化补丁集。以 [CST Pilot 本体](https://github.com/SCAU-Computer-Serving-Team/cst-pilot/) 为标准，所有补丁只**附加功能**、均可回滚。

## 快速开始

```powershell
git clone https://github.com/luowenjie114514-dotcom/CSTP-Next.git
cd CSTP-Next

# 交互式管理器：逐个启用/回滚
.git clone -b patch https://github.com/luowenjie114514-dotcom/CSTP-Next.git
.CSTPN-manager.ps1 -Target 'C:\path\to\cst-pilot'
```

管理器会显示每个补丁的来源分支与当前状态，输入 ID 启用、`-ID` 回滚。

## 补丁管理器

`CSTPN-manager.ps1` 支持：

- 列出所有补丁（标注 `[patch]` / `[add]` / `[test]` 来源）
- 显示当前启用状态
- 冲突处理：`WEB_INP`（半自动）与 `WEB_INP_ADD`（全自动）互斥，启用一侧自动卸载另一侧
- `SESSION-PLUS` 与 `WEB_SRH` 搜索功能重叠，同样互斥

```powershell
.\CSTPN-manager.ps1 -Target 'C:\path\to\cst-pilot'              # 交互式
.\CSTPN-manager.ps1 -Target '...' -NonInteractive                 # 只看状态
```

## 分支

| 分支 | 性质 | 内容 |
| --- | --- | --- |
| [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) | **纯前端优化** | 五个补丁目录，不碰后端 |
| [`add`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/add) | **必要的后端修改** | 仅增量（基于 patch 使用） |
| [`test`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/test) | **测试分支** | 待测补丁，各自独立目录 |

### patch 目录

| 目录 | 功能 |
| --- | --- |
| `WEB_EXP` | 会话导出（PNG / HTML / JSON，浏览器下载） |
| `WEB_ID` | 会话 ID 显示与复制 |
| `WEB_INP` | 会话导入（半自动） |
| `WEB_OTP` | 动态码登录入口 + 账户页 OA 文案 |
| `WEB_SRH` | 会话列表搜索 |

### add 增量

| 文件 | 说明 |
| --- | --- |
| `WEB_INP/CSTPN-backend-import.ts` | 全自动导入的后端接口，需手工合并进 `api.ts` |
| `README.md` | 合并方式与风险说明 |

add **只包含 patch 没有的部分**，使用前需先装 patch。

### test 目录

| 目录 | 功能 |
| --- | --- |
| `TOOL-SUM` | 工具调用摘要面板 |
| `TURN-NAV` | 轮次导航条 |
| `SESSION-PLUS` | 置顶 / 行内重命名 / 会话内搜索 |

## 约定

- 脚本前缀 `CSTPN-`
- 每个补丁配套回滚脚本
- 安装前自动备份到 `<目标>\patch-backup-*`
- 支持 `-DryRun` 预演
- 改完重启 CST Pilot + `Ctrl + F5` 强刷

## 历史

`main` 原内容（1485 个文件）保留在提交 `7da5585`。
