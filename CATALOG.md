# CSTPN 补丁目录

> 本文件由补丁管理器在启动时读取，用于同步补丁清单。
> 修改后请保持格式不变。

## 格式

每行一个补丁，字段以 ` | ` 分隔：

```
补丁ID | 分支 | 安装脚本 | 回滚脚本 | 前端脚本 | 说明
```

- 空字段写 `-`
- `前端脚本` 用于状态检测（该文件存在于 static 即视为已启用）
- `安装脚本` 为 `-` 表示该补丁无脚本（需手工或直接拷文件）

## 补丁

```catalog
WEB_EXP | patch | WEB_EXP/CSTPN-apply-export.ps1 | WEB_EXP/CSTPN-rollback-export.ps1 | CSTPN-session-export.js | 导出（PNG/HTML/JSON，浏览器下载）
WEB_ID | patch | WEB_ID/CSTPN-apply-idimp.ps1 | WEB_ID/CSTPN-rollback-idimp.ps1 | CSTPN-session-id.js | 会话 ID 显示与复制
WEB_INP | patch | WEB_INP/CSTPN-apply-idimp.ps1 | WEB_INP/CSTPN-rollback-idimp.ps1 | CSTPN-session-import.js | 导入·半自动
WEB_INP_ADD | add | - | - | - | 导入·全自动（需手工合并 api.ts，前端复用 WEB_INP）
WEB_OTP | patch | WEB_OTP/CSTPN-apply-otp.ps1 | WEB_OTP/CSTPN-rollback-otp.ps1 | CSTPN-cstoa-open-auth.js | 动态码登录入口
WEB_SRH | patch | WEB_SRH/CSTPN-apply-srh.ps1 | WEB_SRH/CSTPN-rollback-srh.ps1 | CSTPN-session-search.js | 会话列表搜索（侧栏，按标题/ID 过滤）
TOOL-SUM | test | - | - | CSTPN-tool-summary.js | 工具调用摘要面板
TURN-NAV | test | - | - | CSTPN-turn-nav.js | 轮次导航条
SESSION-PLUS | test | - | - | CSTPN-session-plus.js | 置顶/行内重命名/会话内搜索（正文高亮）
```

## 冲突

```conflicts
WEB_INP | WEB_INP_ADD
```

> 注：`WEB_SRH`（侧栏会话列表搜索）与 `SESSION-PLUS`（会话内正文搜索）
> 作用范围不同、功能互补，**不互斥**，可同时启用。

## 文件位置

| 类型 | 分支 | 路径 |
| --- | --- | --- |
| 补丁脚本 | patch | `WEB_*/CSTPN-*.ps1` |
| 前端脚本 | patch | `WEB_*/CSTPN-*.js` |
| 后端增量 | add | `WEB_INP/CSTPN-backend-import.ts` |
| 测试前端 | test | `TOOL-SUM/`、`TURN-NAV/`、`SESSION-PLUS/` 下的 `CSTPN-*.js` |
