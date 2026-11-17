<#
.SYNOPSIS
    CSTP Next · WEB_SRH：会话列表快速搜索。

.DESCRIPTION
    本补丁属纯前端优化：只装一个前端脚本 + 注册 index.html 引用。

    安装 CSTPN-session-search.js：
      - 侧栏会话列表顶部注入搜索框
      - 输入即按标题 / sessionID 过滤会话行
      - Ctrl/Cmd + K 聚焦，Esc 清空
      - 只改行元素 display，不移动不删除任何 React 节点

    与原生能力的边界（实测确认）：
      原生只有「设置页搜索」与「分支树搜索」，**侧栏会话列表没有搜索**，
      因此本功能不是重复实现。

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Source
    CSTPN-session-search.js 所在目录。默认取脚本自身所在目录。

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
$script:ScriptName = 'CSTPN-session-search.js'
$script:IndexTag = '<script type="module" src="/CSTPN-session-search.js"></script>'

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

Write-Head "CSTPN WEB_SRH 会话搜索 v$script:PatchVersion"
Write-Item "目标   $Target"
Write-Item "源目录 $Source"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)

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
    Write-Host "`n会话搜索已就位，无需重复执行。" -ForegroundColor Green
    return
}
if ($needCopy) { Write-Item "安装  $($script:ScriptName)" }
if ($needTag) { Write-Item "更新  $($script:IndexRel)  (补引用)" }

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Target ("patch-backup-cstpn-srh-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $indexFull -Destination (Join-Path $backupDir 'index.html') -Force
Write-Head '备份'
Write-Item $backupDir

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
Write-Host '  侧栏会话列表顶部会出现搜索框；Ctrl/Cmd + K 聚焦，Esc 清空。' -ForegroundColor Green
Write-Host "`n  需要回滚：.\CSTPN-rollback-srh.ps1 -Target '$Target'" -ForegroundColor Gray
