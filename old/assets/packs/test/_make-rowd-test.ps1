# Builds two levels that differ only in row_D, so the decor draw mode can be
# compared by walking the flag from one to the other and back.
#
# The sketch is one character per cell; each becomes a [id][glyph][tint] block
# on the main layer, with empty back and front layers around it.

# 24 wide x 11 tall — 11 rows is exactly VIEW_ROWS on a 16:9 window, so the
# camera sits at 0,0 and two screenshots line up pixel for pixel.
$sketch = @(
  '........................'
  '.~~~~~~~.....~~~~~~.....'
  '..TTTTTTTTTTTTTTTTTTTT..'
  '...$*$o$*...............'
  '...BBBBBB...............'
  '........................'
  '.............$o$*$o$....'
  '.............BBBBBBB....'
  '........................'
  '.P..$*o$~*............F.'
  'GGGGGGGGGGGGGGGGGGGGGGGG'
)

$block = @{
  '.' = '...'
  'G' = '1#1'   # brick ground
  'B' = '4#2'   # cobbled platform
  'T' = '.T0'   # tunnel - half-transparent, and a T row despite not colliding
  '$' = '.$0'   # bush   - decor row
  '*' = '.*0'   # flower - decor row
  'o' = '.o0'   # pebble - decor row
  '~' = '.~0'   # cloud  - decor row, the only one that really uses its margin
  'P' = '0P0'
  'F' = '0F0'
}

$map = @()
foreach ($row in $sketch) {
  if ($row.Length -ne $sketch[0].Length) { throw "sketch row '$row' is $($row.Length) wide, expected $($sketch[0].Length)" }
  $mid = ''
  foreach ($ch in $row.ToCharArray()) {
    $key = [string]$ch
    if (-not $block.ContainsKey($key)) { throw "sketch uses '$key', which has no block" }
    $mid += $block[$key]
  }
  $blank = '.' * ($row.Length * 3)
  $map += $blank, $mid, $blank
}
$lines = ($map | ForEach-Object { '    "' + $_ + '"' }) -join ",`n"

function Write-Level([string]$File, [string]$Name, [string]$RowD, [string]$Exit, [string]$Msg) {
  $json = @"
{
  "name": "$Name",
  "background": "#1d3b63",
  "tileset": { "row_D": "$RowD" },
  "exit": ["$Exit"],
  "messages": ["$Msg"],
  "map": [
$lines
  ]
}
"@
  $path = Join-Path $PSScriptRoot $File
  Set-Content -Path $path -Value $json -Encoding utf8NoBOM
  "wrote $path"
}

Write-Level 'rowd-decor.json' 'row_D with D - correct' 'TTTTTTTTTTTTTTTTDDDD' 'rowd-allt.json' `
  'Decor rows draw their whole padded cell, so the cloud bank joins up and the scenery lies over the ground. Take the flag to see the same level with row_D set to all T.'

Write-Level 'rowd-allt.json' 'row_D all T - clipped' 'TTTTTTTTTTTTTTTTTTTT' 'rowd-decor.json' `
  'Every row is cropped to its own tile now. The clouds are cut apart at the cell joins and anything that reached past 32 units is gone. The flag goes back.'
