# CSTPN Rollback · WEB_SRH：撤回会话列表搜索
#
# 删除 CSTPN-session-search.js 并移除 index.html 里对应的 <script> 引用。
#
# 用法：
#   .\CSTPN-rollback-srh.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
#   .\CSTPN-rollback-srh.ps1 -Target '...' -DryRun

[CmdletBinding()]
param(
    [string]$Target,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$script:RollbackVersion = '1.0.0'
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
if (-not $Target) {
    $sibling = Join-Path $scriptDir 'cst-pilot'
    if (Test-Kit $sibling) { $Target = $sibling }
    elseif (Test-Kit $scriptDir) { $Target = $scriptDir }
}
if (-not $Target) { Fail "没找到 cst-pilot。请用 -Target 指定路径。" }
if (-not (Test-Kit $Target)) { Fail "目标目录不像 cst-pilot：$Target" }
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Head "CSTPN WEB_SRH 回滚 v$script:RollbackVersion"
Write-Item "目标   $Target"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)
$indexFull = Join-Path $Target $script:IndexRel
$actions = New-Object System.Collections.ArrayList

$scriptPath = Join-Path $Target "$($script:StaticRel)/$($script:ScriptName)"
if (Test-Path -LiteralPath $scriptPath -PathType Leaf) {
    $actions.Add([pscustomobject]@{ Kind = 'Delete'; Name = $script:ScriptName; Full = $scriptPath }) | Out-Null
}

$indexNeeds = $false
if (Test-Path -LiteralPath $indexFull -PathType Leaf) {
    $t = [System.IO.File]::ReadAllText($indexFull, $encoding)
    if ($t.Contains($script:IndexTag)) { $indexNeeds = $true }
}
if ($indexNeeds) {
    $actions.Add([pscustomobject]@{ Kind = 'Index'; Name = $script:IndexRel; Full = $indexFull }) | Out-Null
}

Write-Head '回滚计划'
if ($actions.Count -eq 0) {
    Write-Host "`n没有检测到会话搜索，已是原始状态。" -ForegroundColor Green
    return
}
foreach ($a in $actions) {
    $label = if ($a.Kind -eq 'Delete') { '删除' } else { '清理引用' }
    Write-Item ("{0}  {1}" -f $label, $a.Name)
}

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

Write-Head '执行'
foreach ($a in $actions) {
    if ($a.Kind -eq 'Delete') {
        Remove-Item -LiteralPath $a.Full -Force
        Write-Item ("删除  " + $a.Name) 'Green'
    }
    else {
        $raw = [System.IO.File]::ReadAllBytes($a.Full)
        $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
        $text = [System.IO.File]::ReadAllText($a.Full, $encoding)
        $text = $text.Replace($script:IndexTag, '')
        $out = $encoding.GetBytes($text)
        if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
        [System.IO.File]::WriteAllBytes($a.Full, $out)
        Write-Item ("清理引用  " + $a.Name) 'Green'
    }
}

Write-Head '校验'
$problems = 0
if (Test-Path -LiteralPath $scriptPath -PathType Leaf) { Write-Item "$($script:ScriptName) 仍存在" 'Red'; $problems++ }
if (Test-Path -LiteralPath $indexFull -PathType Leaf) {
    if ([System.IO.File]::ReadAllText($indexFull, $encoding).Contains($script:IndexTag)) {
        Write-Item "index.html 仍含引用" 'Red'; $problems++
    }
    else { Write-Item "index.html 已清理" 'Green' }
}

Write-Head '完成'
if ($problems -gt 0) { Write-Host "  仍有 $problems 项未清理干净。" -ForegroundColor Red; exit 1 }
Write-Host '  已撤回会话搜索，重启 CST Pilot 并 Ctrl+F5 后生效。' -ForegroundColor Green
