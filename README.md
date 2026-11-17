# CSTP Next

**CSTP Next** 是在不违反安全政策前提下为程序进行的体验优化脚本集，请以 [CST Pilot 本体](https://github.com/SCAU-Computer-Serving-Team/cst-pilot/) 为标准。

> 本仓库的 `main` 分支已清空归档，实际内容在 [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) 分支。

## 目录

| 目录 | 职责 | 内容 |
| --- | --- | --- |
| [`WEB_EXP`](WEB_EXP) | 会话**导出** | 右键菜单「导出（CSTP Next）」，导出后自动打开资源管理器 |
| [`WEB_OTP`](WEB_OTP) | **登录**相关 | 动态码登录入口、账户页 OA 登录文案 |

## 约定

- 所有脚本统一使用 `CSTPN-` 前缀
- 每个补丁都配套一个回滚脚本，可独立安装/撤销
- 安装前自动备份，可重复运行
- 只改前端静态资源与文案，不触碰登录与导出逻辑；复用后端既有接口，不新增路由、不接受任意路径

## 使用

进入对应目录，按各自 README 操作：

```powershell
git clone -b patch https://github.com/luowenjie114514-dotcom/CSTP-Next.git
cd CSTP-Next/WEB_EXP
.\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot' -DryRun
```

修改后需重启 CST Pilot，并按 `Ctrl+F5` 强刷。
