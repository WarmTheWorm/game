# Part two of two: packs an asset pack's sprites/ into the single atlas the
# game loads, objects/objects.png and objects/objects.json.
#
# Every sheet in sprites/ is a horizontal strip of frames with a json beside it
# saying how to read it. Nothing here knows what any particular object is, so
# dropping a new sheet and json into the folder is all it takes to add one.
#
# Frames are cropped to their artwork and packed at the resolution they were
# drawn at, which is finer than the size the game shows them at. Everything
# else in the manifest is in the size it's drawn — anchor, collision, slice —
# and a `scale` says how many of those a sheet pixel is worth.
#
#   npm run gen:objects -- -Pack garden
param([string]$Pack = 'garden')
. (Join-Path $PSScriptRoot '_pack.ps1')
Add-Type -AssemblyName System.Drawing

$spr = Get-PackDir $Pack 'sprites'
$dir = Get-PackDir $Pack 'objects'
$TILE = 32

# Bounds of the artwork within a frame, taken across every frame of the sheet
# so they all stay in register once cropped.
function Get-ArtBounds([System.Drawing.Bitmap]$bmp, [int]$fw) {
  $rect = New-Object System.Drawing.Rectangle 0, 0, $bmp.Width, $bmp.Height
  $bits = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $stride = $bits.Stride
  $len = [Math]::Abs($stride) * $bmp.Height
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $buf, 0, $len)
  $bmp.UnlockBits($bits)
  $minX = $fw; $maxX = -1; $minY = $bmp.Height; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    $row = $y * $stride
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($buf[$row + $x * 4 + 3] -eq 0) { continue }
      $lx = $x % $fw
      if ($lx -lt $minX) { $minX = $lx }
      if ($lx -gt $maxX) { $maxX = $lx }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
  return @{ x = $minX; y = $minY; w = ($maxX - $minX + 1); h = ($maxY - $minY + 1) }
}

function Json-Num([double]$v, [int]$digits = 2) {
  $v = [Math]::Round($v, $digits)
  if ($v -eq [Math]::Floor($v)) { return [string][int]$v }
  return $v.ToString([System.Globalization.CultureInfo]::InvariantCulture)
}

# ---------- read the folder ----------
# A sprite is a png and a json of the same name; the name is what levels and
# the game's own code refer to, so it must survive the trip verbatim.
$objects = @()
foreach ($f in Get-ChildItem (Join-Path $spr '*.json') | Sort-Object Name) {
  $name = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  $j = Get-Content $f.FullName -Raw | ConvertFrom-Json
  # A copy is a second object on another's art: no sheet of its own, just the
  # fields that make it behave differently.
  if ($j.copy) {
    $objects += @{ n = $name; copy = [string]$j.copy; col = $j.collision; fall = $j.fall }
    continue
  }
  $png = Join-Path $spr ($name + '.png')
  if (-not (Test-Path $png)) { Write-Warning "$name.json has no $name.png beside it"; continue }
  $fps = 0; if ($null -ne $j.fps) { $fps = [double]$j.fps }
  $slice = 0; if ($null -ne $j.slice) { $slice = [double]$j.slice }
  $objects += @{
    n      = $name
    file   = $png
    frames = [int]$j.frames
    fps    = $fps
    tiles  = [double]$j.tiles
    pivot  = @([double]$j.pivot[0], [double]$j.pivot[1])
    offset = $j.offset
    slice  = $slice
    mask   = $j.mask
    glow   = $j.glow
    parts  = $j.parts
    col    = $j.collision
    fall   = $j.fall
  }
}
if (-not $objects) { throw "no sprites found in $spr" }
$drawn = @($objects | Where-Object { -not $_.copy })

$bitmaps = @{}
$width = 0; $height = 0
foreach ($o in $drawn) {
  $bmp = New-Object System.Drawing.Bitmap($o.file)
  $bitmaps[$o.n] = $bmp
  $o.src = [int]($bmp.Width / $o.frames)
  $o.art = Get-ArtBounds $bmp $o.src
  $o.scale = ($o.tiles * $TILE) / $o.src
}

# A sprite's glow mask is a sheet of its own here, but in the atlas it is the
# sprite's: its frames go on the end of the sprite's strip, and the manifest
# says where with `mask` instead of listing a second object. The two are
# cropped to the bounds of both, so they stay in register whatever the glow
# does around the edges.
foreach ($o in $drawn | Where-Object { $_.mask }) {
  $m = $drawn | Where-Object { $_.n -ceq $o.mask }
  if (-not $m) { throw "$($o.n) names a mask '$($o.mask)' that isn't in the folder" }
  $o.maskObj = $m
  $m.isMask = $true
  $x0 = [Math]::Min($o.art.x, $m.art.x)
  $y0 = [Math]::Min($o.art.y, $m.art.y)
  $x1 = [Math]::Max($o.art.x + $o.art.w, $m.art.x + $m.art.w)
  $y1 = [Math]::Max($o.art.y + $o.art.h, $m.art.y + $m.art.h)
  $union = @{ x = $x0; y = $y0; w = ($x1 - $x0); h = ($y1 - $y0) }
  $o.art = $union
  $m.art = $union
}

$drawn = @($drawn | Where-Object { -not $_.isMask })
foreach ($o in $drawn) {
  $bmp = $bitmaps[$o.n]
  $o.w = [int]$o.art.w
  $o.h = [int]$o.art.h
  # Where the object's own position lands once the transparent margin is gone.
  # For a box that's the box's corner, so a platform is placed by its left end.
  $ax = ($o.pivot[0] * $o.src - $o.art.x) * $o.scale
  $ay = ($o.pivot[1] * $bmp.Height - $o.art.y) * $o.scale
  if ($o.col -and $o.col.shape -eq 'box') { $ax -= $o.col.w / 2 }
  $o.anchor = @([Math]::Round($ax, 2), [Math]::Round($ay, 2))
  $strip = $o.frames
  if ($o.maskObj) {
    $mf = $o.maskObj.frames
    $o.maskSpan = if ($mf -eq 1) { @($o.frames) } else { @($o.frames, ($o.frames + $mf - 1)) }
    $strip += $mf
  }
  $width = [Math]::Max($width, $o.w * $strip)
  $height += $o.h
}

$atlas = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$ag = [System.Drawing.Graphics]::FromImage($atlas)
$ag.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
$ag.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$ag.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
# Each frame is copied on its own, clamped at its edges, so neighbours in the
# source strip can't bleed into one another.
$attr = New-Object System.Drawing.Imaging.ImageAttributes
$attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
$y = 0
foreach ($o in $drawn) {
  $bmp = $bitmaps[$o.n]
  for ($f = 0; $f -lt $o.frames; $f++) {
    $dest = New-Object System.Drawing.Rectangle(($f * $o.w), $y, $o.w, $o.h)
    $ag.DrawImage($bmp, $dest, ($f * $o.src + $o.art.x), $o.art.y, $o.art.w, $o.art.h, [System.Drawing.GraphicsUnit]::Pixel, $attr)
  }
  if ($o.maskObj) {
    $m = $o.maskObj
    $mb = $bitmaps[$m.n]
    for ($f = 0; $f -lt $m.frames; $f++) {
      $dest = New-Object System.Drawing.Rectangle((($o.frames + $f) * $o.w), $y, $o.w, $o.h)
      $ag.DrawImage($mb, $dest, ($f * $m.src + $o.art.x), $o.art.y, $o.art.w, $o.art.h, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    }
  }
  $o.rect = @{ x = 0; y = $y; w = $o.w; h = $o.h }
  $y += $o.h
}
foreach ($b in $bitmaps.Values) { $b.Dispose() }

# Copies point at the rect their source just took, so sharing a sprite costs
# nothing in the sheet: all they own is how they behave.
foreach ($o in $objects | Where-Object { $_.copy }) {
  $src = $drawn | Where-Object { $_.n -ceq $o.copy }
  if (-not $src) { throw "$($o.n) copies '$($o.copy)', which isn't a sheet in the folder" }
  foreach ($k in 'rect', 'frames', 'fps', 'anchor', 'offset', 'scale', 'slice', 'parts', 'maskSpan', 'glow') { $o[$k] = $src[$k] }
  if (-not $o.col) { $o.col = $src.col }
}
# a mask lives in its sprite's strip now, so it is no object of its own
$objects = @($objects | Where-Object { -not $_.isMask })
$attr.Dispose()
$ag.Dispose()
$atlas.Save((Join-Path $dir 'objects.png'), [System.Drawing.Imaging.ImageFormat]::Png)
"  {0,-18} {1}x{2}" -f 'objects.png', $atlas.Width, $atlas.Height
$atlas.Dispose()

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add('{')
$lines.Add('  "texture": "objects.png",')
$lines.Add('  "objects": {')
for ($i = 0; $i -lt $objects.Count; $i++) {
  $o = $objects[$i]
  $parts = New-Object System.Collections.Generic.List[string]
  $r = $o.rect
  $parts.Add(('"frame": {{ "x": {0}, "y": {1}, "w": {2}, "h": {3} }}' -f $r.x, $r.y, $r.w, $r.h))
  $parts.Add(('"frames": {0}' -f $o.frames))
  if ($o.fps -gt 0) { $parts.Add(('"fps": {0}' -f (Json-Num $o.fps))) }
  # world pixels per sheet pixel; the art is packed finer than it is shown, and
  # the sizes derived from this are rounded to the pixel, so it is not
  if ($o.scale -ne 1) { $parts.Add(('"scale": {0}' -f (Json-Num $o.scale 6))) }
  $parts.Add(('"anchor": [{0}, {1}]' -f (Json-Num $o.anchor[0]), (Json-Num $o.anchor[1])))
  # game pixels the object stands off the point its kind spawns at; none is the norm
  if ($o.offset -and ([double]$o.offset[0] -ne 0 -or [double]$o.offset[1] -ne 0)) {
    $parts.Add(('"offset": [{0}, {1}]' -f (Json-Num ([double]$o.offset[0])), (Json-Num ([double]$o.offset[1]))))
  }
  if ($o.parts) {
    $kv = foreach ($p in ($o.parts.PSObject.Properties | Sort-Object Name)) {
      if ($p.Value -is [array]) { '"{0}": [{1}, {2}]' -f $p.Name, $p.Value[0], $p.Value[1] }
      else { '"{0}": {1}' -f $p.Name, $p.Value }
    }
    $parts.Add(('"parts": {{ {0} }}' -f ($kv -join ', ')))
  }
  # authored in source pixels, so it scales with the artwork
  if ($o.slice) { $parts.Add(('"slice": {0}' -f (Json-Num ($o.slice * $o.scale)))) }
  if ($o.maskSpan) {
    $span = if ($o.maskSpan.Count -eq 1) { [string]$o.maskSpan[0] } else { '[{0}, {1}]' -f $o.maskSpan[0], $o.maskSpan[1] }
    $parts.Add(('"mask": {0}' -f $span))
  }
  if ($o.glow) { $parts.Add(('"glow": "{0}"' -f $o.glow)) }
  if ($o.col) {
    $c = $o.col
    # A collision shape is placed inside the sprite, so the game needs nothing
    # but the frame and this to know where everything sits.
    $pos = '"x": {0}, "y": {1}, ' -f (Json-Num $o.anchor[0]), (Json-Num $o.anchor[1])
    if ($c.shape -eq 'circle') { $parts.Add(('"collision": {{ "shape": "circle", {0}"r": {1} }}' -f $pos, (Json-Num $c.r))) }
    elseif ($c.shape -eq 'box') { $parts.Add(('"collision": {{ "shape": "box", {0}"w": {1}, "h": {2} }}' -f $pos, (Json-Num $c.w), (Json-Num $c.h))) }
    else { $parts.Add('"collision": { "shape": "tile" }') }
  }
  if ($o.fall) { $parts.Add(('"fall": {{ "gravity": {0}, "max": {1} }}' -f (Json-Num $o.fall.gravity), (Json-Num $o.fall.max))) }
  $comma = if ($i -lt $objects.Count - 1) { ',' } else { '' }
  $lines.Add(('    "{0}": {{ {1} }}{2}' -f $o.n, ($parts -join ', '), $comma))
}
$lines.Add('  }')
$lines.Add('}')
Set-Content (Join-Path $dir 'objects.json') ($lines -join "`n") -NoNewline -Encoding utf8
"  {0,-18} {1} objects" -f 'objects.json', $objects.Count
