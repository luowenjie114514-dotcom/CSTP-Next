<#
    CSTPN 补丁管理器 · 启动动画

    配色算法照搬 ascii-banner.oaix.tech：
      - Sunset 渐变 [#FB7185, #F59E0B]
      - 按「字符所在列」插值（横向渐变），非按行
      - 使用 ANSI 24 位真彩色 ESC[38;2;r;g;bm

    序列：
      1. 本体 CST-PILOT 滚入
      2. Sunset 遮罩自下而上掩蔽
      3. 推入 Next
#>

# PS 5.1 不支持 `e 转义（会退化成字母 e），必须用 [char]27
$script:ESC = [char]27
$script:Reset = "$($script:ESC)[0m"

# Windows 控制台默认不解析 ANSI，需要启用 VT 处理（ENABLE_VIRTUAL_TERMINAL_PROCESSING）
$script:TrueColorReady = $null

function Enable-VirtualTerminal {
    if ($null -ne $script:TrueColorReady) { return $script:TrueColorReady }

    # 1) PowerShell 官方能力标志：最可靠，Windows Terminal / 新版 conhost 均为 true
    try {
        if ($Host.UI.SupportsVirtualTerminal) {
            # 仍要尝试开启 VT 模式（老 conhost 可能默认关闭）
            $null = Enable-ConsoleVtMode
            $script:TrueColorReady = $true
            return $true
        }
    } catch { }

    # 2) 官方标志不可用时，退回 Win32 API 探测
    try {
        if (Enable-ConsoleVtMode) {
            $script:TrueColorReady = $true
            return $true
        }
    } catch { }

    $script:TrueColorReady = $false
    return $false
}

# 通过 SetConsoleMode 打开 ENABLE_VIRTUAL_TERMINAL_PROCESSING
# 返回 true 表示当前确实具备 VT（已开启或本来就开着）
function Enable-ConsoleVtMode {
    try {
        if (-not ('CstpnConsole' -as [type])) {
            Add-Type -Namespace '' -Name 'CstpnConsole' -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
public static extern System.IntPtr GetStdHandle(int nStdHandle);
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
public static extern bool GetConsoleMode(System.IntPtr hConsoleHandle, out uint lpMode);
[System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
public static extern bool SetConsoleMode(System.IntPtr hConsoleHandle, uint dwMode);
'@ -ErrorAction Stop
        }

        $handle = [CstpnConsole]::GetStdHandle(-11)
        if ($handle -eq [IntPtr]::Zero -or $handle -eq [IntPtr](-1)) { return $false }

        $mode = [uint32]0
        if (-not [CstpnConsole]::GetConsoleMode($handle, [ref]$mode)) { return $false }

        $ENABLE_VT = 0x0004
        if (($mode -band $ENABLE_VT) -ne 0) { return $true }   # 已开启

        return [CstpnConsole]::SetConsoleMode($handle, $mode -bor $ENABLE_VT)
    } catch {
        return $false
    }
}

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

# ---------------------------------------------------------------- Sunset 渐变
# 照搬源站：sunset: ['#FB7185', '#F59E0B']，按列线性插值
$script:SunsetStops = @(
    @{ r = 0xFB; g = 0x71; b = 0x85 }   # #FB7185 rose
    @{ r = 0xF5; g = 0x9E; b = 0x0B }   # #F59E0B amber
)

$script:UseTrueColor = $true
$script:MaskColorSeq = "$($script:ESC)[38;2;120;40;160m"   # 遮罩用深紫

# 在渐变上取色：$t = 0..1
function Get-GradientRgb([double]$t) {
    if ($t -lt 0) { $t = 0 }
    if ($t -gt 1) { $t = 1 }

    $r0 = 0xFB; $g0 = 0x71; $b0 = 0x85   # #FB7185
    $r1 = 0xF5; $g1 = 0x9E; $b1 = 0x0B   # #F59E0B

    $rr = [int][Math]::Round($r0 + ($r1 - $r0) * $t)
    $gg = [int][Math]::Round($g0 + ($g1 - $g0) * $t)
    $bb = [int][Math]::Round($b0 + ($b1 - $b0) * $t)

    return [pscustomobject]@{ r = $rr; g = $gg; b = $bb }
}

function Format-TrueColor($rgb) {
    return "$($script:ESC)[38;2;$($rgb.r);$($rgb.g);$($rgb.b)m"
}


# 给一行按列上色（照搬源站 Ae 函数逻辑）
# 16 色降级表：Sunset #FB7185 -> #F59E0B 的近似
# 每档对应 [r,g,b] 和最近的 ConsoleColor
$script:Sunset16 = @(
    @{ rgb = @(251,113,133); cc = [ConsoleColor]::Magenta    }   # #FB7185 rose
    @{ rgb = @(250,124,102); cc = [ConsoleColor]::Magenta    }
    @{ rgb = @(249,131,84);  cc = [ConsoleColor]::Red        }
    @{ rgb = @(248,140,66);  cc = [ConsoleColor]::Red        }
    @{ rgb = @(247,147,47);  cc = [ConsoleColor]::DarkYellow }
    @{ rgb = @(246,154,27);  cc = [ConsoleColor]::Yellow     }
    @{ rgb = @(245,158,11);  cc = [ConsoleColor]::Yellow     }   # #F59E0B amber
)

function Get-Nearest16([int]$r, [int]$g, [int]$b) {
    $best = $script:Sunset16[0]
    $bestDist = [double]::MaxValue
    foreach ($entry in $script:Sunset16) {
        $dr = $r - $entry.rgb[0]
        $dg = $g - $entry.rgb[1]
        $db = $b - $entry.rgb[2]
        $dist = $dr * $dr + $dg * $dg + $db * $db
        if ($dist -lt $bestDist) { $bestDist = $dist; $best = $entry }
    }
    return $best.cc
}

# 把一行按 16 色分段输出（连续同色合并，减少 Write-Host 调用）
function Write-ColoredLine16([string]$Line) {
    if (-not $Line) { Write-Host ''; return }
    $w = Get-UniformWidth
    $len = $Line.Length
    $sb = New-Object System.Text.StringBuilder
    $curColor = $null


    for ($i = 0; $i -lt $len; $i++) {
        $ch = $Line[$i]
        if ($ch -eq ' ') {
            [void]$sb.Append($ch)
            continue
        }
        $t = if ($w -le 1) { 0 } else { $i / ($w - 1) }
        $rgb = Get-GradientRgb $t
        $cc = Get-Nearest16 $rgb.r $rgb.g $rgb.b
        if ($cc -ne $curColor) {
            if ($null -ne $curColor) {
                Write-Host $sb.ToString() -ForegroundColor $curColor -NoNewline
                [void]$sb.Clear()
            }
            $curColor = $cc
        }
        [void]$sb.Append($ch)
    }
    if ($sb.Length -gt 0 -and $null -ne $curColor) {
        Write-Host $sb.ToString() -ForegroundColor $curColor -NoNewline
    }
    Write-Host ''
}

function Get-UniformWidth {
    if ($script:CachedWidth) { return $script:CachedWidth }
    $w = 1
    foreach ($l in $script:ArtCstpilot) { if ($l.Length -gt $w) { $w = $l.Length } }
    foreach ($l in $script:ArtNext) { if ($l.Length -gt $w) { $w = $l.Length } }
    $script:CachedWidth = $w
    return $w
}

function Format-ColorLine([string]$Line, [int]$Width = 0) {
    if (-not $Line) { return '' }
    if (-not $script:UseTrueColor) { return $Line }

    # 统一按最长行宽度插值（照搬源站 a = Math.max(...) 的做法）
    if ($Width -le 0) { $Width = Get-UniformWidth }

    $chars = $Line.ToCharArray()
    $n = $chars.Count
    $sb = New-Object System.Text.StringBuilder
    $lastSeq = ''
    for ($i = 0; $i -lt $n; $i++) {
        $ch = $chars[$i]
        if ($ch -eq ' ') { [void]$sb.Append($ch); continue }
        $t = if ($Width -le 1) { 0 } else { $i / ($Width - 1) }
        $seq = Format-TrueColor (Get-GradientRgb $t)
        if ($seq -ne $lastSeq) { [void]$sb.Append($seq); $lastSeq = $seq }
        [void]$sb.Append($ch)
    }
    if ($lastSeq) { [void]$sb.Append($script:Reset) }
    return $sb.ToString()
}

function Get-ArtWidth {
    $w = 1
    foreach ($line in $script:ArtCstpilot) { if ($line.Length -gt $w) { $w = $line.Length } }
    foreach ($line in $script:ArtNext) { if ($line.Length -gt $w) { $w = $line.Length } }
    return $w
}

# 输出一行；含 ESC 时走 [Console]::Write（Write-Host 在 PS 5.1 可能破坏转义）
function Write-RawLine([string]$Text) {
    if ($null -eq $Text) { $Text = '' }
    [Console]::Write($Text + [Environment]::NewLine)
}

function Write-Frame {
    param([string[]]$Lines, [string[]]$Overrides = @())
    Clear-Host
    $trueColor = Enable-VirtualTerminal
    for ($i = 0; $i -lt $Lines.Count; $i++) {
        $line = $Lines[$i]
        if (-not $line) {
            if ($trueColor) { Write-RawLine '' } else { Write-Host '' }
            continue
        }
        # 遮罩行用固定色
        if ($i -lt $Overrides.Count -and $Overrides[$i]) {
            if ($trueColor) {
                Write-RawLine ($Overrides[$i] + $line + $script:Reset)
            } else {
                Write-Host $line -ForegroundColor DarkMagenta
            }
        } elseif ($trueColor) {
            Write-RawLine (Format-ColorLine $line)
        } else {
            # 真彩色不可用 -> 16 色降级，保证有颜色
            Write-ColoredLine16 $line
        }
    }
}

<#
.SYNOPSIS
    播放启动动画。
.PARAMETER Speed
    帧间隔倍率，1 = 默认。
.PARAMETER Skip
    跳过动画直接显示 Next。
.PARAMETER NoClear
    不清屏。
.PARAMETER NoColor
    关闭真彩色（老终端兼容）。
#>
function Show-CstpnBootLogo {
    param(
        [double]$Speed = 1.0,
        [switch]$Skip,
        [switch]$NoClear,
        [switch]$NoColor
    )

    if ($NoColor) { $script:UseTrueColor = $false }
    $null = Enable-VirtualTerminal

    $cstpilot = $script:ArtCstpilot
    $next = $script:ArtNext
    $h = $cstpilot.Count
    $width = Get-ArtWidth

    if ($Skip) {
        if (-not $NoClear) { Clear-Host }
        $tc = Enable-VirtualTerminal
        foreach ($line in $next) {
            if ($tc) { Write-RawLine (Format-ColorLine $line) }
            else { Write-ColoredLine16 $line }
        }
        Write-Host ''
        return
    }

    # ---- 第 1 幕：本体滚入 ----
    for ($i = 1; $i -le $h; $i++) {
        $frame = @()
        for ($r = 0; $r -lt $h; $r++) {
            $frame += $(if ($r -lt $i) { $cstpilot[$r] } else { '' })
        }
        Write-Frame -Lines $frame
        Start-Sleep -Milliseconds ([int](140 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](500 * $Speed))

    # ---- 第 2 幕：遮罩自下而上 ----
    for ($level = 1; $level -le $h; $level++) {
        $frame = @()
        $maskFlags = @()
        for ($r = 0; $r -lt $h; $r++) {
            $fromBottom = $h - $r
            if ($fromBottom -le $level) {
                $frame += ('▓' * $cstpilot[$r].Length)
                $maskFlags += $script:MaskColorSeq
            } else {
                $frame += $cstpilot[$r]
                $maskFlags += ''
            }
        }
        Write-Frame -Lines $frame -Overrides $maskFlags
        Start-Sleep -Milliseconds ([int](120 * $Speed))
    }
    Start-Sleep -Milliseconds ([int](220 * $Speed))

    # ---- 第 3 幕：Next 自下而上推入 ----
    $nextH = $next.Count
    for ($level = 1; $level -le $nextH; $level++) {
        $frame = @()
        $maskFlags = @()
        $maskCount = $h - $level
        if ($maskCount -lt 0) { $maskCount = 0 }
        for ($p = 0; $p -lt $maskCount; $p++) {
            $frame += ('▓' * $width)
            $maskFlags += $script:MaskColorSeq
        }
        for ($k = $nextH - $level; $k -lt $nextH; $k++) {
            if ($k -lt 0) { continue }
            $frame += $next[$k]
            $maskFlags += ''
        }
        Write-Frame -Lines $frame -Overrides $maskFlags
        Start-Sleep -Milliseconds ([int](90 * $Speed))
    }

    # ---- 收尾：复用 Write-Frame（与中间帧同一路径，外观一致）----
    Write-Frame -Lines $next
    # 停留片刻，让终态稳定可见（后续输出不会立刻把画面推走）
    Start-Sleep -Milliseconds ([int](400 * $Speed))
    Write-Host ''
}

