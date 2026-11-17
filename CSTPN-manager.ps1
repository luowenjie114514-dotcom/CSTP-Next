<#
.SYNOPSIS
    CSTP Next · 补丁管理器。

.DESCRIPTION
    交互式启用/回滚各补丁，支持远程同步与自动下载。

    核心能力：
      - 启动时从 GitHub 拉取 CATALOG.md 更新补丁清单（失败则用内置清单）
      - 找不到 cst-pilot 时弹出文件夹选择对话框
      - 本地缺少补丁文件时自动从 GitHub 下载（按分支取对应文件）
      - 冲突补丁自动互斥（WEB_INP ↔ WEB_INP_ADD，WEB_SRH ↔ SESSION-PLUS）

.PARAMETER Target
    cst-pilot 目录。省略时自动探测，探测失败弹选择框。

.PARAMETER Source
    补丁缓存目录。默认 <脚本目录>\_cstpn-cache。

.PARAMETER NoSync
    跳过启动时的远程清单更新。

.PARAMETER NonInteractive
    只显示状态，不进入菜单。

.EXAMPLE
    .\CSTPN-manager.ps1
.EXAMPLE
    .\CSTPN-manager.ps1 -Target 'C:\kits\cst-pilot'
#>
[CmdletBinding()]
param(
    [string]$Target,
    [string]$Source,
    [switch]$NoSync,
    [switch]$NonInteractive
)

$ErrorActionPreference = 'Stop'

$script:Repo = 'luowenjie114514-dotcom/CSTP-Next'
$script:StaticRel = 'agent/home/extensions/web/static'
$script:IndexRel = "$($script:StaticRel)/index.html"
$script:ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:CacheDir = if ($Source) { $Source } else { Join-Path $script:ScriptDir '_cstpn-cache' }
$script:SyncInfo = '未同步'

# ---------------------------------------------------------------- 内置清单（远程失败时的兜底）
$script:Catalog = @(
    @{ Id='WEB_EXP'; Branch='patch'; Apply='WEB_EXP/CSTPN-apply-export.ps1'; Rollback='WEB_EXP/CSTPN-rollback-export.ps1'; Marker='CSTPN-session-export.js'; Name='导出（PNG/HTML/JSON，浏览器下载）'; Conflicts=@() },
    @{ Id='WEB_ID'; Branch='patch'; Apply='WEB_ID/CSTPN-apply-idimp.ps1'; Rollback='WEB_ID/CSTPN-rollback-idimp.ps1'; Marker='CSTPN-session-id.js'; Name='会话 ID 显示与复制'; Conflicts=@() },
    @{ Id='WEB_INP'; Branch='patch'; Apply='WEB_INP/CSTPN-apply-idimp.ps1'; Rollback='WEB_INP/CSTPN-rollback-idimp.ps1'; Marker='CSTPN-session-import.js'; Name='导入 · 半自动'; Conflicts=@('WEB_INP_ADD') },
    @{ Id='WEB_INP_ADD'; Branch='add'; Apply=''; Rollback=''; Marker=''; Name='导入 · 全自动（需手工合并 api.ts）'; Conflicts=@('WEB_INP') },
    @{ Id='WEB_OTP'; Branch='patch'; Apply='WEB_OTP/CSTPN-apply-otp.ps1'; Rollback='WEB_OTP/CSTPN-rollback-otp.ps1'; Marker='CSTPN-cstoa-open-auth.js'; Name='动态码登录入口'; Conflicts=@() },
    @{ Id='WEB_SRH'; Branch='patch'; Apply='WEB_SRH/CSTPN-apply-srh.ps1'; Rollback='WEB_SRH/CSTPN-rollback-srh.ps1'; Marker='CSTPN-session-search.js'; Name='会话列表搜索'; Conflicts=@('SESSION-PLUS') },
    @{ Id='TOOL-SUM'; Branch='test'; Apply=''; Rollback=''; Marker='CSTPN-tool-summary.js'; Name='工具调用摘要面板'; Conflicts=@() },
    @{ Id='TURN-NAV'; Branch='test'; Apply=''; Rollback=''; Marker='CSTPN-turn-nav.js'; Name='轮次导航条'; Conflicts=@() },
    @{ Id='SESSION-PLUS'; Branch='test'; Apply=''; Rollback=''; Marker='CSTPN-session-plus.js'; Name='置顶/行内重命名/会话内搜索'; Conflicts=@('WEB_SRH') }
)

function Write-Head([string]$Text) {
    Write-Host ""
    Write-Host "== $Text ==" -ForegroundColor Cyan
}

function Test-Kit([string]$Path) {
    if (-not $Path) { return $false }
    return (Test-Path -LiteralPath (Join-Path $Path 'agent/home/extensions/oauth/oa.ts') -PathType Leaf)
}

# ---------------------------------------------------------------- 远程清单
function Sync-Catalog {
    if ($NoSync) { $script:SyncInfo = '已跳过'; return }
    $md = $null

    # 方式 1：API contents（raw.githubusercontent 在部分网络被拦截）
    try {
        $headers = @{ Accept = 'application/vnd.github.raw'; 'User-Agent' = 'cstpn-manager' }
        if ($script:Token) { $headers['Authorization'] = "Bearer $($script:Token)" }
        $resp = Invoke-WebRequest -Uri "https://api.github.com/repos/$($script:Repo)/contents/CATALOG.md?ref=main" -Headers $headers -UseBasicParsing -TimeoutSec 10
        $md = $resp.Content
        if ($md -is [byte[]]) { $md = [System.Text.Encoding]::UTF8.GetString($md) }
    } catch { }

    # 方式 2：raw 兜底
    if (-not $md) {
        try {
            $md = (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/$($script:Repo)/main/CATALOG.md" -UseBasicParsing -TimeoutSec 10).Content
            if ($md -is [byte[]]) { $md = [System.Text.Encoding]::UTF8.GetString($md) }
        } catch { }
    }

    if (-not $md) { $script:SyncInfo = '远程不可用，用内置'; return }

    try {
        $items = @()
        $conflicts = @{}
        $cBlock = [regex]::Match($md, '(?s)```conflicts\r?\n(.*?)```')
        if ($cBlock.Success) {
            foreach ($line in ($cBlock.Groups[1].Value -split "`r?`n")) {
                if ($line -match '^\s*(\S+)\s*\|\s*(\S+)\s*$') {
                    $a = $Matches[1]; $b = $Matches[2]
                    if (-not $conflicts.ContainsKey($a)) { $conflicts[$a] = @() }
                    if (-not $conflicts.ContainsKey($b)) { $conflicts[$b] = @() }
                    $conflicts[$a] += $b
                    $conflicts[$b] += $a
                }
            }
        }
        $block = [regex]::Match($md, '(?s)```catalog\r?\n(.*?)```')
        if ($block.Success) {
            foreach ($line in ($block.Groups[1].Value -split "`r?`n")) {
                if (-not $line.Trim()) { continue }
                $p = $line -split '\s*\|\s*'
                if ($p.Count -lt 6) { continue }
                $id = $p[0].Trim()
                $applyVal = ''
                if ($p[2].Trim() -ne '-') { $applyVal = $p[2].Trim() }
                $rollbackVal = ''
                if ($p[3].Trim() -ne '-') { $rollbackVal = $p[3].Trim() }
                $markerVal = ''
                if ($p[4].Trim() -ne '-') { $markerVal = $p[4].Trim() }
                $conflictVal = @()
                if ($conflicts.ContainsKey($id)) { $conflictVal = $conflicts[$id] }
                $items += @{
                    Id = $id
                    Branch = $p[1].Trim()
                    Apply = $applyVal
                    Rollback = $rollbackVal
                    Marker = $markerVal
                    Name = $p[5].Trim()
                    Conflicts = $conflictVal
                }
            }
        }
        if ($items.Count -gt 0) {
            $script:Catalog = $items
            $script:SyncInfo = "已同步（$($items.Count) 项）"
        } else {
            $script:SyncInfo = '清单格式异常，用内置'
        }
    } catch {
        $script:SyncInfo = '解析失败，用内置'
    }
}

# ---------------------------------------------------------------- 目录选择
function Select-KitDirectory {
    Add-Type -AssemblyName System.Windows.Forms | Out-Null
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = '请选择 cst-pilot 目录（包含 agent 文件夹的那一层）'
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.SelectedPath
    }
    return $null
}

function Resolve-Target {
    if ($Target) { return $Target }
    $sibling = Join-Path $script:ScriptDir 'cst-pilot'
    if (Test-Kit $sibling) { return $sibling }
    if (Test-Kit $script:ScriptDir) { return $script:ScriptDir }
    if (Test-Kit (Get-Location).Path) { return (Get-Location).Path }

    Write-Host "未自动找到 cst-pilot 目录。" -ForegroundColor Yellow
    $picked = Select-KitDirectory
    if (-not $picked) {
        Write-Host "未选择目录，退出。" -ForegroundColor Red
        exit 1
    }
    return $picked
}

# ---------------------------------------------------------------- 远程下载
function Ensure-PatchFiles([string]$relPath, [string]$branch) {
    # 补丁脚本常需要同目录的 .js；启用前把该目录内所有已知文件拉到缓存
    $files = @($relPath)
    $dir = Split-Path $relPath -Parent
    if ($dir) {
        # 列出该目录在仓库里的全部文件，逐个确保存在
        $dirFiles = @()
        try {
            $headers = @{ 'User-Agent' = 'cstpn-manager'; Accept = 'application/vnd.github+json' }
            if ($script:Token) { $headers['Authorization'] = "Bearer $($script:Token)" }
            $api = "https://api.github.com/repos/$($script:Repo)/contents/$dir" + "?ref=$branch"
            $list = Invoke-RestMethod -Uri $api -Headers $headers -TimeoutSec 15
            foreach ($f in $list) {
                if ($f.type -eq 'file') { $dirFiles += "$dir/$($f.name)" }
            }
        } catch { }
        if ($dirFiles.Count -gt 0) { $files = $dirFiles }
    }

    $ok = $true
    foreach ($f in $files) {
        $got = Ensure-RemoteFile $f $branch
        if (-not $got) { $ok = $false }
    }
    return $ok
}

function Test-Online {
    try {
        $null = Invoke-WebRequest -Uri "https://api.github.com" -UseBasicParsing -TimeoutSec 6 -Method Head
        return $true
    } catch { return $false }
}

<#
 * 确保本地缓存里有某个文件；缺则从 GitHub 下载。
 * 返回本地路径，失败返回 $null。
 #>
function Ensure-RemoteFile([string]$relPath, [string]$branch) {
    if (-not $relPath) { return $null }
    $local = Join-Path $script:CacheDir ($relPath -replace '/', '\')
    if (Test-Path -LiteralPath $local -PathType Leaf) { return $local }

    $parent = Split-Path $local -Parent
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }

    $bytes = $null

    # 方式 1：API contents
    try {
        $apiUrl = "https://api.github.com/repos/$($script:Repo)/contents/$relPath" + "?ref=$branch"
        $headers = @{ Accept = 'application/vnd.github.raw'; 'User-Agent' = 'cstpn-manager' }
        if ($script:Token) { $headers['Authorization'] = "Bearer $($script:Token)" }
        $resp = Invoke-WebRequest -Uri $apiUrl -Headers $headers -UseBasicParsing -TimeoutSec 20
        $bytes = $resp.Content
    } catch { }

    # 方式 2：raw 兜底
    if (-not $bytes) {
        try {
            $rawUrl = "https://raw.githubusercontent.com/$($script:Repo)/$branch/$relPath"
            $resp = Invoke-WebRequest -Uri $rawUrl -UseBasicParsing -TimeoutSec 20
            $bytes = $resp.Content
        } catch { }
    }

    if (-not $bytes) {
        Write-Host "    下载失败：$relPath" -ForegroundColor Red
        return $null
    }

    if ($bytes -is [string]) { $bytes = [System.Text.Encoding]::UTF8.GetBytes($bytes) }
    [System.IO.File]::WriteAllBytes($local, [byte[]]$bytes)
    Write-Host "    已下载 $relPath（$($bytes.Length)B）" -ForegroundColor DarkGray
    return $local
}

# ---------------------------------------------------------------- 状态
function Get-State([string]$Kit, $item) {
    if ($item.Id -eq 'WEB_INP_ADD') {
        $fe = Test-Path -LiteralPath (Join-Path $Kit "$($script:StaticRel)/CSTPN-session-import.js") -PathType Leaf
        $be = Select-String -Path (Join-Path $Kit 'agent/home/extensions/web/server/api.ts') -Pattern 'cstpn-import' -Quiet -ErrorAction SilentlyContinue
        return ($fe -and $be)
    }
    if (-not $item.Marker) { return $false }
    return (Test-Path -LiteralPath (Join-Path $Kit "$($script:StaticRel)/$($item.Marker)") -PathType Leaf)
}

function Show-Status([string]$Kit) {
    Write-Head "当前状态（清单：$($script:SyncInfo)）"
    foreach ($item in $script:Catalog) {
        $installed = Get-State $Kit $item
        $mark = if ($installed) { '[已启用]' } else { '[  无  ]' }
        $color = if ($installed) { 'Green' } else { 'DarkGray' }
        $conf = if ($item.Conflicts.Count) { " (互斥: $($item.Conflicts -join '/'))" } else { '' }
        $tag = "[$($item.Branch)]".PadRight(8)
        Write-Host "  $mark $tag $($item.Id.PadRight(13)) $($item.Name)$conf" -ForegroundColor $color
    }
    $static = Join-Path $Kit $script:StaticRel
    $n = (Get-ChildItem $static -Filter 'CSTPN-*.js' -ErrorAction SilentlyContinue).Count
    Write-Host ""
    Write-Host "  （static 下 CSTPN-*.js 共 $n 个）" -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- 执行
function Invoke-Script([string]$ScriptPath, [string]$Kit, [string]$SourceDir) {
    $argv = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $ScriptPath, '-Target', $Kit)
    if ((Split-Path $ScriptPath -Leaf) -notlike 'CSTPN-rollback-*') { $argv += @('-Source', $SourceDir) }
    $out = & powershell @argv 2>&1
    $code = $LASTEXITCODE
    $out | ForEach-Object { Write-Host "    $_" }
    if ($code -ne 0) { throw "脚本失败（$([System.IO.Path]::GetFileName($ScriptPath))，退出码 $code）" }
}

<# 测试补丁：直接拷 js + 改 index.html。 #>
function Set-TestPatch([string]$Kit, [string]$Name, [switch]$Remove) {
    $static = Join-Path $Kit $script:StaticRel
    $index = Join-Path $static 'index.html'
    $tag = "<script type=`"module`" src=`"/$Name`"></script>"
    $enc = New-Object System.Text.UTF8Encoding($false)

    if ($Remove) {
        $dst = Join-Path $static $Name
        if (Test-Path -LiteralPath $dst) { Remove-Item -LiteralPath $dst -Force }
        $raw = [System.IO.File]::ReadAllBytes($index)
        $bom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF)
        $text = [System.IO.File]::ReadAllText($index, $enc).Replace($tag, '')
        $out = $enc.GetBytes($text)
        if ($bom) { $out = [byte[]](0xEF,0xBB,0xBF) + $out }
        [System.IO.File]::WriteAllBytes($index, $out)
        Write-Host "    已移除 $Name" -ForegroundColor Green
        return
    }

    # 本地缓存找，没有则远程下载
    $candidates = @(
        (Join-Path $script:CacheDir $Name),
        (Join-Path $script:ScriptDir $Name),
        (Join-Path $script:ScriptDir "test-scripts\$Name")
    )
    $src = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (-not $src) {
        # 尝试从 test 分支的对应目录下载
        $dirMap = @{ 'CSTPN-tool-summary.js'='TOOL-SUM'; 'CSTPN-turn-nav.js'='TURN-NAV'; 'CSTPN-session-plus.js'='SESSION-PLUS' }
        $dir = $dirMap[$Name]
        if ($dir) { $src = Ensure-RemoteFile "$dir/$Name" 'test' }
    }
    if (-not $src) { throw "找不到 $Name（也不在本地缓存）" }

    Copy-Item -LiteralPath $src -Destination (Join-Path $static $Name) -Force

    $raw = [System.IO.File]::ReadAllBytes($index)
    $bom = ($raw.Length -ge 3 -and $raw[0] -eq 0xEF)
    $text = [System.IO.File]::ReadAllText($index, $enc)
    if (-not $text.Contains($tag)) {
        $pos = $text.IndexOf('</head>')
        $text = $text.Substring(0, $pos) + $tag + $text.Substring($pos)
    }
    $out = $enc.GetBytes($text)
    if ($bom) { $out = [byte[]](0xEF,0xBB,0xBF) + $out }
    [System.IO.File]::WriteAllBytes($index, $out)
    Write-Host "    已安装 $Name" -ForegroundColor Green
}

function Enable-Patch([string]$Kit, $item) {
    foreach ($cid in $item.Conflicts) {
        $other = $script:Catalog | Where-Object { $_.Id -eq $cid } | Select-Object -First 1
        if ($other -and (Get-State $Kit $other)) {
            Write-Host "  ↳ 冲突：$($other.Id) 已启用，先卸载…" -ForegroundColor Yellow
            Disable-Patch $Kit $other
        }
    }

    if ($item.Id -eq 'WEB_INP_ADD') {
        Write-Host "  全自动导入的前端部分复用 WEB_INP，先装它…" -ForegroundColor Yellow
        $fe = $script:Catalog | Where-Object { $_.Id -eq 'WEB_INP' } | Select-Object -First 1
        Enable-Patch $Kit $fe
        Write-Host ""
        Write-Host "  ⚠️ 后端需手工合并 WEB_INP/CSTPN-backend-import.ts 到 api.ts" -ForegroundColor Yellow
        return
    }

    if ($item.Apply) {
        # 连同目录内其他文件一起准备（补丁脚本通常依赖同目录 .js）
        $null = Ensure-PatchFiles $item.Apply $item.Branch
        $local = Join-Path $script:CacheDir ($item.Apply -replace '/', '\')
        if (-not (Test-Path -LiteralPath $local)) { throw "无法获取 $($item.Apply)" }
        Invoke-Script $local $Kit (Split-Path $local -Parent)
        return
    }

    if ($item.Marker) { Set-TestPatch $Kit $item.Marker }
}

function Disable-Patch([string]$Kit, $item) {
    if ($item.Id -eq 'WEB_INP_ADD') {
        $fe = $script:Catalog | Where-Object { $_.Id -eq 'WEB_INP' } | Select-Object -First 1
        Disable-Patch $Kit $fe
        return
    }
    if ($item.Rollback) {
        $null = Ensure-PatchFiles $item.Rollback $item.Branch
        $local = Join-Path $script:CacheDir ($item.Rollback -replace '/', '\')
        if (-not (Test-Path -LiteralPath $local)) { throw "无法获取 $($item.Rollback)" }
        Invoke-Script $local $Kit (Split-Path $local -Parent)
        return
    }
    if ($item.Marker) { Set-TestPatch $Kit $item.Marker -Remove }
}

# ---------------------------------------------------------------- 菜单
function Show-Menu([string]$Kit) {
    while ($true) {
        Show-Status $Kit
        Write-Host ""
        Write-Host "  输入补丁 ID 启用；ID 前加 - 回滚；r 重新同步清单；q 退出。" -ForegroundColor Gray
        $choice = (Read-Host "  > ").Trim()
        if (-not $choice) { continue }
        if ($choice -eq 'q') { break }
        if ($choice -eq 'r') { $script:NoSync = $false; Sync-Catalog; continue }

        $isRollback = $choice.StartsWith('-')
        $id = if ($isRollback) { $choice.Substring(1) } else { $choice }
        $item = $script:Catalog | Where-Object { $_.Id -ieq $id } | Select-Object -First 1
        if (-not $item) { Write-Host "  未知补丁：$id" -ForegroundColor Red; continue }

        $action = if ($isRollback) { '回滚' } else { '启用' }
        Write-Head "$action $($item.Branch)/$($item.Id)"
        try {
            if ($isRollback) { Disable-Patch $Kit $item } else { Enable-Patch $Kit $item }
        } catch {
            Write-Host "  操作失败：$($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

# ---------------------------------------------------------------- 入口
Write-Host "CSTPN 补丁管理器" -ForegroundColor Cyan

$Target = Resolve-Target
if (-not (Test-Kit $Target)) {
    Write-Host "所选目录不像 cst-pilot：$Target" -ForegroundColor Red
    Write-Host "（应包含 agent/home/extensions/oauth/oa.ts）" -ForegroundColor Red
    exit 1
}
$Target = (Resolve-Path -LiteralPath $Target).Path

Write-Host "目标   $Target"
if (-not (Test-Path $script:CacheDir)) { New-Item -ItemType Directory -Path $script:CacheDir -Force | Out-Null }
Write-Host "缓存   $script:CacheDir"

Write-Host -NoNewline "同步清单… "
Sync-Catalog
Write-Host $script:SyncInfo -ForegroundColor Gray

if ($NonInteractive) { Show-Status $Target } else { Show-Menu $Target }
