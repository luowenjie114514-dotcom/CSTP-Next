<#
    CSTPN 补丁管理器 · 启动动画

    序列：
      1. 本体 CST-PILOT（方块 ANSI Shadow）滚入
      2. 日出色遮罩自下而上掩蔽
      3. 推入 Next（Sunset 风格艺术字）

    每帧清屏重绘，不依赖光标定位。
#>

# ---------------------------------------------------------------- 字形
# 本体：ANSI Shadow 方块风格
$script:ArtCstpilot = @(
    ' ██████╗███████╗████████╗      ██████╗ ██╗██╗      ██████╗ ████████╗'
    '██╔════╝██╔════╝╚══██╔══╝      ██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝'
    '██║     ███████╗   ██║   █████╗██████╔╝██║██║     ██║   ██║   ██║   '
    '██║     ╚════██║   ██║   ╚════╝██╔═══╝ ██║██║     ██║   ██║   ██║   '
    '╚██████╗███████║   ██║         ██║     ██║███████╗╚██████╔╝   ██║   '
    ' ╚═════╝╚══════╝   ╚═╝         ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   '
)

# Next：Sunset 风格（主人提供的字形，12 行）
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

# ---------------------------------------------------------------- 日出配色
# 自下而上：深紫 -> 品红 -> 橙红 -> 金黄 -> 浅金
$script:SunrisePalette = @(
    [ConsoleColor]::DarkMagenta   # 深紫（最底）
    [ConsoleColor]::Magenta       # 品红
    [ConsoleColor]::DarkRed       # 暗红
    [ConsoleColor]::Red           # 橙红
    [ConsoleColor]::DarkYellow    # 橙黄
    [ConsoleColor]::Yellow        # 金黄
)
$script:MaskColor = [ConsoleColor]::DarkMagenta
$script:MaskChar = '▓'

function Get-ArtWidth {
    $w = 1
    foreach ($line in $script:ArtCstpilot) { if ($line.Length -gt $w) { $w = $line.Length } }
    foreach ($line in $script:ArtNext) { if ($line.Length -gt $w) { $w = $line.Length } }
    return $w
}

# 按行位置取日出色（越靠下越深）
function Get-SunriseColor([int]$row, [int]$total) {
    if ($total -le 1) { return $script:SunrisePalette[0] }
    $ratio = $row / ($total - 1)          # 0 = 顶(浅), 1 = 底(深)
    $idx = [int]([Math]::Round((1 - $ratio) * ($script:SunrisePalette.Count - 1)))
    $idx = [Math]::Max(0, [Math]::Min($script:SunrisePalette.Count - 1, $idx))
    return $script:SunrisePalette[$idx]
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
    帧间隔倍率，1 = 默认，2 = 慢一倍，0.5 = 快一倍。
.PARAMETER Skip
    跳过动画，直接显示 Next。
.PARAMETER NoClear
    不清屏（保留上方已有输出）。
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
            Write-Host $next[$i] -ForegroundColor (Get-SunriseColor $i $next.Count)
        }
        Write-Host ''
        return
    }

    # ---------------- 第 1 幕：本体滚入（逐行显现，放慢）----------------
    # 每行停留更久，确保肉眼可见
    for ($i = 1; $i -le $h; $i++) {
        $frame = @()
        $colors = @()
        for ($r = 0; $r -lt $h; $r++) {
            if ($r -lt $i) {
                $frame += $cstpilot[$r]
                $colors += (Get-SunriseColor $r $h)
            } else {
                $frame += ''
            }
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](140 * $Speed))
    }
    # 完整本体停留
    Start-Sleep -Milliseconds ([int](500 * $Speed))

    # ---------------- 第 2 幕：日出色遮罩自下而上 ----------------
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
                $colors += (Get-SunriseColor $r $h)
            }
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](120 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](220 * $Speed))

    # ---------------- 第 3 幕：Next 自下而上推入 ----------------
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
            $colors += (Get-SunriseColor $k $nextH)
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](90 * $Speed))
    }

    # 收尾：完整 Next，日出配色
    Start-Sleep -Milliseconds ([int](300 * $Speed))
    for ($i = 0; $i -lt $nextH; $i++) {
        Write-Host $next[$i] -ForegroundColor (Get-SunriseColor $i $nextH)
    }
    Write-Host ''
}
