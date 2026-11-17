<#
.SYNOPSIS
    CSTP Next · WEB_OTP：为 CST Pilot Web 端安装动态码登录入口。

.DESCRIPTION
    只负责「登录」相关能力，与 WEB_EXP（导出）完全独立。

    安装 CSTPN-cstoa-open-auth.js，并注册到 index.html：
      CSTOA 扫码卡片下方新增「使用动态码登录（CSTP Next）」，在新标签页打开官方授权页。

    地址取自后端状态接口返回的 deviceCode.verificationUri，即服务端下发的
    verification_uri_complete（https://www.cstoa.top/#/oauth/device?code=XXXXXX），
    不构造、不猜测地址。

    安全约束：写入前备份 index.html；可重复运行，已就位则跳过。

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Source
    CSTPN-cstoa-open-auth.js 所在目录。默认取脚本自身所在目录。

.PARAMETER DryRun
    只检查并打印计划，不写入任何文件。

.EXAMPLE
    .\CSTPN-apply-otp.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot' -DryRun
.EXAMPLE
    .\CSTPN-apply-otp.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
#>
[CmdletBinding()]
param(
    [string]$Target,
    [string]$Source,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$script:PatchVersion = '1.0.0'
$script:StaticRel = 'agent/home/extensions/web/static'
$script:IndexRel = "$($script:StaticRel)/index.html"
$script:ScriptName = 'CSTPN-cstoa-open-auth.js'
$script:IndexTag = '<script type="module" src="/CSTPN-cstoa-open-auth.js"></script>'

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
    return (Test-Path -LiteralPath (Join-Path $Path 'agent/home/extensions/oauth/oa.ts') -PathType Leaf)
}

# ---------------------------------------------------------------------------
# 定位
# ---------------------------------------------------------------------------

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Source) { $Source = $scriptDir }

if (-not $Target) {
    $sibling = Join-Path $scriptDir 'cst-pilot'
    if (Test-Kit $sibling) { $Target = $sibling }
    elseif (Test-Kit $scriptDir) { $Target = $scriptDir }
}
if (-not $Target) { Fail "没找到 cst-pilot。请用 -Target 指定路径。" }
if (-not (Test-Kit $Target)) { Fail "目标目录不像 cst-pilot：$Target" }
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Head "CSTPN WEB_OTP 动态码登录 v$script:PatchVersion"
Write-Item "目标   $Target"
Write-Item "源目录 $Source"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------------------
# 校验源文件
# ---------------------------------------------------------------------------

$srcFile = Join-Path $Source $script:ScriptName
if (-not (Test-Path -LiteralPath $srcFile -PathType Leaf)) {
    Fail "缺少源文件：$srcFile`n请把 $($script:ScriptName) 与本脚本放在同一目录，或用 -Source 指定。"
}

$dstFile = Join-Path $Target "$($script:StaticRel)/$($script:ScriptName)"
$needCopy = $true
if (Test-Path -LiteralPath $dstFile -PathType Leaf) {
    if ((Get-FileHash -LiteralPath $srcFile -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $dstFile -Algorithm SHA256).Hash) {
        $needCopy = $false
        Write-Item "跳过   $($script:ScriptName)（内容已一致）" 'DarkGray'
    }
}

$indexFull = Join-Path $Target $script:IndexRel
if (-not (Test-Path -LiteralPath $indexFull -PathType Leaf)) { Fail "缺少文件：$($script:IndexRel)" }
$indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
if ($indexText.IndexOf('</head>') -lt 0) { Fail "$($script:IndexRel) 里找不到 </head>。" }
$needTag = -not $indexText.Contains($script:IndexTag)

Write-Head '改动计划'
if (-not $needCopy -and -not $needTag) {
    Write-Host "`n动态码登录入口已就位，无需重复执行。" -ForegroundColor Green
    return
}
if ($needCopy) { Write-Item "安装  $($script:ScriptName)" }
if ($needTag) { Write-Item "更新  $($script:IndexRel)  (补引用)" }

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

# ---------------------------------------------------------------------------
# 备份
# ---------------------------------------------------------------------------

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Target ("patch-backup-cstpn-otp-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $indexFull -Destination (Join-Path $backupDir 'index.html') -Force
Write-Head '备份'
Write-Item $backupDir

# ---------------------------------------------------------------------------
# 写入
# ---------------------------------------------------------------------------

Write-Head '写入'
if ($needCopy) {
    $parent = Split-Path -Parent $dstFile
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $srcFile -Destination $dstFile -Force
    Write-Item ("安装  " + $script:ScriptName) 'Green'
}

if ($needTag) {
    $raw = [System.IO.File]::ReadAllBytes($indexFull)
    $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
    $text = [System.IO.File]::ReadAllText($indexFull, $encoding)
    $position = $text.IndexOf('</head>')
    $text = $text.Substring(0, $position) + $script:IndexTag + $text.Substring($position)
    $outBytes = $encoding.GetBytes($text)
    if ($hasBom) { $outBytes = [byte[]](0xEF, 0xBB, 0xBF) + $outBytes }
    [System.IO.File]::WriteAllBytes($indexFull, $outBytes)
    Write-Item ("更新  " + $script:IndexRel) 'Green'
}

Write-Head '完成'
Write-Host '  重启 CST Pilot（关闭 pi-web.cmd 窗口后重新启动），并按 Ctrl+F5 强刷。' -ForegroundColor Green
Write-Host '  登录页 CSTOA 扫码卡片下方会出现「使用动态码登录（CSTP Next）」。' -ForegroundColor Green
Write-Host "`n  需要回滚：.\CSTPN-rollback-otp.ps1 -Target '$Target'" -ForegroundColor Gray
