# patch 分支 · 纯前端优化

> 只改 `agent/home/extensions/web/static/` 下的前端文件，不触碰后端、不新增接口。

## 声明

| 项目 | 说明 |
| --- | --- |
| 改动范围 | 仅前端静态资源；新增 `CSTPN-*.js`，`index.html` 仅追加 `<script>` 标签 |
| `assets/account-*.js` 文案 | WEB_OTP 会做字符串替换（扫码登录 → OA登录），可用备份精确还原 |
| `SHA256SUMS` | 保持有效 |
| 升级 CST Pilot 后 | 前端 bundle 被替换时重跑安装脚本即可 |
| 回滚 | 每个补丁配套 `CSTPN-rollback-*.ps1` |

## 目录

| 目录 | 功能 |
| --- | --- |
| [`WEB_EXP`](WEB_EXP) | 会话导出（PNG / HTML / JSON，浏览器下载） |
| [`WEB_ID`](WEB_ID) | 会话 ID 显示与复制 |
| [`WEB_INP`](WEB_INP) | 会话导入（半自动） |
| [`WEB_OTP`](WEB_OTP) | 动态码登录入口 + 账户页 OA 文案 |
| [`WEB_SRH`](WEB_SRH) | 会话列表搜索 |

## 安装

```powershell
git clone -b patch https://github.com/luowenjie114514-dotcom/CSTP-Next.git
cd CSTP-Next

.\WEB_EXP\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\WEB_EXP\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot'           # 安装
```

或用管理器统一管理：`.\CSTPN-manager.ps1 -Target '...'`

改完重启 CST Pilot + `Ctrl + F5` 强刷。

## 约定

- 脚本前缀 `CSTPN-`，每个补丁配套回滚脚本
- 安装前自动备份到 `<目标>\patch-backup-*`
- 可重复运行，支持 `-DryRun` 预演
- 导入为半自动（多一步拖放）；需要全自动见 [`add`](../tree/add) 分支
