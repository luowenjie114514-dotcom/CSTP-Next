<#
    CSTPN 补丁管理器 · 启动动画

    配色取自 ascii-banner.oaix.tech 的 Sunset 主题：
      渐变 #FB7185 (rose) -> #F59E0B (amber)
    自下而上按行插值，模拟日出。

    序列：
      1. 本体 CST-PILOT 滚入
      2. Sunset 色遮罩自下而上掩蔽
      3. 推入 Next（Sunset 字形）
#>

# ---------------------------------------------------------------- 字形
$script:ArtCstpilot = @(
    ' ██████╗███████╗████████╗      ██████╗ ██╗██╗      ██████╗ ████████╗'
    '██╔════╝██╔════╝╚══██╔══╝      ██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝'
    '██║     ███████╗   ██║   █████╗██████╔╝██║██║     ██║   ██║   ██║   '
    '██║     ╚════██║   ██║   ╚════╝██╔═══╝ ██║██║     ██║   ██║   ██║   '
    '╚██████╗███████║   ██║         ██║     ██║███████╗╚██████╔╝   ██║   '
    ' ╚═════╝╚══════╝   ╚═╝         ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   '
)

$script:ArtNext = @(
    '     ...     ...                                           s    '
    '  .=*8888n.."%888:                                        :8    '
    ' X    ?8888f ''8888                       uL   ..         .88    '
    ' 88x. ''8888X  8888>          .u        .@88b  @88R      :888ooo '
    '''8888k 8888X  ''"*8h.      ud8888.     ''"Y888k/"*P     -*8888888 '
    ' "8888 X888X .xH8       :888''8888.       Y888L          8888    '
    '   `8" X888!:888X       d888 ''88%"        8888          8888    '
    '  =~`  X888 X888X       8888.+"           `888N         8888    '
    '   :h. X8*` !888X       8888L          .u./"888&       .8888Lu= '
    '  X888xX"   ''8888..:    ''8888c. .+    d888" Y888*"     ^%888*    '
    ':~`888f     ''*888*"      "88888%      ` "Y   Y"          ''Y"     '
    '    ""        `"`          "YP''                                '
)

# ---------------------------------------------------------------- Sunset 配色
# 源站和渐变：#FB7185 (rose) -> #F59E0B (amber)
$script:SunsetFrom = @(0xFB, 0x71, 0x85)   # #FB7185
$script:SunsetTo   = @(0xF5, 0x9E, 0x0B)   # #F59E0B

# 预生成 12 档 RGB（自下而上：底部 rose，顶部 amber）
$script:SunsetRamp = @()
for ($i = 0; $i -lt 12; $i++) {
    $t = $i / 11.0
    $r = [int]($script:SunsetFrom[0] + ($script:SunsetTo[0] - $script:SunsetFrom[0]) * $t)
    $g = [int]($script:SunsetFrom[1] + ($script:SunsetTo[1] - $script:SunsetFrom[1]) * $t)
    $b = [int]($script:SunsetFrom[2] + ($script:SunsetTo[2] - $script:SunsetFrom[2]) * $t)
    $script:SunsetRamp += , @($r, $g, $b)
}

# ConsoleColor 只能 16 色，预映射到最接近的可用色
$script:ConsoleRamp = @(
    [ConsoleColor]::Magenta       # #FB7185 玫瑰红 -> 品红
    [ConsoleColor]::Magenta
    [ConsoleColor]::Red
    [ConsoleColor]::Red
    [ConsoleColor]::DarkYellow
    [ConsoleColor]::DarkYellow
    [ConsoleColor]::Yellow
    [ConsoleColor]::Yellow
    [ConsoleColor]::Yellow
    [ConsoleColor]::Yellow
    [ConsoleColor]::Yellow
    [ConsoleColor]::Yellow
)

$script:MaskColor = [ConsoleColor]::DarkMagenta
$script:MaskChar = '▓'

function Get-ArtWidth {
    $w = 1
    foreach ($line in $script:ArtCstpilot) { if ($line.Length -gt $w) { $w = $line.Length } }
    foreach ($line in $script:ArtNext) { if ($line.Length -gt $w) { $w = $line.Length } }
    return $w
}

# 按行取 Sunset 色：$row=0 是顶部（amber），越往下越接近 rose
function Get-SunsetColor([int]$row, [int]$total) {
    if ($total -le 1) { return $script:ConsoleRamp[0] }
    $ratio = $row / ($total - 1)
    $idx = [int]([Math]::Round($ratio * ($script:ConsoleRamp.Count - 1)))
    $idx = [Math]::Max(0, [Math]::Min($script:ConsoleRamp.Count - 1, $idx))
    return $script:ConsoleRamp[$idx]
}

function Write-Frame {
    param([string[]]$Lines, [ConsoleColor[]]$Colors)
    Clear-Host
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        if (-not $Lines[$i]) { Write-Host ''; continue }
        $c = [ConsoleColor]::White
        if ($i -lt $Colors.Count) { $c = $Colors[$i] }
        Write-Host $Lines[$i] -ForegroundColor $c
    }
}

<#
.SYNOPSIS
    播放完整启动动画。
.PARAMETER Speed
    帧间隔倍率，1 = 默认，2 = 慢一倍。
.PARAMETER Skip
    跳过动画直接显示 Next。
.PARAMETER NoClear
    不清屏。
#>
function Show-CstpnBootLogo {
    param(
        [double]$Speed = 1.0,
        [switch]$Skip,
        [switch]$NoClear
    )

    $cstpilot = $script:ArtCstpilot
    $next = $script:ArtNext
    $h = $cstpilot.Count
    $width = Get-ArtWidth

    if ($Skip) {
        if (-not $NoClear) { Clear-Host }
        for ($i = 0; $i -lt $next.Count; $i++) {
            Write-Host $next[$i] -ForegroundColor (Get-SunsetColor $i $next.Count)
        }
        Write-Host ''
        return
    }

    # ---- 第 1 幕：本体滚入 ----
    for ($i = 1; $i -le $h; $i++) {
        $frame = @()
        $colors = @()
        for ($r = 0; $r -lt $h; $r++) {
            if ($r -lt $i) {
                $frame += $cstpilot[$r]
                $colors += (Get-SunsetColor $r $h)
            } else {
                $frame += ''
            }
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](140 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](500 * $Speed))

    # ---- 第 2 幕：Sunset 遮罩自下而上 ----
    for ($level = 1; $level -le $h; $level++) {
        $frame = @()
        $colors = @()
        for ($r = 0; $r -lt $h; $r++) {
            $fromBottom = $h - $r
            if ($fromBottom -le $level) {
                $frame += ($script:MaskChar * $cstpilot[$r].Length)
                $colors += $script:MaskColor
            } else {
                $frame += $cstpilot[$r]
                $colors += (Get-SunsetColor $r $h)
            }
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](120 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](220 * $Speed))

    # ---- 第 3 幕：Next 自下而上推入 ----
    $nextH = $next.Count
    for ($level = 1; $level -le $nextH; $level++) {
        $frame = @()
        $colors = @()
        $maskCount = $h - $level
        if ($maskCount -lt 0) { $maskCount = 0 }
        for ($p = 0; $p -lt $maskCount; $p++) {
            $frame += ($script:MaskChar * $width)
            $colors += $script:MaskColor
        }
        for ($k = $nextH - $level; $k -lt $nextH; $k++) {
            if ($k -lt 0) { continue }
            $frame += $next[$k]
            $colors += (Get-SunsetColor $k $nextH)
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](90 * $Speed))
    }

    # 收尾
    Start-Sleep -Milliseconds ([int](300 * $Speed))
    for ($i = 0; $i -lt $nextH; $i++) {
        Write-Host $next[$i] -ForegroundColor (Get-SunsetColor $i $nextH)
    }
    Write-Host ''
}
