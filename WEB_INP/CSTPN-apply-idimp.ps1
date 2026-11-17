<#
.SYNOPSIS
    CSTP Next · WEB_ID / WEB_INP：会话 ID 显示与导入（半自动）。

.DESCRIPTION
    本补丁属于「安全侧」：只改前端静态资源，不触碰后端、不改 SHA256SUMS 校验的文件。

    安装两个脚本并注册到 index.html：

    1. CSTPN-session-id.js
       - 鼠标悬停会话行时显示 sessionID（原生 tooltip + 浮层）
       - 右键菜单新增「复制会话 ID」

    2. CSTPN-session-import.js
       - 设置 → 常规页新增「导入会话记录（CSTP Next）」
       - 选择导出文件 → 浏览器内转换为 Pi 会话 .jsonl → 下载
       - 界面给出目标目录完整路径并支持一键复制，用户拖入即可

    为什么导入是半自动：
    把对话写回 Pi 会话目录必须落盘，浏览器无法写入任意路径。
    全自动需要给 web/server/api.ts 加写接口（属激进方案，已放 add 分支）。

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Source
    两个 .js 所在目录。默认取脚本自身所在目录。

.PARAMETER DryRun
    只检查并打印计划，不写入任何文件。
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

$script:Scripts = @(
    @{ Name = 'CSTPN-session-id.js';     Tag = '<script type="module" src="/CSTPN-session-id.js"></script>' },
    @{ Name = 'CSTPN-session-import.js'; Tag = '<script type="module" src="/CSTPN-session-import.js"></script>' }
)

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

Write-Head "CSTPN WEB_ID / WEB_INP v$script:PatchVersion"
Write-Item "目标   $Target"
Write-Item "源目录 $Source"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)

$problems = New-Object System.Collections.ArrayList
foreach ($script in $script:Scripts) {
    if (-not (Test-Path -LiteralPath (Join-Path $Source $script.Name) -PathType Leaf)) {
        $problems.Add("缺少源文件：$(Join-Path $Source $script.Name)") | Out-Null
    }
}
if ($problems.Count -gt 0) {
    Write-Head '无法继续'
    foreach ($p in $problems) { Write-Item $p 'Red' }
    exit 1
}

$copies = New-Object System.Collections.ArrayList
foreach ($script in $script:Scripts) {
    $src = Join-Path $Source $script.Name
    $dst = Join-Path $Target "$($script:StaticRel)/$($script.Name)"
    $need = $true
    if (Test-Path -LiteralPath $dst -PathType Leaf) {
        if ((Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash) {
            $need = $false
            Write-Item "跳过   $($script.Name)（内容已一致）" 'DarkGray'
        }
    }
    if ($need) { $copies.Add([pscustomobject]@{ Name = $script.Name; Source = $src; Destination = $dst }) | Out-Null }
}

$indexFull = Join-Path $Target $script:IndexRel
if (-not (Test-Path -LiteralPath $indexFull -PathType Leaf)) { Fail "缺少文件：$($script:IndexRel)" }
$indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
if ($indexText.IndexOf('</head>') -lt 0) { Fail "$($script:IndexRel) 里找不到 </head>。" }
$missing = @($script:Scripts | Where-Object { -not $indexText.Contains($_.Tag) })

Write-Head '改动计划'
if ($copies.Count -eq 0 -and $missing.Count -eq 0) {
    Write-Host "`n两个脚本与引用都已就位，无需重复执行。" -ForegroundColor Green
    return
}
foreach ($c in $copies) { Write-Item ("安装  " + $c.Name) }
if ($missing.Count) { Write-Item "更新  $($script:IndexRel)  (补 $($missing.Count) 个引用)" }

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Target ("patch-backup-cstpn-idimp-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $indexFull -Destination (Join-Path $backupDir 'index.html') -Force
Write-Head '备份'
Write-Item $backupDir

Write-Head '写入'
foreach ($c in $copies) {
    $parent = Split-Path -Parent $c.Destination
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $c.Source -Destination $c.Destination -Force
    Write-Item ("安装  " + $c.Name) 'Green'
}

if ($missing.Count) {
    $raw = [System.IO.File]::ReadAllBytes($indexFull)
    $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
    $text = [System.IO.File]::ReadAllText($indexFull, $encoding)
    foreach ($s in $missing) {
        $pos = $text.IndexOf('</head>')
        $text = $text.Substring(0, $pos) + $s.Tag + $text.Substring($pos)
    }
    $out = $encoding.GetBytes($text)
    if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
    [System.IO.File]::WriteAllBytes($indexFull, $out)
    Write-Item ("更新  " + $script:IndexRel) 'Green'
}

Write-Head '完成'
Write-Host '  重启 CST Pilot 并按 Ctrl+F5 强刷。' -ForegroundColor Green
Write-Host '  - 悬停会话行显示 sessionID；右键菜单「复制会话 ID」。' -ForegroundColor Green
Write-Host '  - 设置 → 常规 新增「导入会话记录」：选文件即可转换下载，再拖入提示的目录。' -ForegroundColor Green
Write-Host "`n  需要回滚：.\CSTPN-rollback-idimp.ps1 -Target '$Target'" -ForegroundColor Gray
