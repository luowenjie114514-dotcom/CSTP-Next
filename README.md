# CSTP Next

CST Pilot 的体验优化补丁集。所有补丁只**附加功能**、均可回滚。

## 快速开始

```powershell
git clone https://github.com/luowenjie114514-dotcom/CSTP-Next.git
cd CSTP-Next

.\CSTPN-manager.cmd
```

双击 `CSTPN-manager.cmd`（或运行 `.\CSTPN-manager.ps1`）打开管理器：

- 启动时自动从 GitHub 同步补丁清单
- 列出每个补丁的来源分支与启用状态
- 输入补丁 ID 启用，前加 `-` 回滚
- 本地缺文件会自动下载
- 找不到 cst-pilot 会弹出目录选择框

```powershell
.\CSTPN-manager.ps1                              # 交互式
.\CSTPN-manager.ps1 -NonInteractive               # 只看状态
.\CSTPN-manager.ps1 -Target 'D:\kits\cst-pilot'  # 指定目录
```

补丁清单由 [`CATALOG.md`](CATALOG.md) 统一维护，管理器读取它来同步，
README 不再重复列一遍。

## 分支

| 分支 | 性质 |
| --- | --- |
| [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) | 纯前端优化，不碰后端 |
| [`add`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/add) | 必要的后端修改，仅增量（基于 patch 使用） |
| [`test`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/test) | 待测补丁，各自独立目录 |

各分支的内容见该分支自己的 README，或直接看 [`CATALOG.md`](CATALOG.md)。

## 约定

- 脚本前缀 `CSTPN-`
- 每个补丁配套回滚脚本
- 安装前自动备份到 `<目标>\patch-backup-*`
- 支持 `-DryRun` 预演
- 改完重启 CST Pilot + `Ctrl + F5` 强刷

## 历史

`main` 原内容（1485 个文件）保留在提交 `7da5585`。
