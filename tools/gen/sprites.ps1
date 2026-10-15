# Part one of two: draws the generated artwork. Every sheet lands in the asset
# pack's sprites/ as its own strip with a json beside it describing frames,
# size, pivot and collision — the same shape a hand-drawn sheet would arrive
# in. Part two, pack-objects.ps1, is what turns that folder into
# objects/objects.png and objects/objects.json.
#
#   npm run gen:sprites -- -Pack garden
#
# Some objects carry a glow mask as a separate sheet. The game draws a sprite
# in its own colours and then the mask filled with the object's pairing colour
# on top; because the mask carries a soft alpha falloff the tint reads as a
# glow around the part that should be coloured, and never flattens the artwork
# underneath.
#
# Run this in a fresh shell (pwsh -File ...). The Add-Type below cannot
# replace an already-compiled Glow class, so a second run in the same session
# would silently keep the old one.
param([string]$Pack = 'garden')
. (Join-Path $PSScriptRoot '_pack.ps1')
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
public static class Glow {
  // Box blur of the alpha channel, twice, kept inside each animation frame so
  // neighbouring frames never bleed into one another. `peak` caps the result:
  // a mask is a tint, so even its solid core must let the art show through.
  public static void Apply(byte[] px, int w, int h, int frame, int radius, double strength, double peak) {
    int n = w * h;
    double[] a = new double[n];
    double[] tmp = new double[n];
    for (int i = 0; i < n; i++) a[i] = px[i * 4 + 3] / 255.0;
    double[] src = (double[])a.Clone();

    for (int pass = 0; pass < 2; pass++) {
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          int f0 = (x / frame) * frame, f1 = f0 + frame - 1;
          double sum = 0; int cnt = 0;
          for (int k = -radius; k <= radius; k++) {
            int xx = x + k;
            if (xx < f0 || xx > f1) continue;
            sum += src[y * w + xx]; cnt++;
          }
          tmp[y * w + x] = sum / cnt;
        }
      }
      for (int x = 0; x < w; x++) {
        for (int y = 0; y < h; y++) {
          double sum = 0; int cnt = 0;
          for (int k = -radius; k <= radius; k++) {
            int yy = y + k;
            if (yy < 0 || yy >= h) continue;
            sum += tmp[yy * w + x]; cnt++;
          }
          src[y * w + x] = sum / cnt;
        }
      }
    }

    for (int i = 0; i < n; i++) {
      double v = a[i] > src[i] * strength ? a[i] : src[i] * strength;
      if (v > 1) v = 1;
      v *= peak;
      px[i * 4] = 255; px[i * 4 + 1] = 255; px[i * 4 + 2] = 255;
      px[i * 4 + 3] = (byte)(v * 255 + 0.5);
    }
  }
}
'@

# One folder of sprite sheets, each with its own json beside it. Whatever a
# user hands over drops in here the same way; pack-objects.ps1 is what turns
# the folder into the atlas the game loads.
$spr = Get-PackDir $Pack 'sprites'
$S = 2                       # sprites are drawn at 2x and scaled down in game
$PEAK = 0.5                  # default cap, so a mask tints rather than replaces

function C([int]$a, [string]$hex) {
  [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($hex.Substring(1, 2), 16), [Convert]::ToInt32($hex.Substring(3, 2), 16), [Convert]::ToInt32($hex.Substring(5, 2), 16))
}
function B([int]$a, [string]$hex) { New-Object System.Drawing.SolidBrush (C $a $hex) }
function P([int]$a, [string]$hex, [double]$w) { New-Object System.Drawing.Pen ((C $a $hex), [single]$w) }

function New-Sheet([int]$frames, [int]$size) {
  $bmp = New-Object System.Drawing.Bitmap(($frames * $size), $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  return @{ bmp = $bmp; g = $g }
}

function Save-Sheet($sheet, [string]$name) {
  $sheet.g.Dispose()
  $sheet.bmp.Save((Join-Path $spr $name), [System.Drawing.Imaging.ImageFormat]::Png)
  "  {0,-18} {1}x{2}" -f $name, $sheet.bmp.Width, $sheet.bmp.Height
  $sheet.bmp.Dispose()
}

# Turns a drawn shape into a white glow mask: strongest where it was drawn,
# fading outward so the tint bleeds past the edge instead of stopping dead.
# $peak caps the alpha — below 1 the art shows through even at the core.
function Save-Glow($sheet, [string]$name, [int]$frame, [int]$radius, [double]$strength, [double]$peak = $PEAK) {
  $sheet.g.Dispose()
  $bmp = $sheet.bmp
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $bits = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $len = [Math]::Abs($bits.Stride) * $bmp.Height
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $buf, 0, $len)
  [Glow]::Apply($buf, $bmp.Width, $bmp.Height, $frame, $radius, $strength, $peak)
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bits.Scan0, $len)
  $bmp.UnlockBits($bits)
  $bmp.Save((Join-Path $spr $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $peakPct = [int]($peak * 100)
  "  {0,-18} {1}x{2}  glow r{3}, peak {4}%" -f $name, $bmp.Width, $bmp.Height, $radius, $peakPct
  $bmp.Dispose()
}

# The same blur, kept in memory and already in its own colour. A thing that
# glows for its own sake has no pairing colour to wait for, so its bloom can
# be baked into its art instead of riding along as a second sheet.
function New-GlowLayer($sheet, [int]$frame, [int]$radius, [double]$strength, [string]$hex, [double]$peak = $PEAK) {
  $sheet.g.Dispose()
  $bmp = $sheet.bmp
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $bits = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $len = [Math]::Abs($bits.Stride) * $bmp.Height
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $buf, 0, $len)
  [Glow]::Apply($buf, $bmp.Width, $bmp.Height, $frame, $radius, $strength, $peak)
  $col = C 255 $hex
  for ($i = 0; $i -lt $len; $i += 4) { $buf[$i] = $col.B; $buf[$i + 1] = $col.G; $buf[$i + 2] = $col.R }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bits.Scan0, $len)
  $bmp.UnlockBits($bits)
  return $bmp
}

# ---------- door ----------
$DOOR = 32 * $S
$t = New-Sheet 1 $DOOR
$t.g.ScaleTransform($S, $S)
$t.g.FillRectangle((B 255 '#7a4a2b'), 2, 0, 28, 32)
$t.g.FillRectangle((B 38 '#ffffff'), 4, 2, 24, 7)
$t.g.DrawRectangle((P 255 '#4a2c18' 2), 3, 1, 26, 30)
$t.g.FillEllipse((B 255 '#2b1a10'), 13, 10, 6, 6)
$t.g.FillRectangle((B 255 '#2b1a10'), 14, 14, 4, 7)
Save-Sheet $t 'door.png'

# Only a band inset from the frame takes the pairing colour, so the wood and
# the keyhole still read as a door however loud the colour is. The band runs
# at full alpha — it is narrow enough to stay readable — and the blur around
# it is what softens into a glow.
$t = New-Sheet 1 $DOOR
$t.g.ScaleTransform($S, $S)
$t.g.DrawRectangle((P 255 '#ffffff' 3.5), 6.5, 4.5, 19, 23)
Save-Glow $t 'doorGlow.png' $DOOR 4 0.7 1.0

# ---------- portal ----------
# six frames of the ring pulse and the swirl's rotation
$PORTAL_FRAMES = 6
$PORTAL = 64
$t = New-Sheet $PORTAL_FRAMES $PORTAL
$tm = New-Sheet $PORTAL_FRAMES $PORTAL
for ($f = 0; $f -lt $PORTAL_FRAMES; $f++) {
  $phase = ($f / [double]$PORTAL_FRAMES) * [Math]::PI * 2
  $cx = $f * $PORTAL + $PORTAL / 2
  $cy = $PORTAL / 2
  foreach ($pair in @(@($t.g, '#d8e8ff', 1.0), @($tm.g, '#ffffff', 1.0))) {
    $g = $pair[0]
    for ($i = 0; $i -lt 3; $i++) {
      $rr = 22 - $i * 5.5 + [Math]::Sin($phase + $i) * 3
      if ($rr -lt 3) { $rr = 3 }
      $alpha = [int](255 * (0.85 - $i * 0.22))
      $g.DrawEllipse((P $alpha $pair[1] 4), [single]($cx - $rr), [single]($cy - $rr), [single]($rr * 2), [single]($rr * 2))
    }
    $g.TranslateTransform([single]$cx, [single]$cy)
    $g.RotateTransform([single](($f / [double]$PORTAL_FRAMES) * 360))
    $g.FillEllipse((B 70 $pair[1]), -8, -17, 16, 34)
    $g.ResetTransform()
  }
}
Save-Sheet $t 'portal.png'
Save-Glow $tm 'portalGlow.png' $PORTAL 6 0.8

# ---------- key ----------
# key.png is existing art, so its mask comes from the pixels: the bright body
# becomes the tinted area, the dark outline stays out of it.
$KEY_FRAME = 40
$src = New-Object System.Drawing.Bitmap((Join-Path $spr 'key.png'))
$rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
$mask = New-Object System.Drawing.Bitmap($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sb = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$mb = $mask.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$len = [Math]::Abs($sb.Stride) * $src.Height
$buf = New-Object byte[] $len
$dst = New-Object byte[] $len
[System.Runtime.InteropServices.Marshal]::Copy($sb.Scan0, $buf, 0, $len)
for ($i = 0; $i -lt $len; $i += 4) {
  $a = $buf[$i + 3]
  if ($a -eq 0) { continue }
  $lum = 0.2126 * ($buf[$i + 2] / 255.0) + 0.7152 * ($buf[$i + 1] / 255.0) + 0.0722 * ($buf[$i] / 255.0)
  $w = ($lum - 0.35) / 0.25
  if ($w -lt 0) { $w = 0 } elseif ($w -gt 1) { $w = 1 }
  $dst[$i] = 255; $dst[$i + 1] = 255; $dst[$i + 2] = 255
  $dst[$i + 3] = [byte][Math]::Round($a * $w)
}
[System.Runtime.InteropServices.Marshal]::Copy($dst, 0, $mb.Scan0, $len)
$src.UnlockBits($sb); $mask.UnlockBits($mb); $src.Dispose()
Save-Glow @{ bmp = $mask; g = [System.Drawing.Graphics]::FromImage($mask) } 'keyGlow.png' $KEY_FRAME 4 0.8 1.0

# ---------- Warm (the worm) ----------
# Her body is a chain of circles that taper toward the tail, so the parts are
# drawn at the head's radius and the game scales each one to its own segment.
$WORM = 64                   # source frame, packed down to one tile
$WR = 22                     # head radius here; halves to the game's R = 11
$WC = $WORM / 2

function Hsl([double]$h, [double]$s, [double]$l) {
  $s /= 100; $l /= 100
  $c = (1 - [Math]::Abs(2 * $l - 1)) * $s
  $x = $c * (1 - [Math]::Abs((($h / 60) % 2) - 1))
  $m = $l - $c / 2
  switch ([int][Math]::Floor($h / 60)) {
    0 { $r = $c; $g = $x; $b = 0 }
    1 { $r = $x; $g = $c; $b = 0 }
    2 { $r = 0; $g = $c; $b = $x }
    3 { $r = 0; $g = $x; $b = $c }
    4 { $r = $x; $g = 0; $b = $c }
    default { $r = $c; $g = 0; $b = $x }
  }
  return [System.Drawing.Color]::FromArgb(255,
    [int][Math]::Round(($r + $m) * 255), [int][Math]::Round(($g + $m) * 255), [int][Math]::Round(($b + $m) * 255))
}

# One body circle: flat fill, a soft highlight up top and a darker rim.
function Draw-Segment($g, [double]$cx, [double]$cy, [double]$rad, $color) {
  $g.FillEllipse((New-Object System.Drawing.SolidBrush $color), ($cx - $rad), ($cy - $rad), ($rad * 2), ($rad * 2))
  $g.FillEllipse((B 60 '#ffffff'), ($cx - $rad * 0.5), ($cy - $rad * 0.72), ($rad * 0.85), ($rad * 0.6))
  $g.DrawEllipse((P 110 '#78320a' 3), ($cx - $rad + 1.5), ($cy - $rad + 1.5), ($rad * 2 - 3), ($rad * 2 - 3))
}

# One sheet, one frame size: the body ramp, the tail, then a head per facing.
$WORM_FRAMES = 8
$W_BODY0 = 0; $W_BODY1 = 4; $W_TAIL = 5; $W_HEAD_L = 6; $W_HEAD_R = 7

# Eyes are baked into the head, so facing is a frame rather than a transform.
function Draw-Eyes($g, [double]$cx, [double]$cy, [int]$dir) {
  foreach ($off in 6, 16) {
    $x = $cx + $dir * $off
    $g.FillEllipse((B 255 '#2b1a10'), ($x - 4), ($cy - 10), 8, 8)
    $g.FillEllipse((B 210 '#ffffff'), ($x - 1.6), ($cy - 9.2), 3.2, 3.2)
  }
}

$w = New-Sheet $WORM_FRAMES $WORM

for ($i = $W_BODY0; $i -le $W_BODY1; $i++) {
  $t = ($i - $W_BODY0) / ($W_BODY1 - $W_BODY0)
  Draw-Segment $w.g ($i * $WORM + $WC) $WC $WR (Hsl (28 + $t * 10) 90 (62 - $t * 10))
}

# The tail keeps the same circle so it lines up with the chain, plus a tip the
# game rotates to point away from the segment ahead of it.
$tx = $W_TAIL * $WORM + $WC
$tip = New-Object System.Drawing.Drawing2D.GraphicsPath
$tip.AddPolygon([System.Drawing.PointF[]]@(
  (New-Object System.Drawing.PointF (($tx + $WR * 0.2), ($WC - $WR * 0.85))),
  (New-Object System.Drawing.PointF (($tx + $WR * 1.3), $WC)),
  (New-Object System.Drawing.PointF (($tx + $WR * 0.2), ($WC + $WR * 0.85)))
))
$w.g.FillPath((New-Object System.Drawing.SolidBrush (Hsl 38 90 52)), $tip)
$tip.Dispose()
Draw-Segment $w.g $tx $WC $WR (Hsl 38 90 52)

foreach ($h in @($W_HEAD_L, -1), @($W_HEAD_R, 1)) {
  $hx = $h[0] * $WORM + $WC
  Draw-Segment $w.g $hx $WC $WR (C 255 '#ff8a3d')
  Draw-Eyes $w.g $hx $WC $h[1]
}
Save-Sheet $w 'worm.png'

# ---------- moth, frog, checkpoint, flag ----------
# All drawn at 2x and packed down, so a source frame of N is N/64 tiles wide.
function Fill-Oval($g, $brush, [double]$cx, [double]$cy, [double]$rx, [double]$ry, [double]$deg = 0) {
  $s = $g.Save()
  $g.TranslateTransform([single]$cx, [single]$cy)
  if ($deg -ne 0) { $g.RotateTransform([single]$deg) }
  $g.FillEllipse($brush, [single](-$rx), [single](-$ry), [single]($rx * 2), [single]($ry * 2))
  $g.Restore($s)
}
function Draw-Oval($g, $pen, [double]$cx, [double]$cy, [double]$rx, [double]$ry) {
  $g.DrawEllipse($pen, [single]($cx - $rx), [single]($cy - $ry), [single]($rx * 2), [single]($ry * 2))
}

# Moth: the wing flap is the whole animation, so it becomes the frames.
$MOTH = 96; $MR = 20
$m = New-Sheet 6 $MOTH
for ($i = 0; $i -lt 6; $i++) {
  $cx = $i * $MOTH + $MOTH / 2; $cy = $MOTH / 2
  $flap = [Math]::Sin($i / 6.0 * 2 * [Math]::PI) * 0.6 + 0.7
  Fill-Oval $m.g (B 190 '#c8aaff') ($cx - $MR * 0.9) $cy ($MR * 0.9) ($MR * 0.5 * $flap) 23
  Fill-Oval $m.g (B 190 '#c8aaff') ($cx + $MR * 0.9) $cy ($MR * 0.9) ($MR * 0.5 * $flap) -23
  Fill-Oval $m.g (B 255 '#6b4f8a') $cx $cy ($MR * 0.55) ($MR * 0.8)
  Draw-Oval $m.g (P 128 '#281438' 2.6) $cx $cy ($MR * 0.55) ($MR * 0.8)
  Fill-Oval $m.g (B 255 '#ffd35a') ($cx - $MR * 0.2) ($cy - $MR * 0.3) 3.6 3.6
  Fill-Oval $m.g (B 255 '#ffd35a') ($cx + $MR * 0.2) ($cy - $MR * 0.3) 3.6 3.6
}
Save-Sheet $m 'moth.png'

# Frog: one frame — its hop squash stays a transform, not artwork.
$FROG = 96; $FR = 24
$f = New-Sheet 1 $FROG
$fx = $FROG / 2; $fy = $FROG / 2
Fill-Oval $f.g (B 255 '#4aa84a') ($fx - $FR * 0.6) ($fy + $FR * 0.7) 8 10
Fill-Oval $f.g (B 255 '#4aa84a') ($fx + $FR * 0.6) ($fy + $FR * 0.7) 8 10
Fill-Oval $f.g (B 255 '#5fc95f') $fx ($fy + 4) $FR ($FR * 0.85)
Draw-Oval $f.g (P 128 '#143c14' 2.6) $fx ($fy + 4) $FR ($FR * 0.85)
Fill-Oval $f.g (B 255 '#ffffff') ($fx + $FR * 0.3) ($fy - $FR * 0.5) 8 8
Fill-Oval $f.g (B 255 '#1a3a1a') ($fx + $FR * 0.35) ($fy - $FR * 0.5) 4 4
Save-Sheet $f 'frog.png'

# Checkpoint: frame 0 dormant, frame 1 lit. Its pole reaches well above the
# collision circle, so the anchor sits low in the frame rather than centred.
$CPSIZE = 256; $CP_ANCHOR_Y = 180
$cpSheet = New-Sheet 2 $CPSIZE
foreach ($on in 0, 1) {
  $cx = $on * $CPSIZE + $CPSIZE / 2
  $ground = $CP_ANCHOR_Y + 32
  $top = $ground - 132
  if ($on) {
    Fill-Oval $cpSheet.g (B 60 '#5fe86b') $cx $top 52 52
    Draw-Oval $cpSheet.g (P 110 '#5fe86b' 4) $cx $top 52 52
  }
  $cpSheet.g.DrawLine((P 255 ($(if ($on) { '#5fe86b' } else { '#8a8a8a' })) 6), [single]$cx, [single]$ground, [single]$cx, [single]$top)
  $pennant = New-Object System.Drawing.Drawing2D.GraphicsPath
  $pennant.AddPolygon([System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF ($cx, $top)),
    (New-Object System.Drawing.PointF (($cx + 44), ($top + 16))),
    (New-Object System.Drawing.PointF ($cx, ($top + 32)))
  ))
  $cpSheet.g.FillPath((B 255 $(if ($on) { '#5fe86b' } else { '#6b6b6b' })), $pennant)
  $pennant.Dispose()
}
Save-Sheet $cpSheet 'checkpoint.png'

# Flag: the halo pulse is the animation; the pennant is masked so each exit
# can carry its own colour, the way keys, doors and portals do.
$FLAG = 128; $FR2 = 28
$fl = New-Sheet 6 $FLAG
for ($i = 0; $i -lt 6; $i++) {
  $cx = $i * $FLAG + $FLAG / 2; $cy = $FLAG / 2
  $halo = ($FR2 + 8) + [Math]::Sin($i / 6.0 * 2 * [Math]::PI) * 4
  Draw-Oval $fl.g (P 128 '#ffd35a' 4) $cx $cy $halo $halo
  $fl.g.DrawLine((P 255 '#c98a12' 6), [single]$cx, [single]($cy + $FR2), [single]$cx, [single]($cy - $FR2 - 28))
}
$flagPennant = {
  param($g, $cx, $cy, $brush)
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddPolygon([System.Drawing.PointF[]]@(
    (New-Object System.Drawing.PointF ($cx, ($cy - $FR2 - 28))),
    (New-Object System.Drawing.PointF (($cx + 32), ($cy - $FR2 - 16))),
    (New-Object System.Drawing.PointF ($cx, ($cy - $FR2 - 4)))
  ))
  $g.FillPath($brush, $p)
  $p.Dispose()
}
for ($i = 0; $i -lt 6; $i++) {
  & $flagPennant $fl.g ($i * $FLAG + $FLAG / 2) ($FLAG / 2) (B 255 '#ffd35a')
}
Save-Sheet $fl 'flag.png'

$flm = New-Sheet 1 $FLAG
& $flagPennant $flm.g ($FLAG / 2) ($FLAG / 2) (B 255 '#ffffff')
Save-Glow $flm 'flagGlow.png' $FLAG 3 0.8 1.0

# Carnivorous plant: bud, stem and open head share one anchor at its root, so
# the stem can stretch from there while the head is drawn at its own height.
$PLANTSIZE = 256; $PL_ROOT = 220; $PL_STEM = 200
$plant = New-Sheet 3 $PLANTSIZE
foreach ($part in 0, 1, 2) {
  $px = $part * $PLANTSIZE + $PLANTSIZE / 2
  switch ($part) {
    0 {
      Fill-Oval $plant.g (B 255 '#3f8f3f') $px ($PL_ROOT - 14) 16 22
      Draw-Oval $plant.g (P 255 '#245c24' 3) $px ($PL_ROOT - 14) 16 22
    }
    1 {
      $plant.g.FillRectangle((B 255 '#3f8f3f'), [single]($px - 7), [single]($PL_ROOT - $PL_STEM), 14, [single]$PL_STEM)
      $plant.g.FillRectangle((B 70 '#ffffff'), [single]($px - 5), [single]($PL_ROOT - $PL_STEM), 4, [single]$PL_STEM)
    }
    2 {
      Fill-Oval $plant.g (B 255 '#e0556b') ($px - 16) ($PL_ROOT - 6) 20 30 -26
      Draw-Oval $plant.g (P 255 '#a53249' 3) ($px - 16) ($PL_ROOT - 6) 20 30
      Fill-Oval $plant.g (B 255 '#e0556b') ($px + 16) ($PL_ROOT - 6) 20 30 26
      Draw-Oval $plant.g (P 255 '#a53249' 3) ($px + 16) ($PL_ROOT - 6) 20 30
      for ($i = -2; $i -le 2; $i++) {
        $tx = $px + $i * 8
        $tooth = New-Object System.Drawing.Drawing2D.GraphicsPath
        $tooth.AddPolygon([System.Drawing.PointF[]]@(
          (New-Object System.Drawing.PointF ($tx, ($PL_ROOT - 2))),
          (New-Object System.Drawing.PointF (($tx - 3.2), ($PL_ROOT - 16))),
          (New-Object System.Drawing.PointF (($tx + 3.2), ($PL_ROOT - 16)))
        ))
        $plant.g.FillPath((B 255 '#fff6ec'), $tooth)
        $tooth.Dispose()
      }
    }
  }
}
Save-Sheet $plant 'plant.png'

# ---------- gem, shield, falling rock ----------
# Gem: a brilliant cut spinning on its vertical axis. The facets are fixed; a
# per-frame horizontal squeeze turns it edge-on and the palette moves the
# highlight around, which is what sells the rotation.
function GemPath([double]$cx, [double]$cy, [double]$s, $coords) {
  $pts = foreach ($c in $coords) { New-Object System.Drawing.PointF (($cx + $c[0] * $s), ($cy + $c[1])) }
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddPolygon([System.Drawing.PointF[]]$pts)
  return $p
}

$GEM_BODY  = @(@(-11, -16), @(11, -16), @(16, -4), @(0, 20), @(-16, -4))
# crown: table, left shoulder, right shoulder — then the three pavilion wedges
$GEM_FACES = @(
  @(@(-6, -16), @(6, -16), @(9, -4), @(-9, -4)),
  @(@(-11, -16), @(-6, -16), @(-9, -4), @(-16, -4)),
  @(@(11, -16), @(6, -16), @(9, -4), @(16, -4)),
  @(@(-16, -4), @(-6, -4), @(0, 20)),
  @(@(-6, -4), @(6, -4), @(0, 20)),
  @(@(6, -4), @(16, -4), @(0, 20))
)
# squeeze plus the shade of each face, front -> turning -> edge-on -> turning
$GEM_SPIN = @(
  @{ s = 1.00; pal = @('#bfe8ff', '#ffffff', '#8fd4fb', '#4a9ef0', '#8fd4fb', '#2f6fd8') }
  @{ s = 0.72; pal = @('#ffffff', '#bfe8ff', '#2f6fd8', '#8fd4fb', '#4a9ef0', '#2358c4') }
  @{ s = 0.34; pal = @('#bfe8ff', '#ffffff', '#2f6fd8', '#8fd4fb', '#4a9ef0', '#2358c4') }
  @{ s = 0.72; pal = @('#8fd4fb', '#bfe8ff', '#ffffff', '#2358c4', '#8fd4fb', '#4a9ef0') }
)

$GEMSIZE = 64
$gem = New-Sheet $GEM_SPIN.Count $GEMSIZE
for ($i = 0; $i -lt $GEM_SPIN.Count; $i++) {
  $spin = $GEM_SPIN[$i]
  $gx = $i * $GEMSIZE + $GEMSIZE / 2; $gy = $GEMSIZE / 2
  for ($f = 0; $f -lt $GEM_FACES.Count; $f++) {
    $face = GemPath $gx $gy $spin.s $GEM_FACES[$f]
    $gem.g.FillPath((B 255 $spin.pal[$f]), $face)
    $face.Dispose()
  }
  $body = GemPath $gx $gy $spin.s $GEM_BODY
  # a fixed-width outline would swallow the stone once it turns edge-on
  $gem.g.DrawPath((P 255 '#15205e' ([Math]::Max(2.0, 4 * $spin.s))), $body)
  $body.Dispose()
}
Save-Sheet $gem 'gem.png'

# Shield: a glassy bubble with the crest inside it.
$SHIELDSIZE = 64; $SH_R = 20
$shield = New-Sheet 1 $SHIELDSIZE
$sc = $SHIELDSIZE / 2
Fill-Oval $shield.g (B 64 '#6fe3ff') $sc $sc $SH_R $SH_R
Draw-Oval $shield.g (P 255 '#6fe3ff' 4) $sc $sc $SH_R $SH_R
$crest = New-Object System.Drawing.Drawing2D.GraphicsPath
$crest.AddPolygon([System.Drawing.PointF[]]@(
  (New-Object System.Drawing.PointF ($sc, ($sc - 10))),
  (New-Object System.Drawing.PointF (($sc + 9), ($sc - 5))),
  (New-Object System.Drawing.PointF (($sc + 8), ($sc + 6))),
  (New-Object System.Drawing.PointF ($sc, ($sc + 12))),
  (New-Object System.Drawing.PointF (($sc - 8), ($sc + 6))),
  (New-Object System.Drawing.PointF (($sc - 9), ($sc - 5)))
))
$shield.g.FillPath((B 255 '#6fe3ff'), $crest)
$crest.Dispose()
Save-Sheet $shield 'shield.png'

# Lantern: one lamp per radius it can give, each with its own three-frame
# flame. They are drawn side by side so they share the work below, then saved
# as a sheet each — lanternFull, lanternSmall, lanternBig — since each lamp is
# a sprite of its own, worn by its own Lantern object. The art has to say which
# lamp it is at a glance, so the halo, the flame and the pane all change with it:
#   fulllight   wide open, nothing held back — the whole level stays lit
#   smalllight  shuttered down to a couple of tiles
#   biglight    a broad flare between the two
# Its bloom is baked in at the end rather than carried as a pairing mask: the
# lamp always glows its own colour, so there is nothing to tint at runtime.
# The darkness the game paints once she picks it up is a separate thing.
$LANTSIZE = 64
$LANT_PULSE = @(1.0, 1.12, 0.92)
$LANT_KINDS = @(
  @{ halo = @(@(27, 30), @(20, 56), @(14, 92)); flame = 1.35; pane = 240; maskR = 12; shutter = $false }
  @{ halo = @(@(13, 18), @(9, 40), @(6, 70));   flame = 0.5;  pane = 140; maskR = 5;  shutter = $true }
  @{ halo = @(@(22, 26), @(16, 50), @(11, 80)); flame = 1.0;  pane = 210; maskR = 9;  shutter = $false }
)
$LANT_FRAMES = $LANT_KINDS.Count * $LANT_PULSE.Count
$lantern = New-Sheet $LANT_FRAMES $LANTSIZE
$fi = 0
foreach ($kind in $LANT_KINDS) {
  foreach ($p in $LANT_PULSE) {
    $cx = $fi * $LANTSIZE + $LANTSIZE / 2; $cy = $LANTSIZE / 2
    # halo first, so every part of the lamp sits on top of it
    foreach ($ring in $kind.halo) {
      Fill-Oval $lantern.g (B $ring[1] '#ffd98a') $cx ($cy + 2) ($ring[0] * $p) ($ring[0] * $p)
    }
    $lantern.g.DrawArc((P 255 '#6b5a4a' 3), [single]($cx - 7), [single]($cy - 24), [single]14, [single]12, 180, 180)
    $lantern.g.FillRectangle((B 255 '#8a7460'), [single]($cx - 9), [single]($cy - 18), [single]18, [single]5)
    # glass: a warm pane with a brighter core that breathes with the flame
    $glass = New-Object System.Drawing.Drawing2D.GraphicsPath
    $glass.AddPolygon([System.Drawing.PointF[]]@(
      (New-Object System.Drawing.PointF (($cx - 8), ($cy - 13))),
      (New-Object System.Drawing.PointF (($cx + 8), ($cy - 13))),
      (New-Object System.Drawing.PointF (($cx + 11), ($cy + 11))),
      (New-Object System.Drawing.PointF (($cx - 11), ($cy + 11)))
    ))
    $lantern.g.FillPath((B $kind.pane '#ffcc5c'), $glass)
    $lantern.g.DrawPath((P 255 '#6b5a4a' 3), $glass)
    $glass.Dispose()
    $fl = $kind.flame * $p
    Fill-Oval $lantern.g (B 235 '#fff4c8') $cx ($cy + 1) (5 * $fl) (7.5 * $fl)
    Fill-Oval $lantern.g (B 255 '#ffffff') $cx ($cy - 1) (2.4 * $fl) (4 * $fl)
    # the small lamp is louvred shut, which is why so little of it gets out
    if ($kind.shutter) {
      foreach ($sy in -8, -3, 2, 7) {
        $lantern.g.FillRectangle((B 230 '#6b5a4a'), [single]($cx - 9), [single]($cy + $sy), [single]18, [single]2)
      }
    }
    $lantern.g.FillRectangle((B 255 '#8a7460'), [single]($cx - 12), [single]($cy + 11), [single]24, [single]6)
    $lantern.g.DrawRectangle((P 255 '#6b5a4a' 2), [single]($cx - 12), [single]($cy + 11), [single]24, [single]6)
    $fi++
  }
}

# The bloom goes on last, so it lies over the metal and the glass rather than
# only behind them. Each lamp's is its own size, frame for frame with the
# flame so the two breathe together.
$lantBloom = New-Sheet $LANT_FRAMES $LANTSIZE
$fi = 0
foreach ($kind in $LANT_KINDS) {
  foreach ($p in $LANT_PULSE) {
    $cx = $fi * $LANTSIZE + $LANTSIZE / 2; $cy = $LANTSIZE / 2
    Fill-Oval $lantBloom.g (B 255 '#ffffff') $cx ($cy + 1) ($kind.maskR * $p) ($kind.maskR * 1.22 * $p)
    $fi++
  }
}
$bloom = New-GlowLayer $lantBloom $LANTSIZE 7 0.85 '#ffd98a'
$lantern.g.DrawImage($bloom, 0, 0)
$bloom.Dispose()
$lantern.g.Dispose()
$LANT_NAMES = @('lanternFull', 'lanternSmall', 'lanternBig')   # $LANT_KINDS' order
for ($k = 0; $k -lt $LANT_KINDS.Count; $k++) {
  $w = $LANT_PULSE.Count * $LANTSIZE
  $one = $lantern.bmp.Clone((New-Object System.Drawing.Rectangle(($k * $w), 0, $w, $LANTSIZE)), $lantern.bmp.PixelFormat)
  $one.Save((Join-Path $spr ($LANT_NAMES[$k] + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
  "  {0,-18} {1}x{2}" -f ($LANT_NAMES[$k] + '.png'), $one.Width, $one.Height
  $one.Dispose()
}
$lantern.bmp.Dispose()

# Rock: the tumble is a transform, so one lumpy frame serves.
$ROCKSIZE = 64; $ROCK_R = 18
$rock = New-Sheet 1 $ROCKSIZE
$rc = $ROCKSIZE / 2
$lump = New-Object System.Drawing.Drawing2D.GraphicsPath
$pts = foreach ($i in 0..5) {
  $a = ($i / 6.0) * 2 * [Math]::PI
  $rr = $ROCK_R * $(if ($i % 2 -eq 0) { 1 } else { 0.75 })
  New-Object System.Drawing.PointF (($rc + [Math]::Cos($a) * $rr), ($rc + [Math]::Sin($a) * $rr))
}
$lump.AddPolygon([System.Drawing.PointF[]]$pts)
$rock.g.FillPath((B 255 '#6b5a52'), $lump)
$rock.g.DrawPath((P 255 '#3d322c' 3), $lump)
$lump.Dispose()
Fill-Oval $rock.g (B 70 '#ffffff') ($rc - 4) ($rc - 5) 5 3.5 -25
Save-Sheet $rock 'rock.png'

# Silver coin: the same spin trick as the gem — a horizontal squeeze through
# edge-on, with the face mark squeezing along with it.
$C2SIZE = 64; $C2R = 22
$COIN2_SPIN = @(1.0, 0.72, 0.34, 0.1, 0.34, 0.72)
$coin2 = New-Sheet $COIN2_SPIN.Count $C2SIZE
for ($i = 0; $i -lt $COIN2_SPIN.Count; $i++) {
  $s = $COIN2_SPIN[$i]
  $cx = $i * $C2SIZE + $C2SIZE / 2; $cy = $C2SIZE / 2
  Fill-Oval $coin2.g (B 255 '#5f7389') $cx $cy ($C2R * $s) $C2R
  Fill-Oval $coin2.g (B 255 '#c3d6e8') $cx $cy ($C2R * $s * 0.74) ($C2R * 0.74)
  if ($s -gt 0.3) {
    # a notched ring, so the face reads as struck metal rather than a blank disc
    Draw-Oval $coin2.g (P 255 '#5f7389' 3) $cx $cy ($C2R * $s * 0.48) ($C2R * 0.48)
    Fill-Oval $coin2.g (B 235 '#ffffff') ($cx - $C2R * $s * 0.3) ($cy - $C2R * 0.32) ($C2R * $s * 0.18) ($C2R * 0.2)
  }
  Draw-Oval $coin2.g (P 255 '#1d2836' ([Math]::Max(2.0, 4 * $s))) $cx $cy ($C2R * $s) $C2R
}
Save-Sheet $coin2 'coin2.png'

# Signpost: a board on a post, planted on the ground. Still, so one frame.
# Drawn in game pixels — the 2x transform is what buys the detail back.
# ($S is spelled out here: the coin2 loop above binds $s, and names don't care.)
$SIGN_SCALE = 2
$SIGNSIZE = 48 * $SIGN_SCALE
$sign = New-Sheet 1 $SIGNSIZE
$sign.g.ScaleTransform($SIGN_SCALE, $SIGN_SCALE)
$sign.g.FillRectangle((B 255 '#7a4a2b'), 21, 16, 6, 30)
$sign.g.DrawRectangle((P 255 '#4a2c18' 1.5), 21, 16, 6, 30)
$sign.g.FillRectangle((B 255 '#b5803f'), 6, 7, 36, 18)
$sign.g.FillRectangle((B 45 '#ffffff'), 8, 9, 32, 6)
$sign.g.DrawRectangle((P 255 '#4a2c18' 2), 6, 7, 36, 18)
foreach ($ly in 12, 16, 20) {
  $w = $(if ($ly -eq 20) { 16 } else { 24 })
  $sign.g.FillRectangle((B 190 '#4a2c18'), 11, $ly, $w, 2)
}
Save-Sheet $sign 'sign.png'

# Cloud: scenery, and the one thing here that is much bigger than the cell it
# is written into — 200x100 drawn, where a tile is 32. Nothing collides with
# it and nothing animates, so it is one frame of soft lumps.
# The cell is square and sized to the width; the art is laid out to fill
# exactly 400x200 of it and the packer crops the empty bands off again.
$CLOUDSIZE = 400
$cloud = New-Sheet 1 $CLOUDSIZE
$ccx = $CLOUDSIZE / 2; $ccy = $CLOUDSIZE / 2
$cloud.g.FillRectangle((B 235 '#eef3ff'), [single]($ccx - 170), [single]($ccy + 20), [single]340, [single]80)
foreach ($puff in @(@(-152, 24, 48, 76), @(-70, -6, 72, 94), @(26, -10, 70, 90), @(112, 20, 60, 80), @(164, 38, 36, 62))) {
  Fill-Oval $cloud.g (B 235 '#eef3ff') ($ccx + $puff[0]) ($ccy + $puff[1]) $puff[2] $puff[3]
}
# an underside a shade cooler, so it reads as lit from above
foreach ($shade in @(@(-110, 70, 56, 22), @(-10, 80, 86, 20), @(96, 72, 54, 21))) {
  Fill-Oval $cloud.g (B 110 '#b9c7e8') ($ccx + $shade[0]) ($ccy + $shade[1]) $shade[2] $shade[3]
}
Save-Sheet $cloud 'cloud.png'

# ---------- each sheet's own description, written beside it ----------
# This is what a hand-made sprite arrives with, and all _pack-objects.ps1 needs
# to fold it into the atlas:
#   frames     how many frames the strip holds
#   fps        frames per second; left out for stills and per-instance animation
#   tiles      drawn size of one frame as a multiple of a 32px tile
#   pivot      where the thing's own position sits in a frame, 0..1
#   collision  shape and size in world pixels; its place comes from the pivot
#   slice      cap width in source pixels, for art drawn wider than its box
#   parts      named frame indices
#   mask       the glow sheet drawn over this one, tinted by the pairing id
#   glow       a colour the mask is filled with instead, for a thing that
#              glows on its own account rather than to match a key
#   fall       how fast this thing drops: gravity and terminal speed, px/frame
#   copy       a second object on another's art — it brings only its own
#              gameplay fields and has no sheet of its own
$sprites = @(
  @{ n = 'beetle';     frames = 6; fps = 10;  tiles = 1.0;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 12 } }
  @{ n = 'coin';       frames = 6; fps = 7.5; tiles = 0.8125;  pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 6 } }
  @{ n = 'coin2';      frames = 6; fps = 7.5; tiles = 1.0;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 6 } }
  @{ n = 'key';        frames = 6; fps = 6;   tiles = 1.3125;  pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 9 }; mask = 'keyGlow' }
  @{ n = 'keyGlow';    frames = 6; fps = 6;   tiles = 1.3125;  pivot = @(0.5, 0.5) }
  @{ n = 'portal';     frames = 6; fps = 8.6; tiles = 1.25;    pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 14 }; mask = 'portalGlow' }
  @{ n = 'portalGlow'; frames = 6; fps = 8.6; tiles = 1.25;    pivot = @(0.5, 0.5) }
  @{ n = 'door';       frames = 1; fps = 0;   tiles = 1.0;     pivot = @(0.0, 0.0);      col = @{ shape = 'tile' }; mask = 'doorGlow' }
  @{ n = 'doorGlow';   frames = 1; fps = 0;   tiles = 1.0;     pivot = @(0.0, 0.0) }
  @{ n = 'platform';   frames = 6; fps = 7.5; tiles = 1.8125;  pivot = @(0.5, 0.328125); col = @{ shape = 'box'; w = 32; h = 10 }; slice = 12 }
  @{ n = 'worm';       frames = 8; fps = 0;   tiles = 1.0;     pivot = @(0.5, 0.5); parts = @{ body = @($W_BODY0, $W_BODY1); tail = $W_TAIL; headLeft = $W_HEAD_L; headRight = $W_HEAD_R } }
  @{ n = 'moth';       frames = 6; fps = 24;  tiles = 1.5;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 10 } }
  @{ n = 'frog';       frames = 1; fps = 0;   tiles = 1.5;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 12 } }
  @{ n = 'checkpoint'; frames = 2; fps = 0;   tiles = 4.0;     pivot = @(0.5, 0.703125); col = @{ shape = 'circle'; r = 14 }; parts = @{ off = 0; on = 1 } }
  @{ n = 'flag';       frames = 6; fps = 3;   tiles = 2.0;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 14 }; mask = 'flagGlow' }
  @{ n = 'flagGlow';   frames = 1; fps = 0;   tiles = 2.0;     pivot = @(0.5, 0.5) }
  @{ n = 'plant';      frames = 3; fps = 0;   tiles = 4.0;     pivot = @(0.5, 0.859375); col = @{ shape = 'circle'; r = 13 }; parts = @{ bud = 0; stem = 1; head = 2 } }
  @{ n = 'gem';        frames = 4; fps = 6;   tiles = 1.0;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 8 } }
  @{ n = 'shield';     frames = 1; fps = 0;   tiles = 1.0;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 10 } }
  @{ n = 'lanternFull';  frames = 3; fps = 6; tiles = 1.25;  pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 11 } }
  @{ n = 'lanternSmall'; frames = 3; fps = 6; tiles = 1.25;  pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 11 } }
  @{ n = 'lanternBig';   frames = 3; fps = 6; tiles = 1.25;  pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 11 } }
  @{ n = 'rock';       frames = 1; fps = 0;   tiles = 1.0;     pivot = @(0.5, 0.5);      col = @{ shape = 'circle'; r = 9 }; fall = @{ gravity = 0.55; max = 12 } }
  # the same stone, lighter on its feet: one sheet, two things to dodge
  @{ n = 'rock2';      copy = 'rock';                                                     col = @{ shape = 'circle'; r = 9 }; fall = @{ gravity = 0.22; max = 4.5 } }
  # pivot sits 16px above the post's base, so the sign stands on the floor of its cell
  @{ n = 'sign';       frames = 1; fps = 0;   tiles = 1.5;     pivot = @(0.5, 0.6458333); col = @{ shape = 'circle'; r = 16 } }
  # scenery only: no collision, so it needs no shape and nothing can touch it
  @{ n = 'cloud';      frames = 1; fps = 0;   tiles = 6.25;    pivot = @(0.5, 0.5) }
)

function Json-Num([double]$v) {
  $v = [Math]::Round($v, 6)
  if ($v -eq [Math]::Floor($v)) { return [string][int]$v }
  return $v.ToString([System.Globalization.CultureInfo]::InvariantCulture)
}

foreach ($s in $sprites) {
  $parts = New-Object System.Collections.Generic.List[string]
  if ($s.copy) {
    $parts.Add(('  "copy": "{0}"' -f $s.copy))
  }
  else {
    $png = Join-Path $spr ($s.n + '.png')
    if (-not (Test-Path $png)) { Write-Warning "$($s.n): no sheet at $png"; continue }
    $parts.Add(('  "frames": {0}' -f $s.frames))
    if ($s.fps -gt 0) { $parts.Add(('  "fps": {0}' -f (Json-Num $s.fps))) }
    $parts.Add(('  "tiles": {0}' -f (Json-Num $s.tiles)))
    $parts.Add(('  "pivot": [{0}, {1}]' -f (Json-Num $s.pivot[0]), (Json-Num $s.pivot[1])))
    if ($s.slice) { $parts.Add(('  "slice": {0}' -f (Json-Num $s.slice))) }
    if ($s.mask) { $parts.Add(('  "mask": "{0}"' -f $s.mask)) }
    if ($s.glow) { $parts.Add(('  "glow": "{0}"' -f $s.glow)) }
    if ($s.parts) {
      $kv = foreach ($k in ($s.parts.Keys | Sort-Object)) {
        $v = $s.parts[$k]
        if ($v -is [array]) { '"{0}": [{1}, {2}]' -f $k, $v[0], $v[1] } else { '"{0}": {1}' -f $k, $v }
      }
      $parts.Add(('  "parts": {{ {0} }}' -f ($kv -join ', ')))
    }
  }
  if ($s.col) {
    $c = $s.col
    if ($c.shape -eq 'circle') { $parts.Add(('  "collision": {{ "shape": "circle", "r": {0} }}' -f (Json-Num $c.r))) }
    elseif ($c.shape -eq 'box') { $parts.Add(('  "collision": {{ "shape": "box", "w": {0}, "h": {1} }}' -f (Json-Num $c.w), (Json-Num $c.h))) }
    else { $parts.Add('  "collision": { "shape": "tile" }') }
  }
  if ($s.fall) { $parts.Add(('  "fall": {{ "gravity": {0}, "max": {1} }}' -f (Json-Num $s.fall.gravity), (Json-Num $s.fall.max))) }
  Set-Content (Join-Path $spr ($s.n + '.json')) ("{`n" + ($parts -join ",`n") + "`n}") -NoNewline -Encoding utf8
}
"  {0,-18} {1} sheets + json" -f 'sprites/', $sprites.Count
