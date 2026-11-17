# patch 分支 · 纯前端优化

> **本分支的所有改动只发生在 CST Pilot 的前端静态资源上。**
> 不修改后端 TypeScript 源码、不新增接口、不更改任何校验文件。

---

## 声明

| 项目 | 说明 |
| --- | --- |
| 改动范围 | 仅 `agent/home/extensions/web/static/` 下的前端文件 |
| 是否触碰后端 | **否** |
| 是否新增接口 | **否** |
| `SHA256SUMS` 校验 | **保持有效**（被改的 5 个打包文件除外，见下） |
| 升级后影响 | 通常保留；若前端 bundle 被升级替换，重跑安装脚本即可 |
| 回滚 | 每个补丁都有配套 `CSTPN-rollback-*.ps1` |

### 唯一被改动的原有文件

`agent/home/extensions/web/static/index.html` —— 仅追加 `<script>` 标签，
移除这些标签后与原文**逐字符一致**（安装脚本会先备份）。

其余全部是**新增文件**：`CSTPN-*.js`。

> 注：`WEB_OTP/CSTPN-apply-oa-login-text.ps1` 会改 `assets/account-*.js`
> 中的**文案字符串**（扫码登录 → OA登录）。这是唯一会改到既有打包文件内容的补丁，
> 且仅做字符串替换，配套回滚脚本可用备份精确还原。

---

## 本分支内容

| 目录 | 功能 | 是否纯前端 |
| --- | --- | --- |
| [`WEB_EXP`](WEB_EXP) | 会话导出（右键 + 导出选项页，浏览器下载） | ✅ |
| [`WEB_ID`](WEB_ID) | 会话 ID 显示与复制 | ✅ |
| [`WEB_INP`](WEB_INP) | 会话导入（半自动：生成文件 + 拖入目录） | ✅ |
| [`WEB_OTP`](WEB_OTP) | 动态码登录入口、账户页 OA 登录文案 | ✅ |

---

## 为什么导入在这里是半自动

把对话写回 Pi 的会话目录**必须落盘**，而浏览器出于安全沙箱无法写入任意路径。

本分支选择**不碰后端**，因此导入为半自动：

```
选文件 → 浏览器内转成 .jsonl 并下载 → 界面给出目录路径 → 拖进去 → 重启
```

多一步拖放，换取：零后端风险、校验文件完好、可随版本升级保留。

**若需要全自动导入，请使用 [`add`](../tree/add) 分支**——那条路线会修改后端。

---

## 安装

```powershell
git clone -b patch https://github.com/luowenjie114514-dotcom/CSTP-Next.git
cd CSTP-Next

.\WEB_EXP\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot' -DryRun   # 预演
.\WEB_EXP\CSTPN-apply-export.ps1 -Target 'C:\path\to\cst-pilot'           # 安装
```

各目录的 README 有该补丁的详细说明。

改完**重启 CST Pilot** + **`Ctrl + F5` 强刷**。

---

## 统一约定

- 脚本前缀 `CSTPN-`
- 每个补丁配套回滚脚本
- 安装前自动备份到 `<目标>\patch-backup-*`
- 可重复运行，已就位则跳过
- 全部支持 `-DryRun`
