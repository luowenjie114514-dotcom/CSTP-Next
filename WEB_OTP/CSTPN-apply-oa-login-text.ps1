<#
.SYNOPSIS
    将 CST Pilot Web 端的「扫码登录」字样改为「OA登录」，并新增动态码登录入口。

.DESCRIPTION
    只改文案与新增一个独立入口脚本，不触碰任何登录逻辑：

    1. 账户页按钮文案（assets/account-*.js）
       「重新扫码登录」 -> 「OA登录」
       「扫码登录」     -> 「OA登录」
       注意：APIKEY 登录、退出 CSTOA 等其余按钮保持不变。

    2. 新增 agent/home/extensions/web/static/cstoa-open-auth.js
       在 CSTOA 扫码卡片下方追加一个入口按钮，
       文案为「使用动态码登录（CSTP Next）」，
       点击后在新标签页打开服务端下发的官方授权地址。

    3. 在 agent/home/extensions/web/static/index.html 的 </head> 前引入上述脚本。

    安全约束：
    - 文案替换按精确字符串进行，替换前后做语法与残留校验；
    - 任何一个目标文件与基准版本不一致即整体放弃（除非 -Force）；
    - 写入前自动备份到 <目标>\patch-backup-oa-text-<时间戳>；
    - 可重复运行，已改过的文件自动跳过。

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Force
    目标文件与基准版本不一致时仍继续（会先备份）。

.PARAMETER DryRun
    只检查并打印计划，不写入任何文件。

.PARAMETER Restore
    指定备份目录，把其中的文件还原回 cst-pilot。

.EXAMPLE
    .\apply-oa-login-text.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot' -DryRun
.EXAMPLE
    .\apply-oa-login-text.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
.EXAMPLE
    .\apply-oa-login-text.ps1 -Restore '.\cst-pilot\patch-backup-oa-text-20261117-134908'
#>
[CmdletBinding()]
param(
    [string]$Target,
    [switch]$Force,
    [switch]$DryRun,
    [string]$Restore
)

$ErrorActionPreference = 'Stop'

$script:PatchVersion = '1.0.0'
$script:StaticRel = 'agent/home/extensions/web/static'
$script:IndexRel = "$($script:StaticRel)/index.html"
$script:ScriptName = 'CSTPN-cstoa-open-auth.js'
$script:IndexTag = '<script type="module" src="/CSTPN-cstoa-open-auth.js"></script>'
# 早期未加 CSTPN 前缀的版本，安装时一并清理，避免重复注入按钮。
$script:LegacyScripts = @('cstoa-open-auth.js')
$script:LegacyTags = @('<script type="module" src="/cstoa-open-auth.js"></script>')

# 账户页两个打包文件；线上由 manifest 决定用哪个，两份都改以覆盖两种构建。
# PatchedSha 用于识别「已经是补丁版本」，BaseSha 仅作参考（版本升级后允许不一致）。
$script:AccountBundles = @(
    @{
        Name       = 'account-CdZf2BiP.js'
        BaseSha    = '0654d423ed31884ace23fa26287abc7c6fd18b7c32d4bea1f18a8fdeb329592d'
        PatchedSha = 'a3ddf10c5950d1d79028815e13b60c02167631d7750c35e2c90a92f2a8f1d3d5'
    },
    @{
        Name       = 'account-p87PK_Ck.js'
        BaseSha    = 'ef9a68d6b57e2784580f3d1b2692ef372228c458fb3d5a544b50828b6b12f4dd'
        PatchedSha = 'dba0f2fb4e5fab7600a8003b93f3a18efdaa98211dfea569e012392f107c2dd6'
    }
)

# CSTP Next 补丁统一前缀：所有新增/改名的脚本与标记都带这个前缀。
$script:BrandPrefix = 'CSTPN'

# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

function Write-Head([string]$Text) {
    Write-Host ""
    Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Write-Item([string]$Text, [string]$Color = 'Gray') {
    Write-Host "  $Text" -ForegroundColor $Color
}

function Fail([string]$Text) {
    Write-Host ""
    Write-Host $Text -ForegroundColor Red
    exit 1
}

function Test-Kit([string]$Path) {
    if (-not $Path) { return $false }
    $probe = Join-Path $Path 'agent/home/extensions/oauth/oa.ts'
    return (Test-Path -LiteralPath $probe -PathType Leaf)
}

function Get-FileSha([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLower()
}

function Copy-IntoBackup([string]$Root, [string]$Relative, [string]$DestinationRoot) {
    $source = Join-Path $Root $Relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return }
    $destination = Join-Path $DestinationRoot $Relative
    $parent = Split-Path -Parent $destination
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $source -Destination $destination -Force
}

# ---------------------------------------------------------------------------
# 入口脚本内容
# ---------------------------------------------------------------------------

function Get-EntryScript {
    return @'
/**
 * CSTOA 登录卡片增强：在扫码卡片下方提供「使用动态码登录（CSTP Next）」入口。
 *
 * 背景：oauth-panel 在 CSTOA OAuth 模式下刻意不渲染「打开授权页面」链接
 * （源码中 x = method==="oauth" && providerId==="cstoa"，随后用 !x && 隐藏），
 * 只显示二维码。桌面端用户无手机可扫时因此没有可用入口。
 *
 * 取址方式：直接读取后端状态接口 /api/auth/cstoa/oauth/status 返回的
 * deviceCode.verificationUri——即服务端下发的 verification_uri_complete
 * （https://www.cstoa.top/#/oauth/device?code=XXXXXX），本身是官方授权页。
 * 不构造、不猜测地址，地址永远与后端一致。
 *
 * 安全性：只读 DOM 与只读 GET 状态接口，不拦截、不改写任何请求，
 * 不参与登录逻辑，失败时静默不干预原有流程。
 */
(() => {
	const STATUS = "/api/auth/cstoa/oauth/status";
	const CARD = '[data-method="cstoa"]';
	const MARK = "data-cstoa-open-auth";
	const TICK_MS = 1000;
	const FAIL_BACKOFF_MS = 15000;

	let lastFetch = 0;
	let cachedUrl = "";
	let styleDone = false;

	function injectStyle() {
		if (styleDone || document.getElementById("cstoa-open-auth-style")) return;
		styleDone = true;
		const style = document.createElement("style");
		style.id = "cstoa-open-auth-style";
		style.textContent = `
.${MARK}-btn{display:flex;align-items:center;justify-content:center;gap:6px;box-sizing:border-box;width:100%;margin-top:10px;padding:9px 14px;border-radius:10px;border:1px solid rgba(26,32,36,.18);background:transparent;color:inherit;font-size:13px;font-family:inherit;line-height:1.3;text-decoration:none;cursor:pointer;opacity:.9;transition:opacity .15s ease,border-color .15s ease}
.${MARK}-btn:hover{opacity:1;border-color:rgba(26,32,36,.42)}
.${MARK}-btn:active{opacity:.7}
.${MARK}-note{margin:6px 0 0;font-size:11px;line-height:1.5;text-align:center;opacity:.55}
`;
		document.head.appendChild(style);
	}

	async function fetchAuthUrl() {
		const now = Date.now();
		if (now - lastFetch < FAIL_BACKOFF_MS && !cachedUrl) return "";
		lastFetch = now;
		try {
			const response = await fetch(STATUS, {
				method: "GET",
				headers: { Accept: "application/json" },
				credentials: "same-origin",
			});
			if (!response.ok) return "";
			const state = await response.json();
			const uri = state?.deviceCode?.verificationUri;
			if (typeof uri !== "string" || !/^https?:\/\//i.test(uri)) return "";
			cachedUrl = uri;
			return uri;
		} catch {
			return "";
		}
	}

	function render(qr, url) {
		const existing = qr.querySelector(`:scope > [${MARK}]`);
		if (existing) {
			const anchor = existing.querySelector("a[href]");
			if (anchor && anchor.getAttribute("href") !== url) anchor.setAttribute("href", url);
			return;
		}
		injectStyle();
		const group = document.createElement("div");
		group.setAttribute(MARK, "");

		const open = document.createElement("a");
		open.className = `${MARK}-btn`;
		open.setAttribute("href", url);
		open.setAttribute("target", "_blank");
		open.setAttribute("rel", "noopener noreferrer");
		open.textContent = "使用动态码登录（CSTP Next）";

		const note = document.createElement("p");
		note.className = `${MARK}-note`;
		note.textContent = "在新标签页完成 CSTOA 授权，回到本页会自动继续。";

		group.append(open, note);
		qr.appendChild(group);
	}

	async function tick() {
		try {
			if (!document.querySelector(CARD)) {
				cachedUrl = "";
				return;
			}
			const qr = document.querySelector(`${CARD} .login-qr`);
			if (!qr) return;
			const existing = qr.querySelector(`:scope > [${MARK}]`);
			if (existing && cachedUrl) {
				const anchor = existing.querySelector("a[href]");
				if (anchor && anchor.getAttribute("href") === cachedUrl) return;
			}
			const url = await fetchAuthUrl();
			if (url) render(qr, url);
		} catch {
			// 页面结构变化或接口异常时静默跳过，绝不影响登录流程。
		}
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", () => void tick(), { once: true });
	} else {
		void tick();
	}
	window.setInterval(() => void tick(), TICK_MS);
})();
'@
}

# ---------------------------------------------------------------------------
# 还原
# ---------------------------------------------------------------------------

if ($Restore) {
    if (-not (Test-Path -LiteralPath $Restore)) { Fail "备份目录不存在：$Restore" }
    $restoreRoot = (Resolve-Path -LiteralPath $Restore).Path
    $targetRoot = Split-Path -Parent $restoreRoot
    Write-Head "还原"
    $count = 0
    foreach ($file in Get-ChildItem -LiteralPath $restoreRoot -Recurse -File) {
        $relative = $file.FullName.Substring($restoreRoot.Length + 1)
        $destination = Join-Path $targetRoot $relative
        $parent = Split-Path -Parent $destination
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        Write-Item "还原 $relative"
        $count++
    }
    # 补丁新增的入口脚本与 index.html 引用需要单独清理。
    $entry = Join-Path $targetRoot "$($script:StaticRel)/$($script:ScriptName)"
    if (Test-Path -LiteralPath $entry) {
        Remove-Item -LiteralPath $entry -Force
        Write-Item "删除 $($script:ScriptName)（补丁新增）"
    }
    Write-Host "`n已还原 $count 个文件。" -ForegroundColor Green
    return
}

# ---------------------------------------------------------------------------
# 定位目标
# ---------------------------------------------------------------------------

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Target) {
    $sibling = Join-Path $scriptDir 'cst-pilot'
    if (Test-Kit $sibling) { $Target = $sibling }
    elseif (Test-Kit $scriptDir) { $Target = $scriptDir }
}
if (-not $Target) {
    Fail "没找到 cst-pilot。请用 -Target 指定路径。"
}
if (-not (Test-Kit $Target)) {
    Fail "目标目录不像 cst-pilot：$Target（缺少 agent/home/extensions/oauth/oa.ts）。"
}
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Head "OA 登录文案补丁 v$script:PatchVersion"
Write-Item "目标   $Target"
$versionFile = Join-Path $Target 'VERSION'
if (Test-Path -LiteralPath $versionFile -PathType Leaf) {
    Write-Item ("版本   " + (Get-Content -LiteralPath $versionFile -TotalCount 1))
}
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

# ---------------------------------------------------------------------------
# 生成计划
# ---------------------------------------------------------------------------

$encoding = New-Object System.Text.UTF8Encoding($false)
$plan = New-Object System.Collections.ArrayList
$problems = New-Object System.Collections.ArrayList

# 1) 账户页文案替换
foreach ($bundle in $script:AccountBundles) {
    $relative = "$($script:StaticRel)/assets/$($bundle.Name)"
    $full = Join-Path $Target $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) {
        Write-Item "跳过   $($bundle.Name)（不存在）" 'DarkGray'
        continue
    }
    $text = [System.IO.File]::ReadAllText($full, $encoding)
    $already = -not $text.Contains('重新扫码登录') -and -not $text.Contains('"扫码登录"')
    if ($already) {
        Write-Item "跳过   $($bundle.Name)（已是 OA登录）" 'DarkGray'
        continue
    }
    if (-not $text.Contains('重新扫码登录') -and -not $text.Contains('"扫码登录"')) {
        $problems.Add("$($bundle.Name) 找不到目标文案") | Out-Null
        continue
    }
    $plan.Add([pscustomobject]@{ Kind = 'Text'; Name = $bundle.Name; Full = $full; Relative = $relative }) | Out-Null
}

# 2) 入口脚本
$entryRel = "$($script:StaticRel)/$($script:ScriptName)"
$entryFull = Join-Path $Target $entryRel
$entryExists = Test-Path -LiteralPath $entryFull -PathType Leaf
$entryWanted = Get-EntryScript
if (-not $entryExists) {
    $plan.Add([pscustomobject]@{ Kind = 'NewScript'; Name = $script:ScriptName; Full = $entryFull; Relative = $entryRel }) | Out-Null
}
else {
    $current = [System.IO.File]::ReadAllText($entryFull, $encoding)
    if ($current -ne $entryWanted) {
        $plan.Add([pscustomobject]@{ Kind = 'OverwriteScript'; Name = $script:ScriptName; Full = $entryFull; Relative = $entryRel }) | Out-Null
    }
    else {
        Write-Item "跳过   $($script:ScriptName)（内容已一致）" 'DarkGray'
    }
}

# 3) index.html 引入（同时清理旧版引用）
$indexFull = Join-Path $Target $script:IndexRel
$indexAction = ''
$legacyTagsFound = @()
if (-not (Test-Path -LiteralPath $indexFull -PathType Leaf)) {
    $problems.Add("缺少文件：$($script:IndexRel)") | Out-Null
}
else {
    $indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
    $legacyTagsFound = @($script:LegacyTags | Where-Object { $indexText.Contains($_) })
    if ($indexText.IndexOf('</head>') -lt 0) {
        $problems.Add("$($script:IndexRel) 里找不到 </head>。") | Out-Null
    }
    elseif ($indexText.Contains($script:IndexTag) -and $legacyTagsFound.Count -eq 0) { $indexAction = 'Skip' }
    else { $indexAction = 'Patch' }
}

# 4) 清理旧版入口脚本文件
$legacyFiles = @()
foreach ($legacy in $script:LegacyScripts) {
    $p = Join-Path $Target "$($script:StaticRel)/$legacy"
    if (Test-Path -LiteralPath $p -PathType Leaf) { $legacyFiles += $p }
}

if ($problems.Count -gt 0) {
    Write-Head '无法打补丁'
    foreach ($problem in $problems) { Write-Item $problem 'Red' }
    exit 1
}

Write-Head '改动计划'
if ($plan.Count -eq 0 -and $indexAction -eq 'Skip' -and $legacyFiles.Count -eq 0) {
    Write-Host "`n目标已经是补丁版本，无需重复执行。" -ForegroundColor Green
    return
}
foreach ($item in $plan) {
    $label = if ($item.Kind -eq 'Text') { '改文案' } elseif ($item.Kind -eq 'NewScript') { '新增' } else { '更新' }
    Write-Item ("{0}  {1}" -f $label, $item.Name)
}
if ($indexAction -eq 'Patch') { Write-Item "更新  $($script:IndexRel)  (引入 /$($script:ScriptName))" }
foreach ($legacy in $legacyFiles) { Write-Item "清理   $(Split-Path $legacy -Leaf)（旧版，避免重复注入）" 'Yellow' }

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

# ---------------------------------------------------------------------------
# 备份
# ---------------------------------------------------------------------------

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Target ("patch-backup-oa-text-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($item in $plan) {
    if ($item.Kind -ne 'NewScript') {
        Copy-IntoBackup -Root $Target -Relative $item.Relative -DestinationRoot $backupDir
    }
}
if ($indexAction -eq 'Patch') {
    Copy-IntoBackup -Root $Target -Relative $script:IndexRel -DestinationRoot $backupDir
}
Write-Head '备份'
Write-Item $backupDir

# ---------------------------------------------------------------------------
# 写入
# ---------------------------------------------------------------------------

Write-Head '写入'
foreach ($item in $plan) {
    if ($item.Kind -eq 'Text') {
        $text = [System.IO.File]::ReadAllText($item.Full, $encoding)
        $raw = [System.IO.File]::ReadAllBytes($item.Full)
        $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
        # 先长后短，避免「重新扫码登录」被拆开。
        $text = $text.Replace('"重新扫码登录"', '"OA登录"')
        $text = $text.Replace('"扫码登录"', '"OA登录"')
        if ($text.Contains('重新扫码登录') -or $text.Contains('"扫码登录"')) {
            Fail "替换未完成：$($item.Name)。可用 -Restore '$backupDir' 还原。"
        }
        $out = $encoding.GetBytes($text)
        if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
        [System.IO.File]::WriteAllBytes($item.Full, $out)
        Write-Item ("完成  " + $item.Name) 'Green'
    }
    else {
        $parent = Split-Path -Parent $item.Full
        if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        [System.IO.File]::WriteAllText($item.Full, $entryWanted, $encoding)
        Write-Item ("完成  " + $item.Name) 'Green'
    }
}

if ($indexAction -eq 'Patch') {
    $raw = [System.IO.File]::ReadAllBytes($indexFull)
    $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
    $text = [System.IO.File]::ReadAllText($indexFull, $encoding)
    # 先移除旧版引用，再确保新引用只出现一次。
    foreach ($legacyTag in $script:LegacyTags) { $text = $text.Replace($legacyTag, '') }
    if (-not $text.Contains($script:IndexTag)) {
        $position = $text.IndexOf('</head>')
        $text = $text.Substring(0, $position) + $script:IndexTag + $text.Substring($position)
    }
    $outBytes = $encoding.GetBytes($text)
    if ($hasBom) { $outBytes = [byte[]](0xEF, 0xBB, 0xBF) + $outBytes }
    [System.IO.File]::WriteAllBytes($indexFull, $outBytes)
    Write-Item ("完成  " + $script:IndexRel) 'Green'
}

foreach ($legacy in $legacyFiles) {
    Remove-Item -LiteralPath $legacy -Force
    Write-Item ("清理  " + (Split-Path $legacy -Leaf)) 'Yellow'
}

Write-Head '完成'
Write-Host '  重启 CST Pilot（关闭 pi-web.cmd 窗口后重新启动），回到 /account：' -ForegroundColor Green
Write-Host '  账户页按钮显示「OA登录」；登录页 CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」。' -ForegroundColor Green
Write-Host "`n  需要回滚：.\CSTPN-rollback-oa-login-text.ps1 -Target '$Target'" -ForegroundColor Gray
