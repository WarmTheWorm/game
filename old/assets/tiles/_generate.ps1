# Renders every static tile and decoration into one atlas PNG.
#
# The sheet is a labelled grid: a header row across the top naming each tint
# digit, a header column down the left naming each type ('0#'..'9#' then one
# row per glyph), and the cells themselves starting one cell in from both.
# A label reads the same way a map block does — data digit, then glyph — so
# row '3#' column '1' is the cell a block '3#1' draws.
# A cell is 80x80 and holds a 32px tile drawn at 2x — 64px — inset by the 4px
# margin that decor art overhangs into.
#
# Column 0 is the art's own colour; columns 1-9 are recoloured by hue and
# saturation while keeping the art's luminosity, so cracks, mortar and
# highlights survive the tint.
param([string]$Out = $PSScriptRoot)

Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
public static class Tinter {
  static void ToHsl(double r, double g, double b, out double h, out double s, out double l) {
    double max = System.Math.Max(r, System.Math.Max(g, b));
    double min = System.Math.Min(r, System.Math.Min(g, b));
    l = (max + min) / 2.0;
    if (max == min) { h = 0; s = 0; return; }
    double d = max - min;
    s = l > 0.5 ? d / (2.0 - max - min) : d / (max + min);
    if (max == r) h = (g - b) / d + (g < b ? 6.0 : 0.0);
    else if (max == g) h = (b - r) / d + 2.0;
    else h = (r - g) / d + 4.0;
    h /= 6.0;
  }
  static double Hue(double p, double q, double t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0 / 2.0) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
  }
  static void ToRgb(double h, double s, double l, out double r, out double g, out double b) {
    if (s == 0) { r = l; g = l; b = l; return; }
    double q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    double p = 2 * l - q;
    r = Hue(p, q, h + 1.0 / 3.0);
    g = Hue(p, q, h);
    b = Hue(p, q, h - 1.0 / 3.0);
  }
  static byte Pack(double v) {
    v = v * 255.0 + 0.5;
    if (v < 0) v = 0;
    if (v > 255) v = 255;
    return (byte)v;
  }
  public static void Apply(byte[] px, double tr, double tg, double tb, double lift) {
    double th, ts, tl;
    ToHsl(tr, tg, tb, out th, out ts, out tl);
    for (int i = 0; i < px.Length; i += 4) {
      if (px[i + 3] == 0) continue;            // leave fully transparent pixels alone
      double b = px[i] / 255.0, g = px[i + 1] / 255.0, r = px[i + 2] / 255.0;
      double h, s, l;
      ToHsl(r, g, b, out h, out s, out l);
      double nr, ng, nb;
      ToRgb(th, ts, l, out nr, out ng, out nb);
      px[i]     = Pack(nb * (1 - lift) + tb * lift);
      px[i + 1] = Pack(ng * (1 - lift) + tg * lift);
      px[i + 2] = Pack(nr * (1 - lift) + tr * lift);
    }
  }
}
'@

$S = 2                      # supersample factor: a 32px tile is drawn at 64px
$TILE = 32
$PAD = 4                    # decor overhang margin, in tile units
$CELLPX = ($TILE + $PAD * 2) * $S
$GUTTER = $CELLPX           # width of the label column / height of the label row
$LIFT = 0.22                # flat tint blended over the recolour
$TILEPX = $TILE * $S        # 64 — the tile's own pixels inside the cell
$INSET = $PAD * $S          # 8  — where the tile starts in the cell

# Digit 0-9 for the third character of a block. 0 keeps the art's own colour.
$TINTS = @(
  $null,        # 0  natural (green for the solid blocks)
  '#8a5a35',    # 1  brown
  '#8a8a92',    # 2  stone grey
  '#d1452f',    # 3  red
  '#e08a2e',    # 4  orange
  '#e0c92e',    # 5  yellow
  '#2ec4c4',    # 6  cyan
  '#3a7fd1',    # 7  blue
  '#8a4fd1',    # 8  purple
  '#d14f9e'     # 9  pink
)

function C([int]$a, [string]$hex) {
  [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($hex.Substring(1, 2), 16), [Convert]::ToInt32($hex.Substring(3, 2), 16), [Convert]::ToInt32($hex.Substring(5, 2), 16))
}
function B([int]$a, [string]$hex) { New-Object System.Drawing.SolidBrush (C $a $hex) }
function P([int]$a, [string]$hex, [double]$w) { New-Object System.Drawing.Pen ((C $a $hex), [single]$w) }
function Pt([double]$x, [double]$y) { New-Object System.Drawing.PointF ([single]$x, [single]$y) }
function L($g, $pen, [double]$x1, [double]$y1, [double]$x2, [double]$y2) {
  $g.DrawLine($pen, [single]$x1, [single]$y1, [single]$x2, [single]$y2)
}
function Dot($g, $brush, [double]$cx, [double]$cy, [double]$r) {
  $g.FillEllipse($brush, [single]($cx - $r), [single]($cy - $r), [single]($r * 2), [single]($r * 2))
}

# A blank cell whose user-space origin is the tile's top-left corner, so tile
# art works in 0..32 and decor may overhang into -4..36.
# PixelOffsetMode::Half makes a coordinate name a pixel edge rather than a pixel
# centre; without it an integer-aligned 64px fill lands on 65 pixels, half-covered
# at both ends, and every tile leaks a fringe into the margin.
function New-Cell {
  $bmp = New-Object System.Drawing.Bitmap($CELLPX, $CELLPX, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.TranslateTransform($PAD * $S, $PAD * $S)
  $g.ScaleTransform($S, $S)
  return @{ bmp = $bmp; g = $g }
}

# Erases the margin, so nothing at all sits between one tile and the next.
# A 'T' row is cropped to its own 64px square anyway, and antialiasing on an
# outline drawn at the cell edge would otherwise leave a fringe out there.
# Decor rows skip this — their margin is art.
function Clear-Gutter($bmp) {
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $none = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
  $far = $INSET + $TILEPX
  $g.FillRectangle($none, 0, 0, $CELLPX, $INSET)                      # top
  $g.FillRectangle($none, 0, $far, $CELLPX, $INSET)                   # bottom
  $g.FillRectangle($none, 0, $INSET, $INSET, $TILEPX)                 # left
  $g.FillRectangle($none, $far, $INSET, $INSET, $TILEPX)              # right
  $none.Dispose()
  $g.Dispose()
}

# A row's optional `d0` block, drawn over a copy of its cell for the untinted
# column alone — so column 0 can carry a marker the nine tinted copies lack.
function Copy-Marked($src, $draw) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
  $copy = $src.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($copy)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.TranslateTransform($PAD * $S, $PAD * $S)
  $g.ScaleTransform($S, $S)
  & $draw $g
  $g.Dispose()
  return $copy
}

function Copy-Tinted($src, [string]$hex) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, $src.Height
  $copy = $src.Clone($rect, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $bits = $copy.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $len = [Math]::Abs($bits.Stride) * $copy.Height
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $buf, 0, $len)
  $c = C 255 $hex
  [Tinter]::Apply($buf, ($c.R / 255.0), ($c.G / 255.0), ($c.B / 255.0), $LIFT)
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $bits.Scan0, $len)
  $copy.UnlockBits($bits)
  return $copy
}

# The slab every '#' look is built on, and the outline that closes it.
function Slab($g, [string]$hex) {
  $g.FillRectangle((B 255 $hex), 0, 0, $TILE, $TILE)
  $g.FillRectangle((B 46 '#ffffff'), 0, 0, $TILE, 5)
  $g.SetClip([System.Drawing.RectangleF]::new(0, 0, $TILE, $TILE))
}
function SlabEdge($g) {
  $g.ResetClip()
  $g.DrawRectangle((P 20 '#000000' 1), 0.5, 0.5, $TILE - 1, $TILE - 1)
}

# Row order is the atlas layout. Rows 0-9 are the ten '#' looks, so a block's
# data digit is its row directly; the rest are one row per glyph.
$types = @(
  @{ n = '0  # plain'; g = '0#'; d = {
      param($g) Slab $g '#6fb84f'; SlabEdge $g } }

  @{ n = '1  # brick'; g = '1#'; d = {
      param($g) Slab $g '#6fb84f'
      $m = P 38 '#000000' 1
      L $g $m 0 10.5 $TILE 10.5
      L $g $m 0 21.5 $TILE 21.5
      L $g $m 16.5 0 16.5 10.5
      L $g $m 8.5 10.5 8.5 21.5
      L $g $m 24.5 10.5 24.5 21.5
      L $g $m 16.5 21.5 16.5 $TILE
      SlabEdge $g } }

  @{ n = '2  # cracked'; g = '2#'; d = {
      param($g) Slab $g '#6fb84f'
      $k = P 55 '#000000' 1.2
      $g.DrawLines($k, [System.Drawing.PointF[]]@((Pt 7 0), (Pt 12 8), (Pt 8 16), (Pt 14 24), (Pt 11 $TILE)))
      L $g $k 12 8 20 11
      L $g $k 14 24 22 27
      SlabEdge $g } }

  @{ n = '3  # mossy'; g = '3#'; d = {
      param($g) Slab $g '#6fb84f'
      $m = B 90 '#2f6b2a'
      Dot $g $m 7 9 5
      Dot $g $m 12 12 3.5
      Dot $g $m 23 20 5.5
      Dot $g $m 18 25 3
      Dot $g $m 28 8 3.5
      SlabEdge $g } }

  @{ n = '4  # cobbles'; g = '4#'; d = {
      param($g) Slab $g '#6fb84f'
      $e = P 45 '#000000' 1
      $f = B 30 '#ffffff'
      foreach ($p in @(@(2, 2), @(17, 2), @(2, 17), @(17, 17))) {
        $g.FillEllipse($f, [single]$p[0], [single]$p[1], [single]13, [single]13)
        $g.DrawEllipse($e, [single]$p[0], [single]$p[1], [single]13, [single]13)
      }
      SlabEdge $g } }

  @{ n = '5  # riveted'; g = '5#'; d = {
      param($g) Slab $g '#6fb84f'
      $r = B 70 '#000000'
      $s = B 90 '#ffffff'
      foreach ($p in @(@(6, 7), @(26, 7), @(6, 26), @(26, 26))) {
        Dot $g $r $p[0] ($p[1] + 1) 2.4
        Dot $g $s $p[0] $p[1] 2.2
      }
      SlabEdge $g } }

  @{ n = '6  # hatched'; g = '6#'; d = {
      param($g) Slab $g '#6fb84f'
      $h = P 26 '#000000' 1
      for ($i = -$TILE; $i -lt $TILE; $i += 7) { L $g $h $i 0 ($i + $TILE) $TILE }
      SlabEdge $g } }

  @{ n = '7  # chipped'; g = '7#'; d = {
      param($g) Slab $g '#6fb84f'
      $c = B 42 '#000000'
      $g.FillPolygon($c, [System.Drawing.PointF[]]@((Pt $TILE 0), (Pt $TILE 6), (Pt ($TILE - 7) 0)))
      $g.FillPolygon($c, [System.Drawing.PointF[]]@((Pt 0 $TILE), (Pt 7 $TILE), (Pt 0 ($TILE - 6))))
      $g.FillPolygon($c, [System.Drawing.PointF[]]@((Pt $TILE 18), (Pt ($TILE - 5) 22), (Pt $TILE 26)))
      SlabEdge $g } }

  @{ n = '8  # gravel'; g = '8#'; d = {
      param($g) Slab $g '#6fb84f'
      $k = B 48 '#000000'
      $w = B 55 '#ffffff'
      foreach ($p in @(@(4, 9), @(11, 14), @(19, 7), @(26, 13), @(7, 23), @(15, 28), @(23, 21), @(29, 27), @(13, 20), @(21, 30))) {
        Dot $g $k $p[0] $p[1] 1.8
        Dot $g $w ($p[0] - 0.6) ($p[1] - 0.8) 0.9
      }
      SlabEdge $g } }

  @{ n = '9  # planks'; g = '9#'; d = {
      param($g) Slab $g '#6fb84f'
      $o = P 34 '#000000' 1
      $s = P 30 '#ffffff' 1
      foreach ($x in 8.5, 16.5, 24.5) {
        L $g $o $x 0 $x $TILE
        L $g $s ($x + 1) 0 ($x + 1) $TILE
      }
      SlabEdge $g } }

  # The four ramp directions are which corner the solid right angle sits in.
  @{ n = '10 /0 ramp lower-right'; g = '0/'; d = {
      param($g)
      $tri = [System.Drawing.PointF[]]@((Pt 0 $TILE), (Pt $TILE $TILE), (Pt $TILE 0))
      $g.FillPolygon((B 255 '#6fb84f'), $tri)
      $g.DrawPolygon((P 38 '#000000' 1), $tri) } }

  @{ n = '11 /1 ramp lower-left'; g = '1/'; d = {
      param($g)
      $tri = [System.Drawing.PointF[]]@((Pt 0 0), (Pt 0 $TILE), (Pt $TILE $TILE))
      $g.FillPolygon((B 255 '#6fb84f'), $tri)
      $g.DrawPolygon((P 38 '#000000' 1), $tri) } }

  @{ n = '12 /2 ramp upper-right'; g = '2/'; d = {
      param($g)
      $tri = [System.Drawing.PointF[]]@((Pt 0 0), (Pt $TILE 0), (Pt $TILE $TILE))
      $g.FillPolygon((B 255 '#6fb84f'), $tri)
      $g.DrawPolygon((P 38 '#000000' 1), $tri) } }

  @{ n = '13 /3 ramp upper-left'; g = '3/'; d = {
      param($g)
      $tri = [System.Drawing.PointF[]]@((Pt 0 0), (Pt $TILE 0), (Pt 0 $TILE))
      $g.FillPolygon((B 255 '#6fb84f'), $tri)
      $g.DrawPolygon((P 38 '#000000' 1), $tri) } }

  @{ n = '14 T tunnel'; g = 'T'; d = {
      param($g)
      $g.FillRectangle((B 128 '#8a5a35'), 0, 0, $TILE, $TILE)
      $g.DrawRectangle((P 40 '#000000' 1), 0.5, 0.5, $TILE - 1, $TILE - 1) }
    d0 = {
      param($g) Dot $g (B 255 '#1b1b22') ($TILE / 2) ($TILE / 2) 9 } }

  @{ n = '15 U low ceiling'; g = 'U'; d = {
      param($g)
      $h = $TILE / 2
      $g.FillRectangle((B 255 '#7a6a72'), 0, 0, $TILE, $h)
      $g.DrawRectangle((P 255 '#453b40' 1.5), 0.75, 0.75, $TILE - 1.5, $h - 0.75)
      $tw = $TILE / 3
      foreach ($i in 0..2) {
        $g.FillPolygon((B 255 '#5c4f56'), @((Pt ($i * $tw) $h), (Pt ($i * $tw + $tw / 2) ($h + 7)), (Pt ($i * $tw + $tw) $h)))
      } } }

  @{ n = '16 * flower'; g = '*'; decor = $true; d = {
      param($g)
      $cx = $TILE / 2
      $fy = $TILE - 6
      L $g (P 255 '#3c6d29' 2) $cx $fy $cx ($fy - 8)
      foreach ($i in 0..3) {
        $a = ($i / 4.0) * [Math]::PI * 2
        Dot $g (B 255 '#ff9dd6') ($cx + [Math]::Cos($a) * 4) ($fy - 8 + [Math]::Sin($a) * 4) 3
      }
      Dot $g (B 255 '#ffd35a') $cx ($fy - 8) 2.3 } }

  @{ n = '17 o pebble'; g = 'o'; decor = $true; d = {
      param($g)
      $cx = $TILE / 2
      $ry = $TILE - 6
      $g.FillEllipse((B 255 '#8a8a92'), ($cx - 9), ($ry - 6), 18, 12)
      $g.DrawEllipse((P 51 '#000000' 1), ($cx - 9), ($ry - 6), 18, 12)
      $g.FillEllipse((B 64 '#ffffff'), ($cx - 5.5), ($ry - 3.5), 5, 3) } }

  @{ n = '18 $ bush'; g = '$'; decor = $true; d = {
      param($g)
      $cx = $TILE / 2
      $by = $TILE - 4
      $g.FillEllipse((B 255 '#3f8f3f'), ($cx - 14), ($by - 13), 14, 14)
      $g.FillEllipse((B 255 '#3f8f3f'), $cx, ($by - 13), 14, 14)
      $g.FillEllipse((B 255 '#3f8f3f'), ($cx - 8), ($by - 19), 16, 16)
      $g.DrawEllipse((P 255 '#245c24' 1), ($cx - 8), ($by - 19), 16, 16) } }

  @{ n = '19 ~ cloud'; g = '~'; decor = $true; d = {
      param($g)
      $cx = $TILE / 2
      $cy = $TILE / 2
      $g.FillEllipse((B 140 '#ffffff'), ($cx - 17), ($cy - 6), 18, 12)
      $g.FillEllipse((B 140 '#ffffff'), ($cx - 1), ($cy - 6), 18, 12)
      $g.FillEllipse((B 140 '#ffffff'), ($cx - 10), ($cy - 11), 20, 14) } }
)

$atlas = New-Object System.Drawing.Bitmap(($GUTTER + $CELLPX * $TINTS.Count), ($GUTTER + $CELLPX * $types.Count), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ag = [System.Drawing.Graphics]::FromImage($atlas)
$ag.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy

for ($row = 0; $row -lt $types.Count; $row++) {
  $src = New-Cell
  & $types[$row].d $src.g
  $src.g.Dispose()
  if (-not $types[$row].decor) { Clear-Gutter $src.bmp }
  for ($ti = 0; $ti -lt $TINTS.Count; $ti++) {
    $x = $GUTTER + $ti * $CELLPX
    $y = $GUTTER + $row * $CELLPX
    if ($null -eq $TINTS[$ti]) {
      if ($types[$row].d0) {
        $marked = Copy-Marked $src.bmp $types[$row].d0
        $ag.DrawImage($marked, $x, $y)
        $marked.Dispose()
      } else {
        $ag.DrawImage($src.bmp, $x, $y)
      }
    } else {
      $tinted = Copy-Tinted $src.bmp $TINTS[$ti]
      $ag.DrawImage($tinted, $x, $y)
      $tinted.Dispose()
    }
  }
  $src.bmp.Dispose()
  "  row {0,2}  {1}" -f $row, $types[$row].n
}

# Header strips: the tint digit across the top, the type's ASCII name down
# the left, so the sheet reads as its own legend.
$ag.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$ag.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$ag.FillRectangle((B 255 '#1b1b22'), 0, 0, $atlas.Width, $GUTTER)
$ag.FillRectangle((B 255 '#1b1b22'), 0, 0, $GUTTER, $atlas.Height)
$font = New-Object System.Drawing.Font 'Consolas', 26, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$ink = B 255 '#f2f2f7'
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = [System.Drawing.StringAlignment]::Center
$fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

for ($ti = 0; $ti -lt $TINTS.Count; $ti++) {
  $box = New-Object System.Drawing.RectangleF ($GUTTER + $ti * $CELLPX), 0, $CELLPX, $GUTTER
  $ag.DrawString([string]$ti, $font, $ink, $box, $fmt)
}
for ($row = 0; $row -lt $types.Count; $row++) {
  $box = New-Object System.Drawing.RectangleF 0, ($GUTTER + $row * $CELLPX), $GUTTER, $CELLPX
  $ag.DrawString($types[$row].g, $font, $ink, $box, $fmt)
}

$ag.Dispose()
$path = Join-Path $Out 'tiles.png'
$atlas.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
"{0}  ({1}x{2}, {3}px tiles)" -f $path, $atlas.Width, $atlas.Height, ($TILE * $S)
$atlas.Dispose()
