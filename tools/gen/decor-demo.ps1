# Renders a side-by-side of the three ways a sheet row could be blitted, so the
# cost of dropping row_D is visible rather than argued.
#
#   A  row_D as written          — decor padded, terrain cropped
#   B  no row_D, all cropped     — decor loses whatever it drew in the margin
#   C  no row_D, decor := no collision — pass-through terrain bleeds on neighbours
#
# Cells that differ from A are outlined in red.
param([string]$Pack = 'garden')
. (Join-Path $PSScriptRoot '_pack.ps1')
Add-Type -AssemblyName System.Drawing

$TILE = 32; $PAD = 4; $S = 2
$CELL = ($TILE + $PAD * 2) * $S       # 80
$GUTTER = $CELL
$INSET = $PAD * $S                    # 8
$PADDED = $TILE + $PAD * 2            # 40
$ZOOM = 5

$sheet = [System.Drawing.Bitmap]::FromFile((Join-Path (Get-PackDir $Pack 'tiles') 'tiles.png'))

# sheet row -> collision class, straight out of row_C
$rowC = 'SSSSSSSSSS0123 ^    '
# sheet row -> draw mode, straight out of row_D
$rowD = 'TTTTTTTTTTTTTTTTDDDD'

# glyph -> sheet row + tint column
$look = @{
  '#' = @{ row = 1; tint = 1 }
  'B' = @{ row = 4; tint = 2 }
  'T' = @{ row = 14; tint = 0 }
  '*' = @{ row = 16; tint = 0 }
  'o' = @{ row = 17; tint = 0 }
  '$' = @{ row = 18; tint = 0 }
  '~' = @{ row = 19; tint = 0 }
}

# the middle of levelpacks/test/rowd-decor.json
$scene = @(
  '~~~~~~~.....'
  '.TTTTTTTTTT.'
  '..$*$o$*....'
  '..BBBBBB....'
  '............'
  '..$*o$~*....'
  '############'
)
$COLS = $scene[0].Length; $ROWS = $scene.Count

$attr = New-Object System.Drawing.Imaging.ImageAttributes
$attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)

function Render-Scene([string]$mode) {
  $bmp = New-Object System.Drawing.Bitmap(($COLS * $TILE), ($ROWS * $TILE), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 29, 59, 99))), 0, 0, $bmp.Width, $bmp.Height)

  for ($r = 0; $r -lt $ROWS; $r++) {
    for ($c = 0; $c -lt $COLS; $c++) {
      $glyph = $scene[$r][$c].ToString()
      if (-not $look.ContainsKey($glyph)) { continue }
      $row = $look[$glyph].row; $tint = $look[$glyph].tint
      $sx = $GUTTER + $tint * $CELL
      $sy = $GUTTER + $row * $CELL
      $x = $c * $TILE; $y = $r * $TILE

      switch ($mode) {
        'A' { $decor = $rowD[$row] -ceq 'D' }
        'B' { $decor = $false }
      }

      if ($decor) {
        $dst = New-Object System.Drawing.Rectangle (($x - $PAD), ($y - $PAD), $PADDED, $PADDED)
        $g.DrawImage($sheet, $dst, $sx, $sy, $CELL, $CELL, [System.Drawing.GraphicsUnit]::Pixel, $attr)
      } else {
        $dst = New-Object System.Drawing.Rectangle $x, $y, $TILE, $TILE
        $g.DrawImage($sheet, $dst, ($sx + $INSET), ($sy + $INSET), ($CELL - $INSET * 2), ($CELL - $INSET * 2), [System.Drawing.GraphicsUnit]::Pixel, $attr)
      }
    }
  }
  $g.Dispose()
  return $bmp
}

$panels = [ordered]@{
  'A   rowd-decor.json   row_D = TTTTTTTTTTTTTTTTDDDD'  = Render-Scene 'A'
  'B   rowd-allt.json    row_D = TTTTTTTTTTTTTTTTTTTT'  = Render-Scene 'B'
}
$ref = $panels[0]

# Which tiles actually differ from A, measured rather than assumed.
function Diff-Cells($bmp) {
  $hits = @()
  for ($r = 0; $r -lt $ROWS; $r++) {
    for ($c = 0; $c -lt $COLS; $c++) {
      $bad = $false
      for ($y = $r * $TILE; $y -lt ($r + 1) * $TILE -and -not $bad; $y++) {
        for ($x = $c * $TILE; $x -lt ($c + 1) * $TILE; $x++) {
          if ($bmp.GetPixel($x, $y) -ne $ref.GetPixel($x, $y)) { $bad = $true; break }
        }
      }
      if ($bad) { $hits += , @($r, $c) }
    }
  }
  return $hits
}

$W = $COLS * $TILE * $ZOOM
$H = $ROWS * $TILE * $ZOOM
$LABEL = 34
$M = 20
$out = New-Object System.Drawing.Bitmap (($W + $M * 2), ($M + ($H + $LABEL + $M) * $panels.Count), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$og = [System.Drawing.Graphics]::FromImage($out)
$og.Clear([System.Drawing.Color]::FromArgb(255, 24, 24, 28))
$og.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$og.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$og.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$og.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$font = New-Object System.Drawing.Font 'Consolas', 15, ([System.Drawing.FontStyle]::Bold)
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$red = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 60, 60)), 3

$i = 0
foreach ($k in $panels.Keys) {
  $y = $M + $i * ($H + $LABEL + $M)
  $og.DrawString($k, $font, $white, [single]$M, [single]$y)
  $py = $y + $LABEL
  $og.DrawImage($panels[$i], [int]$M, [int]$py, [int]$W, [int]$H)
  if ($i -gt 0) {
    # $h would alias $H — PowerShell variable names are case-insensitive.
    foreach ($cell in (Diff-Cells $panels[$i])) {
      $og.DrawRectangle($red, ($M + $cell[1] * $TILE * $ZOOM), ($py + $cell[0] * $TILE * $ZOOM), ($TILE * $ZOOM), ($TILE * $ZOOM))
    }
  }
  $i++
}

$path = Join-Path (Get-DistDir) 'decor-draw-modes.png'
$out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "wrote $path"
foreach ($k in $panels.Keys) { if ($panels[$k] -ne $ref) { Write-Host ("{0} -> {1} differing cells" -f $k, (Diff-Cells $panels[$k]).Count) } }
