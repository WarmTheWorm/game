# Renders the two tiling background sprites the test pack uses. Both are
# transparent PNGs, so the level's background colour shows through and one
# sheet can sit over several colours. Each is seamless: anything drawn near
# an edge is drawn again one tile over, so the repeat has no join.
Add-Type -AssemblyName System.Drawing

function Save-Png($bmp, $name) {
  $path = Join-Path $PSScriptRoot $name
  $size = "{0}x{1}" -f $bmp.Width, $bmp.Height
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "{0}  {1}" -f $name, $size
}

# --- stars: scattered specks, for the room that should feel like deep space
$W = 128; $H = 128
$stars = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($stars)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::Transparent)
$rand = New-Object System.Random(20260103)   # fixed seed, so a rerun redraws the same sky
for ($i = 0; $i -lt 44; $i++) {
  $x = $rand.NextDouble() * $W
  $y = $rand.NextDouble() * $H
  $r = 0.6 + $rand.NextDouble() * 1.9
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb((60 + $rand.Next(150)), 255, 252, 226))
  foreach ($dx in @(-$W, 0, $W)) {
    foreach ($dy in @(-$H, 0, $H)) {
      $g.FillEllipse($brush, [single]($x + $dx - $r), [single]($y + $dy - $r), [single]($r * 2), [single]($r * 2))
    }
  }
  $brush.Dispose()
}
$g.Dispose()
Save-Png $stars 'bg-stars.png'

# --- bricks: a running-bond wall, for the room that should feel enclosed
$W = 64; $H = 64
$bricks = New-Object System.Drawing.Bitmap($W, $H, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bricks)
$g.Clear([System.Drawing.Color]::Transparent)
$face = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
$mortar = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(70, 0, 0, 0), 2)
for ($row = 0; $row -lt 4; $row++) {
  $y = $row * 16
  $offset = ($row % 2) * 16
  for ($x = $offset - 32; $x -lt $W; $x += 32) {
    $g.FillRectangle($face, [single]($x + 1), [single]($y + 1), [single]30, [single]14)
    $g.DrawRectangle($mortar, [single]$x, [single]$y, [single]32, [single]16)
  }
}
$face.Dispose(); $mortar.Dispose(); $g.Dispose()
Save-Png $bricks 'bg-bricks.png'
