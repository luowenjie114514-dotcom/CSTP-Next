<#
    CSTPN 补丁管理器 · 启动标识

    显示斜线风格（ANSI Regular）的 Nex 艺术字，紫/酒红交替，闪烁三次。
    无滚入/扫浪动画。
#>

# 斜线字形（与本体方块字形区分）
$script:NexArt = @(
    '   _   __                   __ '
    '  / | / /  ___     _  __   / /_'
    ' /  |/ /  / _ \   | |/_/  / __/'
    '/ /|  /  /  __/  _>  <   / /  '
    '/_/ |_/   \___/  /_/|_|   \__/ '
)

$script:NexColorA = [ConsoleColor]::Magenta   # 紫
$script:NexColorB = [ConsoleColor]::DarkRed   # 酒红

<#
.SYNOPSIS
    显示启动标识。
.PARAMETER Blinks
    闪烁次数，0 表示不闪。
.PARAMETER DelayMs
    闪烁间隔毫秒。
#>
function Show-CstpnBootLogo {
    param(
        [int]$Blinks = 3,
        [int]$DelayMs = 160
    )

    $art = $script:NexArt
    $n = $art.Count

    # 首次显示
    for ($i = 0; $i -lt $n; $i++) {
        $c = $script:NexColorA
        if (($i % 2) -ne 0) { $c = $script:NexColorB }
        Write-Host $art[$i] -ForegroundColor $c
    }

    if ($Blinks -le 0) { Write-Host ''; return }

    # 判断能否定位光标（重定向/管道输出时不能）
    $canCursor = $true
    try { $null = [Console]::CursorTop } catch { $canCursor = $false }

    for ($k = 0; $k -lt $Blinks; $k++) {
        Start-Sleep -Milliseconds $DelayMs

        if ($canCursor) {
            try {
                [Console]::SetCursorPosition(0, [Math]::Max(0, [Console]::CursorTop - $n))
            } catch { $canCursor = $false }
        }

        # 熄灭：重绘空白盖住
        for ($i = 0; $i -lt $n; $i++) {
            Write-Host (' ' * $art[$i].Length)
        }
        Start-Sleep -Milliseconds ([int]($DelayMs * 0.6))

        if ($canCursor) {
            try {
                [Console]::SetCursorPosition(0, [Math]::Max(0, [Console]::CursorTop - $n))
            } catch { $canCursor = $false }
        }

        # 亮起（配色相位交替）
        for ($i = 0; $i -lt $n; $i++) {
            $c = $script:NexColorA
            if ((($i + $k + 1) % 2) -ne 0) { $c = $script:NexColorB }
            Write-Host $art[$i] -ForegroundColor $c
        }
    }

    Write-Host ''
}
