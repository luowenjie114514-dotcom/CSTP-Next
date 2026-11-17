<#
 * CSTPN 补丁管理器 · 启动动画
 *
 * 序列：
 *   1. 本体 CST-PILOT（方块 ANSI Shadow）滚入
 *   2. 蓝色遮罩自下而上掩蔽原 logo
 *   3. 推入 CSTPN Next 的 Fraktur 艺术字
 *
 * 实现方式：每帧清屏重绘完整画面，避免逐行光标定位的兼容问题。
 #>

# ---------------------------------------------------------------- 字形数据
$script:ArtCstpilot = @(
    ' ██████╗███████╗████████╗      ██████╗ ██╗██╗      ██████╗ ████████╗'
    '██╔════╝██╔════╝╚══██╔══╝      ██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝'
    '██║     ███████╗   ██║   █████╗██████╔╝██║██║     ██║   ██║   ██║   '
    '██║     ╚════██║   ██║   ╚════╝██╔═══╝ ██║██║     ██║   ██║   ██║   '
    '╚██████╗███████║   ██║         ██║     ██║███████╗╚██████╔╝   ██║   '
    ' ╚═════╝╚══════╝   ╚═╝         ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   '
)

$script:ArtNext = @(
    '      ...                  ....                ....                ..      .     '
    '   xH88"`~ .x8X        .x~X88888Hx.        .xH888888Hx.         x88f` `..x88. .> '
    ' :8888   .f"8888Hf    H8X 888888888h.    .H8888888888888:     :8888   xf`*8888%  '
    ':8888>  X8L  ^""`    8888:`*888888888:   888*"""?""*88888X   :8888f .888  `"`    '
    'X8888  X888h         88888:        `%8  ''f     d8x.   ^%88k  88888'' X8888. >"8x  '
    '88888  !88888.     . `88888          ?> ''>    <88888X   ''?8  88888  ?88888< 888> '
    '88888   %88888     `. ?888%           X  `:..:`888888>    8> 88888   "88888 "8%   '
    '88888 ''> `8888>      ~*??.            >         `"*88     X  88888 ''  `8888>      '
    '`8888L %  ?888   !  .x88888h.        <     .xHHhx.."      !  `8888> %  X88!       '
    ' `8888  `-*""   /  :"""8888888x..  .x     X88888888hx. ..!    `888X  `~""`   :    '
    '   "888.      :"   `    `*888888888"     !   "*888888888"       "88k.      .~     '
    '     `""***~"`             ""***""              ^"***"`           `"*==~~`       '
)

$script:ColorBlue = [ConsoleColor]::DarkBlue
$script:ColorCyan = [ConsoleColor]::Cyan
$script:ColorWhite = [ConsoleColor]::White
$script:ColorMagenta = [ConsoleColor]::Magenta
$script:ColorRed = [ConsoleColor]::DarkRed

function Get-ArtWidth {
    $w = 1
    foreach ($line in $script:ArtCstpilot) { if ($line.Length -gt $w) { $w = $line.Length } }
    foreach ($line in $script:ArtNext) { if ($line.Length -gt $w) { $w = $line.Length } }
    return $w
}

function Write-Frame {
    param([string[]]$Lines, [ConsoleColor[]]$Colors)
    Clear-Host
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        $c = $script:ColorWhite
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
    跳过动画，直接显示 Next logo。
#>
function Show-CstpnBootLogo {
    param(
        [double]$Speed = 1.0,
        [switch]$Skip
    )

    $cstpilot = $script:ArtCstpilot
    $next = $script:ArtNext
    $h = $cstpilot.Count
    $width = Get-ArtWidth

    if ($Skip) {
        Clear-Host
        for ($i = 0; $i -lt $next.Count; $i++) {
            $c = $script:ColorMagenta
            if (($i % 2) -ne 0) { $c = $script:ColorRed }
            Write-Host $next[$i] -ForegroundColor $c
        }
        Write-Host ''
        return
    }

    # ---------------- 第 1 幕：本体滚入（逐行显现）----------------
    for ($i = 0; $i -le $h; $i++) {
        $frame = @()
        $colors = @()
        for ($r = 0; $r -lt $h; $r++) {
            if ($r -lt $i) {
                $frame += $cstpilot[$r]
                $colors += $(if ($r -ge 3) { $script:ColorBlue } else { $script:ColorCyan })
            } else {
                $frame += ''
            }
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](55 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](240 * $Speed))

    # ---------------- 第 2 幕：蓝色遮罩自下而上 ----------------
    for ($level = 1; $level -le $h; $level++) {
        $frame = @()
        $colors = @()
        for ($r = 0; $r -lt $h; $r++) {
            $fromBottom = $h - $r
            if ($fromBottom -le $level) {
                # 已被遮罩覆盖
                $frame += ('█' * $cstpilot[$r].Length)
                $colors += $script:ColorBlue
            } else {
                $frame += $cstpilot[$r]
                $colors += $(if ($r -ge 3) { $script:ColorBlue } else { $script:ColorCyan })
            }
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](80 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](140 * $Speed))

    # ---------------- 第 3 幕：推入 Next（自下而上）----------------
    $nextH = $next.Count
    for ($level = 1; $level -le $nextH; $level++) {
        $frame = @()
        $colors = @()
        # 顶部剩余遮罩
        $maskCount = $h - $level
        if ($maskCount -lt 0) { $maskCount = 0 }
        for ($p = 0; $p -lt $maskCount; $p++) {
            $frame += ('█' * $width)
            $colors += $script:ColorBlue
        }
        # 已推入的 Next 行（自底部向上）
        for ($k = $nextH - $level; $k -lt $nextH; $k++) {
            if ($k -lt 0) { continue }
            $frame += $next[$k]
            $colors += $(if (($k % 2) -eq 0) { $script:ColorMagenta } else { $script:ColorRed })
        }
        Write-Frame -Lines $frame -Colors $colors
        Start-Sleep -Milliseconds ([int](60 * $Speed))
    }

    # 收尾：完整 Next + 紫/酒红交替
    for ($i = 0; $i -lt $nextH; $i++) {
        $c = $script:ColorMagenta
        if (($i % 2) -ne 0) { $c = $script:ColorRed }
        Write-Host $next[$i] -ForegroundColor $c
    }
    Write-Host ''
}
