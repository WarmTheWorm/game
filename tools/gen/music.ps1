# The looping tracks the level editor offers as a level's background music.
# Each one is written so the last sample lands back where the first began:
# every note's envelope closes before the buffer ends, so the loop has no click.
#
#   npm run gen:music -- -Pack garden
param([string]$Pack = 'garden')
. (Join-Path $PSScriptRoot '_pack.ps1')
$ErrorActionPreference = 'Stop'
$OUT = Get-PackDir $Pack 'sounds\music'

$RATE = 22050

function New-Note([double]$at, [double]$dur, [double]$hz, [string]$wave, [double]$gain, [double]$attack = 0.01) {
  [pscustomobject]@{ At = $at; Dur = $dur; Hz = $hz; Wave = $wave; Gain = $gain; Attack = $attack }
}

# A chord as a run of arpeggio notes, one step apart, cycling its tones.
function New-Arp([double]$at, [double]$span, [double]$step, [double[]]$tones, [string]$wave, [double]$gain) {
  $out = @()
  $i = 0
  for ($t = $at; $t -lt $at + $span - 1e-9; $t += $step) {
    $out += New-Note $t ($step * 0.95) $tones[$i % $tones.Length] $wave $gain 0.004
    $i++
  }
  $out
}

function Write-Wav([string]$name, [double]$seconds, $notes) {
  $count = [int]($seconds * $RATE)
  $buf = New-Object 'double[]' $count
  $twoPi = 2 * [Math]::PI

  foreach ($note in $notes) {
    $from = [int]($note.At * $RATE)
    $len = [int]($note.Dur * $RATE)
    if ($len -lt 2) { continue }
    $rise = [Math]::Max(1, [int]($note.Attack * $RATE))
    $fall = [Math]::Max(1, [int]($len * 0.12))      # closes the note on silence
    $kind = $note.Wave
    for ($i = 0; $i -lt $len; $i++) {
      $at = $from + $i
      if ($at -ge $count) { break }
      $phase = $twoPi * $note.Hz * $i / $RATE
      $wav = [Math]::Sin($phase)
      if ($kind -eq 'triangle') { $wav = 0.63662 * [Math]::Asin($wav) }
      elseif ($kind -eq 'square') { if ($wav -ge 0) { $wav = 0.55 } else { $wav = -0.55 } }
      if ($i -lt $rise) { $amp = $i / $rise }
      else { $amp = [Math]::Exp(-2.6 * ($i - $rise) / ($len - $rise)) }
      $left = $len - $i
      if ($left -lt $fall) { $amp *= $left / $fall }
      $buf[$at] += $wav * $amp * $note.Gain
    }
  }

  $peak = 0.0
  foreach ($v in $buf) { $abs = [Math]::Abs($v); if ($abs -gt $peak) { $peak = $abs } }
  $scale = if ($peak -gt 0) { 30000 / $peak } else { 1 }

  $bytes = New-Object 'byte[]' ($count * 2)
  for ($i = 0; $i -lt $count; $i++) {
    $s = [int][Math]::Round($buf[$i] * $scale)
    if ($s -gt 32767) { $s = 32767 } elseif ($s -lt -32768) { $s = -32768 }
    $bytes[$i * 2] = $s -band 0xFF
    $bytes[$i * 2 + 1] = ($s -shr 8) -band 0xFF
  }

  $path = Join-Path $OUT $name
  $fs = [IO.File]::Create($path)
  $bw = New-Object IO.BinaryWriter($fs)
  $ascii = { param($text) $bw.Write([Text.Encoding]::ASCII.GetBytes($text)) }
  & $ascii 'RIFF'; $bw.Write([int](36 + $bytes.Length)); & $ascii 'WAVE'
  & $ascii 'fmt '; $bw.Write([int]16); $bw.Write([int16]1); $bw.Write([int16]1)
  $bw.Write([int]$RATE); $bw.Write([int]($RATE * 2)); $bw.Write([int16]2); $bw.Write([int16]16)
  & $ascii 'data'; $bw.Write([int]$bytes.Length)
  $bw.Write($bytes)
  $bw.Close(); $fs.Close()
  "{0,-12} {1,5:N1}s  {2,9:N0} bytes" -f $name, $seconds, (Get-Item $path).Length
}

# Equal temperament from A4, so the chords below can be written as note names.
$STEPS = @{ C = -9; 'C#' = -8; D = -7; 'D#' = -6; E = -5; F = -4; 'F#' = -3; G = -2; 'G#' = -1; A = 0; 'A#' = 1; B = 2 }
function Get-Hz([string]$note) {
  $name = $note -replace '\d', ''
  $octave = [int]($note -replace '\D', '')
  440 * [Math]::Pow(2, ($STEPS[$name] + 12 * ($octave - 4)) / 12)
}
function Get-Chord([string[]]$notes) { $notes | ForEach-Object { Get-Hz $_ } }

$made = @()

# --- calm: a slow four-chord turn, for anywhere she can take her time
$notes = @()
$calm = @(
  @{ Bass = 'A2'; Tones = @('A3', 'C4', 'E4', 'C4') },
  @{ Bass = 'F2'; Tones = @('F3', 'A3', 'C4', 'A3') },
  @{ Bass = 'C3'; Tones = @('C4', 'E4', 'G4', 'E4') },
  @{ Bass = 'G2'; Tones = @('G3', 'B3', 'D4', 'B3') }
)
for ($bar = 0; $bar -lt 4; $bar++) {
  $at = $bar * 2.0
  $chord = $calm[$bar]
  $notes += New-Note $at 1.9 (Get-Hz $chord.Bass) 'sine' 0.55 0.03
  $notes += New-Note $at 1.9 ((Get-Hz $chord.Tones[1]) / 2) 'sine' 0.14 0.25
  $notes += New-Arp $at 2.0 0.25 (Get-Chord $chord.Tones) 'triangle' 0.26
}
$made += Write-Wav 'calm.wav' 8.0 $notes

# --- deep: a drone with a bell over it, for underground and other dark rooms
$notes = @()
for ($bar = 0; $bar -lt 4; $bar++) {
  $at = $bar * 2.0
  $notes += New-Note $at 1.95 (Get-Hz 'D2') 'sine' 0.5 0.35
  $notes += New-Note $at 1.95 (Get-Hz 'A2') 'sine' 0.22 0.45
}
foreach ($bell in @(@(0.2, 'D5'), @(1.9, 'F5'), @(3.6, 'A5'), @(5.3, 'F5'), @(7.0, 'D5'))) {
  $notes += New-Note ([double]$bell[0]) 0.95 (Get-Hz ([string]$bell[1])) 'triangle' 0.3 0.006
}
$made += Write-Wav 'deep.wav' 8.0 $notes

# --- chase: sixteenths over a walking bass, for anywhere that should hurry
$notes = @()
$chase = @(
  @{ Bass = 'A2'; Tones = @('A4', 'C5', 'E5', 'C5') },
  @{ Bass = 'F2'; Tones = @('F4', 'A4', 'C5', 'A4') },
  @{ Bass = 'G2'; Tones = @('G4', 'B4', 'D5', 'B4') },
  @{ Bass = 'E2'; Tones = @('E4', 'G4', 'B4', 'G4') }
)
for ($bar = 0; $bar -lt 4; $bar++) {
  $at = $bar * 2.0
  $chord = $chase[$bar]
  for ($beat = 0; $beat -lt 4; $beat++) {
    $notes += New-Note ($at + $beat * 0.5) 0.45 (Get-Hz $chord.Bass) 'sine' 0.6 0.008
  }
  $notes += New-Arp $at 2.0 0.125 (Get-Chord $chord.Tones) 'square' 0.17
}
$made += Write-Wav 'chase.wav' 8.0 $notes

$made
