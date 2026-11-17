<#
.SYNOPSIS
    为 CST Pilot 增加 CSTOA 动态验证码登录（Web 端）。

.DESCRIPTION
    把补丁写进同目录的 cst-pilot：
      · 新增 agent/home/extensions/oauth/login-mode.ts
      · 新增 agent/home/extensions/web/static/totp-login.js（二维码下方的入口 + 登录页）
      · 更新 oauth/oa.ts（动态码登录实现）
      · 更新 oauth/provider.ts（按登录方式分流，仍走 /login cstoa 的方法）
      · 更新 web/server/api/auth.ts（新增 POST /api/auth/cstoa/totp）
      · 更新 web/server/api/oauth-flow.ts（预置回答 + settle）
      · 在 web/static/index.html 里引入 /totp-login.js

    安全约束：写入前逐个校验目标文件与基准版本的 SHA256，任何一个对不上就整体放弃；
    写入前自动备份到 <目标>\patch-backup-cstoa-totp-<时间戳>；脚本可重复运行。

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Force
    目标文件与基准版本不一致时仍覆盖（会先备份，本地改动会丢失）。

.PARAMETER DryRun
    只检查并打印计划，不写入任何文件。

.PARAMETER Restore
    指定备份目录，把其中的文件还原到对应 cst-pilot（默认取该备份目录的上一级）。

.EXAMPLE
    .\apply-cstoa-totp.ps1
.EXAMPLE
    .\apply-cstoa-totp.ps1 -Target 'D:\kits\cst-pilot' -DryRun
.EXAMPLE
    .\apply-cstoa-totp.ps1 -Restore '.\cst-pilot\patch-backup-cstoa-totp-20261117-120000'
#>
[CmdletBinding()]
param(
    [string]$Target,
    [switch]$Force,
    [switch]$DryRun,
    [string]$Restore
)

$ErrorActionPreference = 'Stop'
try { Add-Type -AssemblyName System.IO.Compression -ErrorAction Stop } catch { }

$script:PatchVersion = '1.0.0'
$script:IndexRel = 'agent/home/extensions/web/static/index.html'
$script:IndexBaseSha = '658d96f89d816c8db870ab2bbb6f95728610f6d6a9049b233e38ad41654e1497'
$script:IndexMarker = '/totp-login.js'
$script:IndexTag = '<script type="module" src="/totp-login.js"></script>'

$script:Payload = @(
	@{
		Path = 'agent/home/extensions/oauth/login-mode.ts'
		New = $true
		BaseSha = ''
		PatchedSha = '931dc59df71453c92b7666ed12511d0a7446956dc864679c6dac5f7909630484'
		Chunks = @(
		'H4sIAAAAAAACCnWSz04bVxTG152nOPLKRi3snZgIoS4qpUpUXHVZu+MbGAXPReM70ChBmmlwbMdjO2kpuP5DsYBgpcGmi+KJPYGHYc6d8Wpeob',
		'pjJyGEbO895/d95ztnbmZGghlYXEreWwDvrxG++5PvvEWn5trPXbvMdwqXxm8ShEX+8RbfdwKnkaHyXFpnK3NL979dnM1mLg3rKsC1q7zbwb0y',
		'rx5h/ujSqHxkpOQco+kU3NfoupIhGniNLbi3oLOV9+qtkmsf8nbHOym5o4E/6OP5VuBYWDjhlZ5rV93RoVeysFLzez3sWZjvek0bX1iB0xAC30',
		'AqQ9YVmaQCp8FLZd4a8tI/3r7Jq0Xefho4xfGo7vcOA8dK/vgduHYVfiK/ALYLfLvPLTNwShO3gsQoWxMcbHV56w1vDf3zPzB/hCevsDa4NEzs',
		'P/P2TcEQExCVKXKaUQ3weZcb5vi15fdNb98MHMvb/hcHR5gfoJV3Rwfj+t/4so49ixdfCC2Aq+n5vXM8LEwMe51e6LbojvLC6Qd/oi103ur6p0',
		'+97S58TzNk9QddZUqWzK7SZUUFLFXEz4bCVhZF8HfFq6gDPDjl9aqY6k2H/2d63bLX2JqsPnCscFU03DFNz7JcSshM/KFj4HGZ7575/RHWdgKn',
		'yVuvp7TdM2zujQ0Di6eT0APHci/aft+Eadh891hcRe3A71iuPXTtCtbq08DddxfC7ELukSrfpXJ6dYlRLb1MwDescXtP3FR71xseY60+LgiXY/',
		'MC8xV8e4a1l9Pwhr97Tdt/9cxr7kyoc5KkZNeoxuDxDeRNeKDRLERUmiHxtPj+eYXSh7nILUkiv4Zt7NEagWvhJSAyObIIPIGIuBLRIFM1xyA3',
		'RSdAJRufS97+FDUfjX2UeqCrMlOoesO+bifno1lh8pqVr0HT1ThEY5CYh2QsDkl4LH2lEaZr6nsrs5quhs1hceyWtPm5oqxrGlHZp/Bo7LrcDf',
		'BlwsRoJBqDO3c+5HKjiJK7xl9Pr+okDrr6UKUbaiwO4QMouS/LTioSiasreHL1dbqNTel/v7QHwtsEAAA='
		)
	},
	@{
		Path = 'agent/home/extensions/oauth/oa.ts'
		New = $false
		BaseSha = '28c99a8244884abec2f6d7d8d2e061fa277da95c888b12d09b4e6d2eb5e8184d'
		PatchedSha = '9386e9d9487565a10b92148021d845adf84f9ae4f72538cb32b45d53c3e82280'
		Chunks = @(
		'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'
		)
	},
	@{
		Path = 'agent/home/extensions/oauth/provider.ts'
		New = $false
		BaseSha = '0608e6931a5aee7e947eab8b96db9ba6ac394f87102fa67d925033e6209b2349'
		PatchedSha = '800c6b3e176c39e33f4e78456535e9a6fb65cac8cb5eb90b1715ab0808f8b7fb'
		Chunks = @(
		'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'
		)
	},
	@{
		Path = 'agent/home/extensions/web/server/api/auth.ts'
		New = $false
		BaseSha = 'e1bc8c90eb3ef53d304cef4b002a24caf6289c78394def9f47361af9368404b7'
		PatchedSha = 'a08d669de7a67a33f470369f7cfc577481fea31014c6a579d1ac875e7b16cfdb'
		Chunks = @(
		'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'
		)
	},
	@{
		Path = 'agent/home/extensions/web/server/api/oauth-flow.ts'
		New = $false
		BaseSha = 'c224abe736bb323e781745240fec9c9389e068d19e2e68753bd107813289147c'
		PatchedSha = '5989d72155431fdc68ccbb84ef5b36159c315c64027ff6f888cf791a740066eb'
		Chunks = @(
		'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'
		)
	},
	@{
		Path = 'agent/home/extensions/web/static/totp-login.js'
		New = $true
		BaseSha = ''
		PatchedSha = 'bc016d1bf00e512c4372190ef06f9d1c6b207817a9087534c006703cc5f88dbe'
		Chunks = @(
		'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'
		)
	}
)

function Write-Head {
    param([string]$Text)
    Write-Host ("`n" + $Text) -ForegroundColor Cyan
}

function Write-Item {
    param([string]$Text, [string]$Color = 'Gray')
    Write-Host "  $Text" -ForegroundColor $Color
}

function Fail {
    param([string]$Text)
    throw $Text
}

function Test-Kit {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    return (Test-Path -LiteralPath (Join-Path $Path 'agent/home/extensions/oauth/oa.ts') -PathType Leaf)
}

function Get-FileSha {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Expand-Data {
    param([string[]]$Chunks)
    $base64 = [string]::Join('', $Chunks)
    $bytes = [System.Convert]::FromBase64String($base64)
    $input = New-Object System.IO.MemoryStream(, $bytes)
    $gzip = New-Object System.IO.Compression.GZipStream($input, [System.IO.Compression.CompressionMode]::Decompress)
    $output = New-Object System.IO.MemoryStream
    try { $gzip.CopyTo($output) } finally { $gzip.Dispose(); $input.Dispose() }
    return $output.ToArray()
}

function Write-Utf8File {
    param([string]$Path, [byte[]]$Bytes)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir -PathType Container)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    [System.IO.File]::WriteAllBytes($Path, $Bytes)
}

function Copy-IntoBackup {
    param([string]$Root, [string]$Relative, [string]$DestinationRoot)
    $source = Join-Path $Root $Relative
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { return }
    $dest = Join-Path $DestinationRoot $Relative
    $destDir = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $destDir -PathType Container)) {
        New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item -LiteralPath $source -Destination $dest -Force
}

# ---- 还原模式 -------------------------------------------------------------------

if (-not [string]::IsNullOrWhiteSpace($Restore)) {
    $backupDir = (Resolve-Path -LiteralPath $Restore).Path
    if (-not $Target) { $Target = Split-Path -Parent $backupDir }
    if (-not (Test-Kit $Target)) { Fail "无法定位 cst-pilot：$Target。请用 -Target 指定。" }
    $Target = (Resolve-Path -LiteralPath $Target).Path
    Write-Head "还原：$backupDir"
    $count = 0
    Get-ChildItem -LiteralPath $backupDir -Recurse -File | ForEach-Object {
        $relative = $_.FullName.Substring($backupDir.Length).TrimStart('\', '/')
        $dest = Join-Path $Target $relative
        $destDir = Split-Path -Parent $dest
        if (-not (Test-Path -LiteralPath $destDir -PathType Container)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
        Write-Item "还原 $relative"
        $count++
    }
    # 补丁新增的文件在备份里没有对应记录，按指纹确认后一并删除。
    $removed = 0
    foreach ($entry in $script:Payload) {
        if (-not $entry.New) { continue }
        $extra = Join-Path $Target $entry.Path
        if ((Get-FileSha $extra) -eq $entry.PatchedSha) {
            Remove-Item -LiteralPath $extra -Force
            Write-Item "删除 $($entry.Path)（补丁新增）"
            $removed++
        }
    }
    Write-Host ("`n已还原 $count 个文件" + $(if ($removed -gt 0) { "，并删除 $removed 个补丁新增文件。" } else { "。" })) -ForegroundColor Green
    return
}

# ---- 定位目标 -------------------------------------------------------------------

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Target) {
    $sibling = Join-Path $scriptDir 'cst-pilot'
    if (Test-Kit $sibling) { $Target = $sibling }
    elseif (Test-Kit $scriptDir) { $Target = $scriptDir }
}
if (-not $Target) {
    Fail "没找到 cst-pilot。请把本脚本放到 cst-pilot 的同一级目录，或用 -Target 指定路径。"
}
if (-not (Test-Kit $Target)) {
    Fail "目标目录不像 cst-pilot：$Target（缺少 agent/home/extensions/oauth/oa.ts）。"
}
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Head "CSTOA 动态验证码登录补丁 v$script:PatchVersion"
Write-Item "目标   $Target"
$versionFile = Join-Path $Target 'VERSION'
if (Test-Path -LiteralPath $versionFile -PathType Leaf) {
    Write-Item ("版本   " + (Get-Content -LiteralPath $versionFile -TotalCount 1))
}
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

# ---- 生成计划 -------------------------------------------------------------------

$plan = New-Object System.Collections.ArrayList
$problems = New-Object System.Collections.ArrayList

foreach ($entry in $script:Payload) {
    $full = Join-Path $Target $entry.Path
    $current = Get-FileSha $full
    $action = ''
    $note = ''
    if ($current -eq $entry.PatchedSha) {
        $action = 'Skip'
        $note = '已是补丁版本'
    }
    elseif (-not $current) {
        if ($entry.New) { $action = 'New' } else { $problems.Add("缺少文件：$($entry.Path)") | Out-Null }
    }
    elseif ($entry.New) {
        $action = 'Overwrite'
        $note = '同名文件已存在（非补丁版本）'
    }
    elseif ($current -ne $entry.BaseSha) {
        if ($Force) {
            $action = 'Overwrite'
            $note = '与基准版本不同，按 -Force 覆盖'
        }
        else {
            $problems.Add("与基准版本不一致：$($entry.Path)`n      期望 $($entry.BaseSha.Substring(0, 12))… 实际 $($current.Substring(0, 12))…") | Out-Null
        }
    }
    else {
        $action = 'Patch'
    }
    $plan.Add([pscustomobject]@{
            Path   = $entry.Path
            Full   = $full
            Action = $action
            Note   = $note
            Entry  = $entry
        }) | Out-Null
}

# index.html 单独处理：插入脚本引用，不需要整文件替换
$indexFull = Join-Path $Target $script:IndexRel
$indexAction = ''
if (-not (Test-Path -LiteralPath $indexFull -PathType Leaf)) {
    $problems.Add("缺少文件：$script:IndexRel") | Out-Null
}
else {
    $indexEncoding = New-Object System.Text.UTF8Encoding($false)
    $indexText = [System.IO.File]::ReadAllText($indexFull, $indexEncoding)
    if ($indexText.Contains($script:IndexMarker)) {
        $indexAction = 'Skip'
    }
    elseif ($indexText.IndexOf('</head>') -lt 0) {
        $problems.Add("$script:IndexRel 里找不到 </head>，无法插入脚本引用。") | Out-Null
    }
    else {
        $indexAction = 'Patch'
        $indexSha = Get-FileSha $indexFull
        if ($indexSha -ne $script:IndexBaseSha) {
            $note = 'index.html 与基准版本不同，按插入方式处理'
            Write-Item "注意   $note" 'Yellow'
        }
    }
}

if ($problems.Count -gt 0) {
    Write-Head '无法打补丁'
    foreach ($problem in $problems) { Write-Item $problem 'Red' }
    Write-Host "`n目标文件与这个补丁的基准版本不一致，未写入任何文件。" -ForegroundColor Red
    Write-Host '如果确认要覆盖本地改动，请加 -Force 后重试（会先备份）。' -ForegroundColor Red
    exit 1
}

Write-Head '改动计划'
$changed = 0
foreach ($item in $plan) {
    $label = '更新'
    $color = 'Gray'
    if ($item.Action -eq 'New') { $label = '新增'; $color = 'Green'; $changed++ }
    elseif ($item.Action -eq 'Patch') { $changed++ }
    elseif ($item.Action -eq 'Overwrite') { $label = '覆盖'; $color = 'Yellow'; $changed++ }
    elseif ($item.Action -eq 'Skip') { $label = '跳过'; $color = 'DarkGray' }
    $suffix = ''
    if ($item.Note) { $suffix = "  ($($item.Note))" }
    Write-Item ("{0}  {1}{2}" -f $label, $item.Path, $suffix) $color
}
if ($indexAction -eq 'Patch') { Write-Item "更新  $script:IndexRel  (插入 /totp-login.js)" 'Gray'; $changed++ }
elseif ($indexAction -eq 'Skip') { Write-Item "跳过  $script:IndexRel  (已经引入)" 'DarkGray' }

if ($changed -eq 0) {
    Write-Host "`n目标已经是补丁版本，无需重复执行。" -ForegroundColor Green
    return
}

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。去掉 -DryRun 后重新运行即可应用。" -ForegroundColor Yellow
    return
}

# ---- 备份 -----------------------------------------------------------------------

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Target ("patch-backup-cstoa-totp-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
foreach ($item in $plan) {
    if ($item.Action -eq 'Patch' -or $item.Action -eq 'Overwrite') {
        Copy-IntoBackup -Root $Target -Relative $item.Path -DestinationRoot $backupDir
    }
}
if ($indexAction -eq 'Patch') {
    Copy-IntoBackup -Root $Target -Relative $script:IndexRel -DestinationRoot $backupDir
}
Write-Head '备份'
Write-Item $backupDir

# ---- 写入 -----------------------------------------------------------------------

Write-Head '写入'
foreach ($item in $plan) {
    if ($item.Action -eq 'Skip') { continue }
    $bytes = Expand-Data -Chunks $item.Entry.Chunks
    Write-Utf8File -Path $item.Full -Bytes $bytes
    $actual = Get-FileSha $item.Full
    if ($actual -ne $item.Entry.PatchedSha) {
        Fail "写入校验失败：$($item.Path)（实际 $actual）。可用 -Restore '$backupDir' 还原。"
    }
    Write-Item ("完成  " + $item.Path) 'Green'
}

if ($indexAction -eq 'Patch') {
    $raw = [System.IO.File]::ReadAllBytes($indexFull)
    $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
    $encoding = New-Object System.Text.UTF8Encoding($false)
    $text = [System.IO.File]::ReadAllText($indexFull, $encoding)
    $position = $text.IndexOf('</head>')
    $text = $text.Substring(0, $position) + $script:IndexTag + $text.Substring($position)
    $outBytes = $encoding.GetBytes($text)
    if ($hasBom) { $outBytes = [byte[]](0xEF, 0xBB, 0xBF) + $outBytes }
    [System.IO.File]::WriteAllBytes($indexFull, $outBytes)
    Write-Item ("完成  " + $script:IndexRel) 'Green'
}

Write-Head '完成'
Write-Host '  重启 CST Pilot（关闭 pi-web.cmd 的窗口后重新启动），回到 /login：' -ForegroundColor Green
Write-Host '  CSTOA 扫码卡片里，二维码下方会出现「改用动态验证码登录」，点开即是独立登录页。' -ForegroundColor Green
Write-Host "`n  需要回滚：.\apply-cstoa-totp.ps1 -Restore '$backupDir'" -ForegroundColor Gray
Write-Host '  注意：本补丁不改文档与 SHA256SUMS，如需同步请另行说明。' -ForegroundColor DarkGray
