# CSTPN Rollback · WEB_OTP：撤回动态码登录入口
#
# 撤回内容：
#   1. 删除 CSTPN-cstoa-open-auth.js
#   2. 移除 index.html 里对应的 <script> 引用
#   3. 兼容清理早期未加前缀的 cstoa-open-auth.js
#
# 用法：
#   .\CSTPN-rollback-otp.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
#   .\CSTPN-rollback-otp.ps1 -Target '...' -DryRun

[CmdletBinding()]
param(
    [string]$Target,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$script:RollbackVersion = '1.0.0'
$script:StaticRel = 'agent/home/extensions/web/static'
$script:IndexRel = "$($script:StaticRel)/index.html"

$script:Scripts = @(
    @{ Name = 'CSTPN-cstoa-open-auth.js'; Tag = '<script type="module" src="/CSTPN-cstoa-open-auth.js"></script>' },
    @{ Name = 'cstoa-open-auth.js';       Tag = '<script type="module" src="/cstoa-open-auth.js"></script>' }
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
if (-not $Target) {
    $sibling = Join-Path $scriptDir 'cst-pilot'
    if (Test-Kit $sibling) { $Target = $sibling }
    elseif (Test-Kit $scriptDir) { $Target = $scriptDir }
}
if (-not $Target) { Fail "没找到 cst-pilot。请用 -Target 指定路径。" }
if (-not (Test-Kit $Target)) { Fail "目标目录不像 cst-pilot：$Target" }
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Head "CSTPN WEB_OTP 回滚 v$script:RollbackVersion"
Write-Item "目标   $Target"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)
$indexFull = Join-Path $Target $script:IndexRel
$actions = New-Object System.Collections.ArrayList

foreach ($script in $script:Scripts) {
    $path = Join-Path $Target "$($script:StaticRel)/$($script.Name)"
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $actions.Add([pscustomobject]@{ Kind = 'Delete'; Name = $script.Name; Full = $path }) | Out-Null
    }
}

$indexNeeds = $false
if (Test-Path -LiteralPath $indexFull -PathType Leaf) {
    $indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
    foreach ($script in $script:Scripts) {
        if ($indexText.Contains($script.Tag)) { $indexNeeds = $true }
    }
}
if ($indexNeeds) {
    $actions.Add([pscustomobject]@{ Kind = 'Index'; Name = $script:IndexRel; Full = $indexFull }) | Out-Null
}

Write-Head '回滚计划'
if ($actions.Count -eq 0) {
    Write-Host "`n没有检测到动态码登录入口，已是原始状态。" -ForegroundColor Green
    return
}
foreach ($item in $actions) {
    $label = if ($item.Kind -eq 'Delete') { '删除' } else { '清理引用' }
    Write-Item ("{0}  {1}" -f $label, $item.Name)
}

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

Write-Head '执行'
foreach ($item in $actions) {
    if ($item.Kind -eq 'Delete') {
        Remove-Item -LiteralPath $item.Full -Force
        Write-Item ("删除  " + $item.Name) 'Green'
    }
    else {
        $raw = [System.IO.File]::ReadAllBytes($item.Full)
        $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
        $text = [System.IO.File]::ReadAllText($item.Full, $encoding)
        foreach ($script in $script:Scripts) { $text = $text.Replace($script.Tag, '') }
        $out = $encoding.GetBytes($text)
        if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
        [System.IO.File]::WriteAllBytes($item.Full, $out)
        Write-Item ("清理引用  " + $item.Name) 'Green'
    }
}

Write-Head '校验'
$problems = 0
foreach ($script in $script:Scripts) {
    if (Test-Path -LiteralPath (Join-Path $Target "$($script:StaticRel)/$($script.Name)")) {
        Write-Item "$($script.Name) 仍存在" 'Red'; $problems++
    }
}
if (Test-Path -LiteralPath $indexFull -PathType Leaf) {
    $indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
    $left = @($script:Scripts | Where-Object { $indexText.Contains($_.Tag) })
    if ($left.Count -gt 0) { Write-Item "index.html 仍有 $($left.Count) 个引用" 'Red'; $problems++ }
    else { Write-Item "index.html 已清理" 'Green' }
}

Write-Head '完成'
if ($problems -gt 0) {
    Write-Host "  仍有 $problems 项未清理干净。" -ForegroundColor Red
    exit 1
}
Write-Host '  已撤回动态码登录入口，重启 CST Pilot 并 Ctrl+F5 后生效。' -ForegroundColor Green
