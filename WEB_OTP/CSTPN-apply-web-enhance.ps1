<#
.SYNOPSIS
    CSTP Next · 为 CST Pilot Web 端安装会话导出与动态码登录入口。

.DESCRIPTION
    把两个独立前端脚本装进 cst-pilot，并注册到 index.html：

    1. CSTPN-session-export.js
       会话右键菜单新增「导出（CSTP Next）」，导出完成后自动打开资源管理器。
       - 单选：导出被右键的会话
       - 管理模式多选：逐个导出全部已勾选会话

    2. CSTPN-cstoa-open-auth.js
       CSTOA 扫码卡片下方提供「使用动态码登录（CSTP Next）」入口，
       地址取自后端下发的 official verification_uri_complete。

    全部复用后端既有接口，不新增路由、不接受任意路径：
      POST /api/sessions/<id>/exports
      GET  /api/exports/<exportId>
      POST /api/exports/<exportId>/open

    安全约束：
    - 写入前备份 index.html 到 <目标>\patch-backup-cstpn-web-<时间戳>；
    - 可重复运行，引用已存在时跳过；
    - 只追加 <script> 标签，不改动 index.html 其余内容。

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Source
    两个 .js 源文件所在目录。默认取脚本自身所在目录。

.PARAMETER DryRun
    只检查并打印计划，不写入任何文件。

.EXAMPLE
    .\CSTPN-apply-web-enhance.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot' -DryRun
.EXAMPLE
    .\CSTPN-apply-web-enhance.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
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
    @{ Name = 'CSTPN-session-export.js';   Tag = '<script type="module" src="/CSTPN-session-export.js"></script>' },
    @{ Name = 'CSTPN-cstoa-open-auth.js'; Tag = '<script type="module" src="/CSTPN-cstoa-open-auth.js"></script>' }
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

# ---------------------------------------------------------------------------
# 定位目标
# ---------------------------------------------------------------------------

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Source) { $Source = $scriptDir }

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

Write-Head "CSTPN Web 增强 v$script:PatchVersion"
Write-Item "目标   $Target"
Write-Item "源目录 $Source"
if ($DryRun) { Write-Item '模式   预演（不写文件）' 'Yellow' }

$encoding = New-Object System.Text.UTF8Encoding($false)

# ---------------------------------------------------------------------------
# 校验源文件
# ---------------------------------------------------------------------------

$problems = New-Object System.Collections.ArrayList
foreach ($script in $script:Scripts) {
    $src = Join-Path $Source $script.Name
    if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
        $problems.Add("缺少源文件：$src") | Out-Null
    }
}
if ($problems.Count -gt 0) {
    Write-Head '无法继续'
    foreach ($problem in $problems) { Write-Item $problem 'Red' }
    Write-Item "请把两个 .js 与本脚本放在同一目录，或用 -Source 指定。" 'Yellow'
    exit 1
}

# ---------------------------------------------------------------------------
# 生成计划
# ---------------------------------------------------------------------------

$copies = New-Object System.Collections.ArrayList
foreach ($script in $script:Scripts) {
    $src = Join-Path $Source $script.Name
    $dst = Join-Path $Target "$($script:StaticRel)/$($script.Name)"
    $needCopy = $true
    if (Test-Path -LiteralPath $dst -PathType Leaf) {
        $srcHash = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash
        $dstHash = (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
        if ($srcHash -eq $dstHash) { $needCopy = $false }
    }
    if ($needCopy) {
        $copies.Add([pscustomobject]@{ Name = $script.Name; Source = $src; Destination = $dst }) | Out-Null
    }
    else {
        Write-Item "跳过   $($script.Name)（内容已一致）" 'DarkGray'
    }
}

$indexFull = Join-Path $Target $script:IndexRel
if (-not (Test-Path -LiteralPath $indexFull -PathType Leaf)) {
    Fail "缺少文件：$($script:IndexRel)"
}
$indexText = [System.IO.File]::ReadAllText($indexFull, $encoding)
if ($indexText.IndexOf('</head>') -lt 0) {
    Fail "$($script:IndexRel) 里找不到 </head>。"
}
$missingTags = @($script:Scripts | Where-Object { -not $indexText.Contains($_.Tag) })

Write-Head '改动计划'
if ($copies.Count -eq 0 -and $missingTags.Count -eq 0) {
    Write-Host "`n脚本与引用都已就位，无需重复执行。" -ForegroundColor Green
    return
}
foreach ($item in $copies) { Write-Item ("安装  " + $item.Name) }
if ($missingTags.Count -gt 0) {
    Write-Item "更新  $($script:IndexRel)  (补 $($missingTags.Count) 个引用)"
}

if ($DryRun) {
    Write-Host "`n预演完成，未写入任何文件。" -ForegroundColor Yellow
    return
}

# ---------------------------------------------------------------------------
# 备份
# ---------------------------------------------------------------------------

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $Target ("patch-backup-cstpn-web-" + $stamp)
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Copy-Item -LiteralPath $indexFull -Destination (Join-Path $backupDir 'index.html') -Force
Write-Head '备份'
Write-Item $backupDir

# ---------------------------------------------------------------------------
# 写入
# ---------------------------------------------------------------------------

Write-Head '写入'
foreach ($item in $copies) {
    $parent = Split-Path -Parent $item.Destination
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    Copy-Item -LiteralPath $item.Source -Destination $item.Destination -Force
    Write-Item ("安装  " + $item.Name) 'Green'
}

if ($missingTags.Count -gt 0) {
    $raw = [System.IO.File]::ReadAllBytes($indexFull)
    $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF -and $raw[1] -eq 0xBB -and $raw[2] -eq 0xBF)
    $text = [System.IO.File]::ReadAllText($indexFull, $encoding)
    foreach ($script in $missingTags) {
        $position = $text.IndexOf('</head>')
        $text = $text.Substring(0, $position) + $script.Tag + $text.Substring($position)
    }
    $outBytes = $encoding.GetBytes($text)
    if ($hasBom) { $outBytes = [byte[]](0xEF, 0xBB, 0xBF) + $outBytes }
    [System.IO.File]::WriteAllBytes($indexFull, $outBytes)
    Write-Item ("更新  " + $script:IndexRel) 'Green'
}

Write-Head '完成'
Write-Host '  重启 CST Pilot（关闭 pi-web.cmd 窗口后重新启动），并按 Ctrl+F5 强刷。' -ForegroundColor Green
Write-Host '  - 会话列表右键 → 「导出（CSTP Next）」：单选导出当前会话，多选导出全部已勾选会话。' -ForegroundColor Green
Write-Host '  - 导出完成后自动打开资源管理器，定位到 artifacts\<日期>\sessions\。' -ForegroundColor Green
Write-Host "`n  需要回滚：.\CSTPN-rollback-web-enhance.ps1 -Target '$Target'" -ForegroundColor Gray
