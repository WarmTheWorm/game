# The tiling backgrounds the level editor offers. Every one is transparent, so
# the level's own colour shows through and one sheet suits several moods, and
# every one is seamless: anything drawn near an edge is drawn again a tile
# over, in all eight directions, so the repeat has no join.
#
# Run with: pwsh -NoProfile -File assets\editor\backgrounds\_generate.ps1
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

function New-Canvas([int]$wid, [int]$hgt) {
  $bitmap = New-Object System.Drawing.Bitmap($wid, $hgt, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gfx = [System.Drawing.Graphics]::FromImage($bitmap)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  # GDI+ otherwise treats coordinates as pixel centres and smears everything half a pixel
  $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $gfx.Clear([System.Drawing.Color]::Transparent)
  return @{ bitmap = $bitmap; gfx = $gfx; wid = $wid; hgt = $hgt }
}

function Save-Canvas($canvas, [string]$name) {
  $canvas.gfx.Dispose()
  $canvas.bitmap.Save((Join-Path $PSScriptRoot $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $text = "{0,-14} {1}x{2}" -f $name, $canvas.bitmap.Width, $canvas.bitmap.Height
  $canvas.bitmap.Dispose()
  $text
}

function Get-Shade([int]$alpha, [int]$red, [int]$green, [int]$blue) {
  New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($alpha, $red, $green, $blue))
}

# The nine offsets are what make the repeat seamless: a shape hanging off one
# edge is drawn again coming in at the opposite one.
function Add-WrappedEllipse($canvas, $brush, [double]$cx, [double]$cy, [double]$rx, [double]$ry) {
  foreach ($dx in -$canvas.wid, 0, $canvas.wid) {
    foreach ($dy in -$canvas.hgt, 0, $canvas.hgt) {
      $canvas.gfx.FillEllipse($brush, [single]($cx + $dx - $rx), [single]($cy + $dy - $ry), [single]($rx * 2), [single]($ry * 2))
    }
  }
}

function Add-WrappedLine($canvas, $pen, [double]$x1, [double]$y1, [double]$x2, [double]$y2) {
  foreach ($dx in -$canvas.wid, 0, $canvas.wid) {
    foreach ($dy in -$canvas.hgt, 0, $canvas.hgt) {
      $canvas.gfx.DrawLine($pen, [single]($x1 + $dx), [single]($y1 + $dy), [single]($x2 + $dx), [single]($y2 + $dy))
    }
  }
}

$made = @()

# --- clouds: soft banks of puffs, for anything under an open sky
$sky = New-Canvas 256 128
$rnd = New-Object System.Random(20261009)
$puff = Get-Shade 26 255 255 255
for ($i = 0; $i -lt 11; $i++) {
  $cx = $rnd.NextDouble() * 256
  $cy = $rnd.NextDouble() * 128
  for ($p = 0; $p -lt (4 + $rnd.Next(4)); $p++) {
    $rx = 14 + $rnd.NextDouble() * 22
    Add-WrappedEllipse $sky $puff ($cx + ($rnd.NextDouble() - 0.5) * 76) ($cy + ($rnd.NextDouble() - 0.5) * 22) $rx ($rx * 0.58)
  }
}
$puff.Dispose()
$made += Save-Canvas $sky 'clouds.png'

# --- stars: scattered specks, for the room that should feel like deep space
$night = New-Canvas 128 128
$rnd = New-Object System.Random(20260103)
for ($i = 0; $i -lt 46; $i++) {
  $rad = 0.6 + $rnd.NextDouble() * 1.9
  $spark = Get-Shade (60 + $rnd.Next(150)) 255 252 226
  Add-WrappedEllipse $night $spark ($rnd.NextDouble() * 128) ($rnd.NextDouble() * 128) $rad $rad
  $spark.Dispose()
}
$made += Save-Canvas $night 'stars.png'

# --- bricks: a running-bond wall, for the room that should feel enclosed.
# Every mark is a fill on the 32x16 grid and nothing is drawn over anything
# else, so the sheet is exactly periodic and the tile has no edge of its own.
# An outlined rectangle per brick would double the shared joints and leave a
# visible line down the repeat.
$wall = New-Canvas 64 64
$face = Get-Shade 38 255 255 255
$mortar = Get-Shade 70 0 0 0
for ($row = 0; $row -lt 4; $row++) {
  $top = $row * 16
  $shift = ($row % 2) * 16
  $wall.gfx.FillRectangle($mortar, [single]0, [single]$top, [single]64, [single]2)
  foreach ($left in ($shift - 32), $shift, ($shift + 32)) {
    $wall.gfx.FillRectangle($mortar, [single]$left, [single]($top + 2), [single]2, [single]14)
    $wall.gfx.FillRectangle($face, [single]($left + 2), [single]($top + 2), [single]30, [single]14)
  }
}
$face.Dispose(); $mortar.Dispose()
$made += Save-Canvas $wall 'bricks.png'

# --- leaves: overlapping canopy blobs, for somewhere green and close
$canopy = New-Canvas 128 128
$rnd = New-Object System.Random(20260720)
for ($i = 0; $i -lt 26; $i++) {
  $cx = $rnd.NextDouble() * 128
  $cy = $rnd.NextDouble() * 128
  $leaf = Get-Shade (22 + $rnd.Next(26)) 36 (92 + $rnd.Next(60)) 44
  for ($p = 0; $p -lt 3; $p++) {
    $rx = 7 + $rnd.NextDouble() * 11
    Add-WrappedEllipse $canopy $leaf ($cx + ($rnd.NextDouble() - 0.5) * 22) ($cy + ($rnd.NextDouble() - 0.5) * 18) $rx ($rx * 0.72)
  }
  $leaf.Dispose()
}
$made += Save-Canvas $canopy 'leaves.png'

# --- cave: speckled rock with a few hairline cracks, for underground
$rock = New-Canvas 96 96
$rnd = New-Object System.Random(20260411)
for ($i = 0; $i -lt 150; $i++) {
  $rad = 1.0 + $rnd.NextDouble() * 3.4
  $grit = if ($rnd.Next(2)) { Get-Shade (14 + $rnd.Next(20)) 255 255 255 } else { Get-Shade (18 + $rnd.Next(26)) 0 0 0 }
  Add-WrappedEllipse $rock $grit ($rnd.NextDouble() * 96) ($rnd.NextDouble() * 96) $rad $rad
  $grit.Dispose()
}
$crack = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(46, 0, 0, 0), 1.4)
for ($i = 0; $i -lt 5; $i++) {
  $px = $rnd.NextDouble() * 96
  $py = $rnd.NextDouble() * 96
  for ($seg = 0; $seg -lt 4; $seg++) {
    $nx = $px + ($rnd.NextDouble() - 0.5) * 30
    $ny = $py + ($rnd.NextDouble() - 0.5) * 30
    Add-WrappedLine $rock $crack $px $py $nx $ny
    $px = $nx; $py = $ny
  }
}
$crack.Dispose()
$made += Save-Canvas $rock 'cave.png'

# --- rain: slanted streaks. The slope is exactly one tile across one tile
# down, so the diagonal lines up with itself at every edge.
$storm = New-Canvas 64 64
$rnd = New-Object System.Random(20260228)
for ($i = 0; $i -lt 14; $i++) {
  $drop = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb((28 + $rnd.Next(44)), 206, 230, 255), 1.0)
  $sx = $rnd.NextDouble() * 64
  $sy = $rnd.NextDouble() * 64
  $len = 9 + $rnd.NextDouble() * 13
  Add-WrappedLine $storm $drop $sx $sy ($sx + $len) ($sy + $len)
  $drop.Dispose()
}
$made += Save-Canvas $storm 'rain.png'

$made
