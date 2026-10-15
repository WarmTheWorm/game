# A handful of recorded one-shots, for the sound defs that name a file instead
# of a waveform. They are richer than an oscillator can be in one voice: each
# is several partials with their own envelopes, mixed down.
#
#   pwsh -NoProfile -File assets\clips\_generate.ps1
$ErrorActionPreference = 'Stop'

$RATE = 22050

# A partial is one sine at `hz`, optionally bending to `toHz`, fading out over
# its own length. `at` lets a clip be built from several struck in sequence.
function New-Partial([double]$at, [double]$dur, [double]$hz, [double]$toHz, [double]$gain, [double]$decay) {
  [pscustomobject]@{ At = $at; Dur = $dur; Hz = $hz; ToHz = $toHz; Gain = $gain; Decay = $decay }
}

function Write-Clip([string]$name, [double]$seconds, $partials) {
  $count = [int]($seconds * $RATE)
  $buf = New-Object 'double[]' $count
  $twoPi = 2 * [Math]::PI

  foreach ($part in $partials) {
    $from = [int]($part.At * $RATE)
    $len = [int]($part.Dur * $RATE)
    if ($len -lt 2) { continue }
    $rise = [Math]::Max(1, [int](0.004 * $RATE))
    $fall = [Math]::Max(1, [int]($len * 0.15))
    $phase = 0.0
    for ($i = 0; $i -lt $len; $i++) {
      $at = $from + $i
      if ($at -ge $count) { break }
      $frac = $i / $len
      $hz = $part.Hz + ($part.ToHz - $part.Hz) * $frac
      $phase += $twoPi * $hz / $RATE          # integrated, so a bend has no phase jump
      $amp = [Math]::Exp(-$part.Decay * $frac)
      if ($i -lt $rise) { $amp *= $i / $rise }
      $left = $len - $i
      if ($left -lt $fall) { $amp *= $left / $fall }
      $buf[$at] += [Math]::Sin($phase) * $amp * $part.Gain
    }
  }

  $peak = 0.0
  foreach ($v in $buf) { $abs = [Math]::Abs($v); if ($abs -gt $peak) { $peak = $abs } }
  $scale = if ($peak -gt 0) { 29000 / $peak } else { 1 }

  $bytes = New-Object 'byte[]' ($count * 2)
  for ($i = 0; $i -lt $count; $i++) {
    $s = [int][Math]::Round($buf[$i] * $scale)
    if ($s -gt 32767) { $s = 32767 } elseif ($s -lt -32768) { $s = -32768 }
    $bytes[$i * 2] = $s -band 0xFF
    $bytes[$i * 2 + 1] = ($s -shr 8) -band 0xFF
  }

  $path = Join-Path $PSScriptRoot $name
  $fs = [IO.File]::Create($path)
  $bw = New-Object IO.BinaryWriter($fs)
  $bw.Write([Text.Encoding]::ASCII.GetBytes('RIFF')); $bw.Write([int](36 + $bytes.Length))
  $bw.Write([Text.Encoding]::ASCII.GetBytes('WAVE'))
  $bw.Write([Text.Encoding]::ASCII.GetBytes('fmt ')); $bw.Write([int]16)
  $bw.Write([int16]1); $bw.Write([int16]1); $bw.Write([int]$RATE)
  $bw.Write([int]($RATE * 2)); $bw.Write([int16]2); $bw.Write([int16]16)
  $bw.Write([Text.Encoding]::ASCII.GetBytes('data')); $bw.Write([int]$bytes.Length)
  $bw.Write($bytes)
  $bw.Close(); $fs.Close()
  "{0,-12} {1,5:N2}s  {2,7:N0} bytes" -f $name, $seconds, (Get-Item $path).Length
}

$made = @()

# --- coin: a struck bell, two octaves and a fifth ringing together
$made += Write-Clip 'coin.wav' 0.5 @(
  (New-Partial 0.00 0.45 1046 1046 1.00 4.0),
  (New-Partial 0.00 0.40 1568 1568 0.55 5.0),
  (New-Partial 0.00 0.30 2093 2093 0.35 7.0),
  (New-Partial 0.00 0.12 3136 3136 0.25 11.0)
)

# --- gem: the same bell arpeggiated, so it reads as something rarer
$made += Write-Clip 'gem.wav' 0.9 @(
  (New-Partial 0.00 0.80 1046 1046 0.80 3.4),
  (New-Partial 0.08 0.72 1318 1318 0.70 3.4),
  (New-Partial 0.16 0.64 1568 1568 0.70 3.4),
  (New-Partial 0.24 0.56 2093 2093 0.45 4.0),
  (New-Partial 0.00 0.90 523  523  0.30 3.0)
)

# --- unlock: a low mechanism turning over, bending down as it gives
$made += Write-Clip 'unlock.wav' 0.6 @(
  (New-Partial 0.00 0.18 420 300 0.70 5.0),
  (New-Partial 0.10 0.45 180 120 1.00 3.2),
  (New-Partial 0.10 0.45 270 180 0.40 3.6),
  (New-Partial 0.30 0.28 540 440 0.35 4.5)
)

$made
