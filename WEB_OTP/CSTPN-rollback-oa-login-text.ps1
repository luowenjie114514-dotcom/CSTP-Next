# CSTPN Rollback - 一键撤回 CSTP Next 对 cst-pilot 的全部修改
#
# 撤回内容：
#   1. 账户页文案  「OA登录」 -> 「重新扫码登录」 / 「扫码登录」
#   2. 删除入口脚本 CSTPN-cstoa-open-auth.js
#   3. 移除 index.html 里的对应 <script> 引用
#
# 用法：
#   .\CSTPN-rollback-oa-login-text.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
#   .\CSTPN-rollback-oa-login-text.ps1 -Target '...' -DryRun     只预演
#   .\CSTPN-rollback-oa-login-text.ps1 -Target '...' -FromBackup 优先用备份还原
#
# 说明：优先按备份目录还原（最忠实）；没有备份时按文案反向替换 + 清理新增文件。

[CmdletBinding()]
param(
    [string]$Target,
    [string]$FromBackup,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$script:RollbackVersion = '1.0.0'
$script:StaticRel = 'agent/home/extensions/web/static'
$script:IndexRel = "$($script:StaticRel)/index.html"
$script:ScriptName = 'CSTPN-cstoa-open-auth.js'
$script:IndexTag = '<script type="module" src="/CSTPN-cstoa-open-auth.js"></script>'
$script:OldScriptName = 'cstoa-open-auth.js'   # 兼容早期未加前缀的版本
$script:OldIndexTag = '<script type="module" src="/cstoa-open-auth.js"></script>'

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
    Fail "目标目录不像 cst-pilot：$Target"
}
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Head "CSTPN OA 登录文案回滚 v$script:RollbackVersion"
Write-Item "目标   $Target"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)
$actions = New-Object System.Collections.ArrayList

# ---------------------------------------------------------------------------
# 1) 文案还原
# ---------------------------------------------------------------------------

$assetsDir = Join-Path $Target "$($script:StaticRel)/assets"
$bundleNames = @('account-CdZf2BiP.js', 'account-p87PK_Ck.js')

# 若指定或存在备份目录，优先取其中的原件。
# 注意：必须选「包含 account-*.js 原件」的备份；后续补丁只备份 index.html，
# 若简单取最新目录会因缺少 account 文件而退化成有损的反向替换。
$backupDir = $null
if ($FromBackup) {
    if (-not (Test-Path -LiteralPath $FromBackup)) { Fail "备份目录不存在：$FromBackup" }
    $backupDir = (Resolve-Path -LiteralPath $FromBackup).Path
}
else {
    $candidates = Get-ChildItem -LiteralPath $Target -Directory -Filter 'patch-backup-oa-text-*' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending
    foreach ($candidate in $candidates) {
        $hasBundle = $false
        foreach ($name in $bundleNames) {
            if (Test-Path -LiteralPath (Join-Path $candidate.FullName $name) -PathType Leaf) { $hasBundle = $true; break }
        }
        if ($hasBundle) { $backupDir = $candidate.FullName; break }
    }
    if (-not $backupDir -and $candidates) { $backupDir = $candidates[0].FullName }
}

if ($backupDir) {
    Write-Item "备份   $backupDir" 'DarkGray'
}
else {
    Write-Item "备份   未找到（将按文案反向替换）" 'DarkGray'
}

foreach ($name in $bundleNames) {
    $full = Join-Path $assetsDir $name
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }

    $backupFile = if ($backupDir) { Join-Path $backupDir $name } else { '' }
    if ($backupFile -and (Test-Path -LiteralPath $backupFile -PathType Leaf)) {
        # 只有当前文件确实被改过才还原，避免覆盖后续升级。
        $current = [System.IO.File]::ReadAllText($full, $encoding)
        if ($current.Contains('"OA登录"')) {
            $actions.Add([pscustomobject]@{ Kind = 'Restore'; Name = $name; Full = $full; Source = $backupFile }) | Out-Null
        }
    }
    else {
        $current = [System.IO.File]::ReadAllText($full, $encoding)
        if ($current.Contains('"OA登录"')) {
            # 没有备份时无法区分原本是「重新扫码登录」还是「扫码登录」，
            # 统一恢复为「扫码登录」并提示，避免静默产生错误文案。
            $actions.Add([pscustomobject]@{ Kind = 'Reverse'; Name = $name; Full = $full }) | Out-Null
        }
    }
}

# ---------------------------------------------------------------------------
# 2) 删除入口脚本
# ---------------------------------------------------------------------------

foreach ($scriptName in @($script:ScriptName, $script:OldScriptName)) {
    $entry = Join-Path $Target "$($script:StaticRel)/$scriptName"
    if (Test-Path -LiteralPath $entry -PathType Leaf) {
        $actions.Add([pscustomobject]@{ Kind = 'Delete'; Name = $scriptName; Full = $entry }) | Out-Null
    }
}

# ---------------------------------------------------------------------------
# 3) 清理 index.html 引用
# ---------------------------------------------------------------------------

$indexFull = Join-Path $Target $script:IndexRel
$indexNeeds = $false
if (Test-Path -LiteralPath $indexFull -PathType Leaf) {
    $indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
    if ($indexText.Contains($script:IndexTag) -or $indexText.Contains($script:OldIndexTag)) {
        $indexNeeds = $true
        $actions.Add([pscustomobject]@{ Kind = 'Index'; Name = $script:IndexRel; Full = $indexFull }) | Out-Null
    }
}

# ---------------------------------------------------------------------------
# 计划
# ---------------------------------------------------------------------------

Write-Head '回滚计划'
if ($actions.Count -eq 0) {
    Write-Host "`n没有检测到需要撤回的修改，cst-pilot 已是原始状态。" -ForegroundColor Green
    return
}
foreach ($item in $actions) {
    $label = switch ($item.Kind) {
        'Restore' { '还原' }
        'Reverse' { '反向替换' }
        'Delete'  { '删除' }
        'Index'   { '清理引用' }
        default   { '处理' }
    }
    Write-Item ("{0}  {1}" -f $label, $item.Name)
}

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

# ---------------------------------------------------------------------------
# 执行
# ---------------------------------------------------------------------------

Write-Head '执行'
foreach ($item in $actions) {
    switch ($item.Kind) {
        'Restore' {
            Copy-Item -LiteralPath $item.Source -Destination $item.Full -Force
            Write-Item ("还原  " + $item.Name) 'Green'
        }
        'Reverse' {
            $text = [System.IO.File]::ReadAllText($item.Full, $encoding)
            $raw = [System.IO.File]::ReadAllBytes($item.Full)
            $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
            # 反向替换：账户页两个按钮恢复为原本文案。
            $text = $text.Replace('"OA登录"', '"扫码登录"')
            $out = $encoding.GetBytes($text)
            if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
            [System.IO.File]::WriteAllBytes($item.Full, $out)
            Write-Item ("反向替换  " + $item.Name) 'Yellow'
        }
        'Delete' {
            Remove-Item -LiteralPath $item.Full -Force
            Write-Item ("删除  " + $item.Name) 'Green'
        }
        'Index' {
            $raw = [System.IO.File]::ReadAllBytes($item.Full)
            $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
            $text = [System.IO.File]::ReadAllText($item.Full, $encoding)
            $text = $text.Replace($script:IndexTag, '').Replace($script:OldIndexTag, '')
            $out = $encoding.GetBytes($text)
            if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
            [System.IO.File]::WriteAllBytes($item.Full, $out)
            Write-Item ("清理引用  " + $item.Name) 'Green'
        }
    }
}

# ---------------------------------------------------------------------------
# 校验
# ---------------------------------------------------------------------------

Write-Head '校验'
$problems = 0
foreach ($name in $bundleNames) {
    $full = Join-Path $assetsDir $name
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { continue }
    $text = [System.IO.File]::ReadAllText($full, $encoding)
    if ($text.Contains('"OA登录"')) {
        Write-Item "$name 仍含 OA登录" 'Red'
        $problems++
    }
    else {
        Write-Item "$name 已恢复" 'Green'
    }
}
foreach ($scriptName in @($script:ScriptName, $script:OldScriptName)) {
    if (Test-Path -LiteralPath (Join-Path $Target "$($script:StaticRel)/$scriptName")) {
        Write-Item "$scriptName 仍存在" 'Red'
        $problems++
    }
}
if (Test-Path -LiteralPath $indexFull -PathType Leaf) {
    $indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
    if ($indexText.Contains($script:IndexTag) -or $indexText.Contains($script:OldIndexTag)) {
        Write-Item "index.html 仍含引用" 'Red'
        $problems++
    }
    else {
        Write-Item "index.html 已清理" 'Green'
    }
}

Write-Head '完成'
if ($problems -gt 0) {
    Write-Host "  仍有 $problems 项未处理干净，请检查上面的红字。" -ForegroundColor Red
    exit 1
}
Write-Host '  已撤回全部修改，重启 CST Pilot 后回到原始状态。' -ForegroundColor Green
