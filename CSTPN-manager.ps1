<#
.SYNOPSIS
    CSTP Next · 补丁管理器：交互式启用/回滚各补丁。

.DESCRIPTION
    统一管理 patch / add / test 三个分支的补丁，支持：

      - 交互式菜单：逐个选择启用或回滚
      - 冲突处理：WEB_INP 在 patch（半自动）与 add（全自动）下互斥，
        启用一侧自动卸载另一侧
      - 状态检测：显示每个补丁当前是否已安装

    补丁清单（标注来源分支）：

      [patch] WEB_EXP  导出（PNG/HTML/JSON，浏览器下载）
      [patch] WEB_ID   会话 ID 显示与复制
      [patch] WEB_INP  导入（半自动：生成文件 + 拖入目录）
      [add]   WEB_INP  导入（全自动：后端接口，需手工合并 api.ts）
      [patch] WEB_OTP  动态码登录入口 + 账户页 OA 文案
      [patch] WEB_SRH  会话列表搜索
      [test]  TOOL-SUMMARY  工具调用摘要面板
      [test]  TURN-NAV      轮次导航条
      [test]  SESSION-PLUS  置顶/行内重命名/会话内搜索

.PARAMETER Target
    cst-pilot 目录。省略时依次尝试 <脚本目录>\cst-pilot 与 <脚本目录>。

.PARAMETER Source
    补丁脚本根目录（含 WEB_EXP/WEB_ID/... 子目录，或平铺的 CSTPN-*.ps1）。
    默认取脚本自身所在目录。

.PARAMETER NonInteractive
    非交互模式：只显示状态，不进入菜单。

.EXAMPLE
    .\CSTPN-manager.ps1 -Target 'C:\Users\ANWEN\Desktop\cst-pilot'
.EXAMPLE
    .\CSTPN-manager.ps1 -Target '...' -NonInteractive
#>
[CmdletBinding()]
param(
    [string]$Target,
    [string]$Source,
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'

$script:StaticRel = 'agent/home/extensions/web/static'
$script:IndexRel = "$($script:StaticRel)/index.html"

# ---------------------------------------------------------------- 补丁定义
# Branch: 来源分支标注；Apply/Rollback: 脚本文件名（相对 Source 或本目录）；
# Conflicts: 互斥补丁 Id；Files: 安装后出现的标记文件（检测状态用）
$script:Catalog = @(
    @{
        Id = 'WEB_EXP'; Branch = 'patch'; Name = '导出（PNG/HTML/JSON，浏览器下载）'
        Apply = 'CSTPN-apply-export.ps1'; Rollback = 'CSTPN-rollback-export.ps1'
        Conflicts = @(); Marker = 'CSTPN-session-export.js'
    },
    @{
        Id = 'WEB_ID'; Branch = 'patch'; Name = '会话 ID 显示与复制'
        Apply = 'CSTPN-apply-idimp.ps1'; Rollback = 'CSTPN-rollback-idimp.ps1'
        Conflicts = @(); Marker = 'CSTPN-session-id.js'
    },
    @{
        Id = 'WEB_INP'; Branch = 'patch'; Name = '导入 · 半自动（生成文件 + 拖入目录）'
        Apply = 'CSTPN-apply-idimp.ps1'; Rollback = 'CSTPN-rollback-idimp.ps1'
        Conflicts = @('WEB_INP_ADD'); Marker = 'CSTPN-session-import.js'
        SharedWith = 'WEB_ID'
    },
    @{
        Id = 'WEB_INP_ADD'; Branch = 'add'; Name = '导入 · 全自动（后端接口，需手工合并 api.ts）'
        Apply = $null; Rollback = $null   # 后端部分手工，管理器只负责前端+提示
        Conflicts = @('WEB_INP'); Marker = 'CSTPN-backend-import.ts'
        SharedWith = 'WEB_ID'
    },
    @{
        Id = 'WEB_OTP'; Branch = 'patch'; Name = '动态码登录入口 + 账户页 OA 文案'
        Apply = 'CSTPN-apply-otp.ps1'; Rollback = 'CSTPN-rollback-otp.ps1'
        Conflicts = @(); Marker = 'CSTPN-cstoa-open-auth.js'
        Extra = @{ Apply = 'CSTPN-apply-oa-login-text.ps1'; Rollback = 'CSTPN-rollback-oa-login-text.ps1' }
    },
    @{
        Id = 'WEB_SRH'; Branch = 'patch'; Name = '会话列表搜索'
        Apply = 'CSTPN-apply-srh.ps1'; Rollback = 'CSTPN-rollback-srh.ps1'
        Conflicts = @(); Marker = 'CSTPN-session-search.js'
    },
    @{
        Id = 'TOOL-SUMMARY'; Branch = 'test'; Name = '工具调用摘要面板'
        Apply = $null; Rollback = $null     # test 期单文件，管理器直接拷/删
        Conflicts = @(); Marker = 'CSTPN-tool-summary.js'
        Script = 'CSTPN-tool-summary.js'
    },
    @{
        Id = 'TURN-NAV'; Branch = 'test'; Name = '轮次导航条'
        Apply = $null; Rollback = $null
        Conflicts = @(); Marker = 'CSTPN-turn-nav.js'
        Script = 'CSTPN-turn-nav.js'
    },
    @{
        Id = 'SESSION-PLUS'; Branch = 'test'; Name = '置顶 / 行内重命名 / 会话内搜索'
        Apply = $null; Rollback = $null
        Conflicts = @('WEB_SRH')            # 搜索功能重叠
        Marker = 'CSTPN-session-plus.js'
        Script = 'CSTPN-session-plus.js'
    }
)

function Write-Head([string]$Text) {
    Write-Host ""
    Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Test-Kit([string]$Path) {
    if (-not $Path) { return $false }
    return (Test-Path -LiteralPath (Join-Path $Path 'agent/home/extensions/oauth/oa.ts') -PathType Leaf)
}

# ---------------------------------------------------------------- 状态检测
function Get-State([string]$Target, $item) {
    $installed = Test-Path -LiteralPath (Join-Path $Target "$($script:StaticRel)/$($item.Marker)") -PathType Leaf
    if ($item.Id -eq 'WEB_INP_ADD') {
        # add 导入的前端部分与 patch 相同；真正区别是后端 ts 是否已合并
        $frontend = Test-Path -LiteralPath (Join-Path $Target "$($script:StaticRel)/CSTPN-session-import.js") -PathType Leaf
        $backendMerged = Select-String -Path (Join-Path $Target 'agent/home/extensions/web/server/api.ts') -Pattern 'cstpn-import' -Quiet -ErrorAction SilentlyContinue
        $installed = $frontend -and $backendMerged
    }
    return $installed
}

function Show-Status([string]$Target) {
    Write-Head '当前状态'
    foreach ($item in $script:Catalog) {
        $installed = Get-State $Target $item
        $mark = if ($installed) { '[已启用]' } else { '[  无  ]' }
        $color = if ($installed) { 'Green' } else { 'DarkGray' }
        $conflict = if ($item.Conflicts.Count) { " (互斥: $($item.Conflicts -join '/'))" } else { '' }
        Write-Host "  $mark [$($item.Branch)] $($item.Id)  $($item.Name)$conflict" -ForegroundColor $color
    }
    # 提示已安装脚本与 index 引用数
    $static = Join-Path $Target $script:StaticRel
    $scripts = (Get-ChildItem $static -Filter 'CSTPN-*.js' -ErrorAction SilentlyContinue).Count
    $idxText = [System.IO.File]::ReadAllText((Join-Path $Target $script:IndexRel))
    $refs = ([regex]::Matches($idxText, 'src="/CSTPN-[^"]+\.js"')).Count
    Write-Host ""
    Write-Host "  （static 下 CSTPN-*.js 共 $scripts 个；index.html 引用 $refs 个）" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- 动作
function Invoke-PatchScript([string]$ScriptPath, [string]$Target, [string]$SourceDir, [switch]$WhatIf) {
    if (-not (Test-Path -LiteralPath $ScriptPath)) { throw "找不到脚本：$ScriptPath" }
    $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ScriptPath, '-Target', $Target, '-Source', $SourceDir)
    if ($WhatIf) { $args += '-DryRun' }
    & powershell @args
    if ($LASTEXITCODE -ne 0) { throw "脚本执行失败（退出码 $LASTEXITCODE）" }
}

function Copy-TestScript([string]$Target, [string]$SourceDir, [string]$Name, [switch]$Remove) {
    $static = Join-Path $Target $script:StaticRel
    $index = Join-Path $static 'index.html'
    $tag = "<script type=`"module`" src=`"/$Name`"></script>"
    $encoding = New-Object System.Text.UTF8Encoding($false)

    if ($Remove) {
        $dst = Join-Path $static $Name
        if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
        $raw = [System.IO.File]::ReadAllBytes($index)
        $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF)
        $text = [System.IO.File]::ReadAllText($index, $encoding).Replace($tag, '')
        $out = $encoding.GetBytes($text)
        if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
        [System.IO.File]::WriteAllBytes($index, $out)
        Write-Host "  已移除 $Name" -ForegroundColor Green
        return
    }

    $src = Join-Path $SourceDir $Name
    if (-not (Test-Path -LiteralPath $src)) { throw "找不到 $Name（请把 test 脚本放到 -Source 目录）" }
    Copy-Item -LiteralPath $src -Destination (Join-Path $static $Name) -Force

    $raw = [System.IO.File]::ReadAllBytes($index)
    $hasBom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF)
    $text = [System.IO.File]::ReadAllText($index, $encoding)
    if (-not $text.Contains($tag)) {
        $pos = $text.IndexOf('</head>')
        $text = $text.Substring(0, $pos) + $tag + $text.Substring($pos)
    }
    $out = $encoding.GetBytes($text)
    if ($hasBom) { $out = [byte[]](0xEF, 0xBB, 0xBF) + $out }
    [System.IO.File]::WriteAllBytes($index, $out)
    Write-Host "  已安装 $Name" -ForegroundColor Green
}

function Enable-Patch([string]$Target, $item, [string]$SourceDir) {
    # 先卸载互斥补丁
    foreach ($conflictId in $item.Conflicts) {
        $other = $script:Catalog | Where-Object { $_.Id -eq $conflictId }
        if ($other -and (Get-State $Target $other)) {
            Write-Host "  ↳ 检测到冲突：$($other.Id) 已启用，先卸载…" -ForegroundColor Yellow
            Disable-Patch $Target $other $SourceDir
        }
    }

    if ($item.Id -eq 'WEB_INP_ADD') {
        Write-Host "  WEB_INP_ADD 的前端部分即 WEB_INP 补丁，现在安装…" -ForegroundColor Yellow
        $frontend = $script:Catalog | Where-Object { $_.Id -eq 'WEB_INP' }
        Invoke-PatchScript (Join-Path $SourceDir $frontend.Apply) $Target $SourceDir
        Write-Host ""
        Write-Host "  ⚠️ 后端部分需手工合并：把 WEB_INP/CSTPN-backend-import.ts 的内容" -ForegroundColor Yellow
        Write-Host "     接入 agent/home/extensions/web/server/api.ts（详见 add 分支 README）。" -ForegroundColor Yellow
        return
    }

    if ($item.Apply) {
        Invoke-PatchScript (Join-Path $SourceDir $item.Apply) $Target $SourceDir
        if ($item.Extra -and $item.Extra.Apply) {
            Invoke-PatchScript (Join-Path $SourceDir $item.Extra.Apply) $Target $SourceDir
        }
    }
    elseif ($item.Script) {
        Copy-TestScript $Target $SourceDir $item.Script
    }
}

function Disable-Patch([string]$Target, $item, [string]$SourceDir) {
    if ($item.Id -eq 'WEB_INP_ADD') {
        $frontend = $script:Catalog | Where-Object { $_.Id -eq 'WEB_INP' }
        Disable-Patch $Target $frontend $SourceDir
        Write-Host "  ⚠️ 后端部分请手工移除 api.ts 里的两处新增（详见 add 分支 README）。" -ForegroundColor Yellow
        return
    }
    if ($item.Rollback) {
        Invoke-PatchScript (Join-Path $SourceDir $item.Rollback) $Target $SourceDir
        if ($item.Extra -and $item.Extra.Rollback) {
            Invoke-PatchScript (Join-Path $SourceDir $item.Extra.Rollback) $Target $SourceDir
        }
    }
    elseif ($item.Script) {
        Copy-TestScript $Target $SourceDir $item.Script -Remove
    }
}

# ---------------------------------------------------------------- 菜单
function Show-Menu([string]$Target, [string]$SourceDir) {
    while ($true) {
        Show-Status $Target
        Write-Host ""
        Write-Host "  输入补丁 ID 启用（如 WEB_EXP）；ID 前加 - 回滚（如 -WEB_EXP）；输入 q 退出。" -ForegroundColor Gray
        Write-Host "  例：WEB_INP_ADD 会自动卸载 WEB_INP；-WEB_INP 反之。" -ForegroundColor Gray
        $choice = Read-Host "  > "
        $choice = $choice.Trim()
        if (-not $choice) { continue }
        if ($choice -eq 'q' -or $choice -eq 'Q') { break }

        $isRollback = $choice.StartsWith('-')
        $id = if ($isRollback) { $choice.Substring(1) } else { $choice }
        $item = $script:Catalog | Where-Object { $_.Id -ieq $id } | Select-Object -First 1
        if (-not $item) {
            Write-Host "  未知补丁 ID：$id" -ForegroundColor Red
            continue
        }
        Write-Head "$(if ($isRollback) { '回滚' } else { '启用' }) $($item.Branch)/$($item.Id)"
        try {
            if ($isRollback) { Disable-Patch $Target $item $SourceDir }
            else { Enable-Patch $Target $item $SourceDir }
        } catch {
            Write-Host "  操作失败：$($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ---------------------------------------------------------------- 入口
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $Source) { $Source = $scriptDir }

if (-not $Target) {
    $sibling = Join-Path $scriptDir 'cst-pilot'
    if (Test-Kit $sibling) { $Target = $sibling }
    elseif (Test-Kit $scriptDir) { $Target = $scriptDir }
}
if (-not $Target) { Write-Host '没找到 cst-pilot，请用 -Target 指定。' -ForegroundColor Red; exit 1 }
if (-not (Test-Kit $Target)) { Write-Host "目标目录不像 cst-pilot：$Target" -ForegroundColor Red; exit 1 }
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Host "CSTPN 补丁管理器" -ForegroundColor Cyan
Write-Host "目标   $Target"
Write-Host "补丁源 $Source"

if ($NonInteractive) {
    Show-Status $Target
} else {
    Show-Menu $Target $Source
}
