# Writes test-enemies.json from the one-char-per-cell sketch below, so the
# 3x3 blocks can't drift out of alignment by hand.
#   b/m/f  beetle, moth, frog (the three enemy kinds)
#   P F C G S !  start, finish, coin, gem, shield, checkpoint
#   c      the second coin variant, '1C0' rather than '0C0'
#   V      carnivorous plant, lunges when she jumps over it
#   R r    falling-rock source; 'r' is the slower second rock, same sprite
#   > ^    moving platform, horizontal and vertical
#   x      travel stop for a moving platform, drawn as nothing
#   1 2 3  signpost showing the level's 1st, 2nd or 3rd message
$sketch = @(
  '###########################################',
  '#.........R.............r.................#',
  '#..m.......m..........m.......m...........#',
  '#.........................................#',
  '#..b....b...............b.....b...........#',
  '#.#######...............#######...........#',
  '#..............................x..........#',
  '#.........................................#',
  '#....###...................###............#',
  '#.......x..>....x..............^..........#',
  '#.........................................#',
  '#..............###...........###..........#',
  '#....C....G....c.....S....c......!..C.....#',
  '#.........................................#',
  '#.......###..........###.........###......#',
  '#.........................................#',
  '#.........................................#',
  '#.P.1..V....f....2...f.....V....f....3..F.#',
  '###########################################'
)

# block = id, glyph, tint. Terrain repeats into all three layers; everything
# else sits on the main layer alone. Ordinal keys, or 'f' and 'F' collide.
$cells = [System.Collections.Hashtable]::new([System.StringComparer]::Ordinal)
$cells['#'] = @{ block = '0#2'; terrain = $true }
$cells['.'] = @{ block = '...'; terrain = $true }
$cells['b'] = @{ block = '0E0' }
$cells['m'] = @{ block = '1E0' }
$cells['f'] = @{ block = '2E0' }
$cells['P'] = @{ block = '0P0' }
$cells['F'] = @{ block = '0F0' }
$cells['C'] = @{ block = '0C0' }
$cells['c'] = @{ block = '1C0' }
$cells['G'] = @{ block = '0G0' }
$cells['S'] = @{ block = '0S0' }
$cells['!'] = @{ block = '0!0' }
$cells['>'] = @{ block = '0>0' }
$cells['^'] = @{ block = '0^0' }
$cells['x'] = @{ block = '0x0' }
$cells['V'] = @{ block = '0V0' }
$cells['R'] = @{ block = '0R0' }
$cells['r'] = @{ block = '1R0' }
$cells['1'] = @{ block = '0M0' }
$cells['2'] = @{ block = '1M0' }
$cells['3'] = @{ block = '2M0' }

$width = ($sketch | Measure-Object -Property Length -Maximum).Maximum
foreach ($row in $sketch) {
  if ($row.Length -ne $width) { throw "ragged sketch: '$row' is $($row.Length), expected $width" }
}

$map = New-Object System.Collections.Generic.List[string]
foreach ($row in $sketch) {
  $back = ''; $main = ''; $front = ''
  foreach ($ch in $row.ToCharArray()) {
    $cell = $cells[[string]$ch]
    if (-not $cell) { throw "no cell defined for '$ch'" }
    $main += $cell.block
    if ($cell.terrain) { $back += $cell.block; $front += $cell.block }
    else { $back += '...'; $front += '...' }
  }
  $map.Add($back); $map.Add($main); $map.Add($front)
}

$level = [ordered]@{
  name    = 'Enemy Test'
  tileset = [ordered]@{
    texture = '../tiles/tiles.png'
    size    = 64
    row_0   = '01234567890123      '
    row_1   = '##########////TU*o$~'
    row_C   = 'SSSSSSSSSS0123 ^    '
    col_0   = '0123456789'
  }
  exit    = @('rootgame.json')
  messages = @(
    'Arrows or A/D to move, Space to jump. Press it again in the air for a second jump.'
    'Mind the plants and the falling rocks — a shield takes one hit for you.'
    'The flag ahead is the way out. Touch it and the worm dives through.'
  )
  map     = $map
}

$json = $level | ConvertTo-Json -Depth 5
Set-Content (Join-Path $PSScriptRoot 'test-enemies.json') $json -Encoding utf8
& (Join-Path $PSScriptRoot '_add-object-map.ps1') | Out-Null
"test-enemies.json  {0} cols x {1} rows" -f $width, $sketch.Count
