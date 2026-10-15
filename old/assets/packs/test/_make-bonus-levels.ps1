# Writes bonus-hub.json, bonus-room.json, bonus-room-2.json and lantern.json
# from the one-char-per-cell sketches below, so the 3x3 blocks can't drift out
# of alignment by hand.
#   P          her start
#   0 1 2 3 4  the level's 1st..5th flag, which picks the 1st..5th exit
#   i j k l    signpost showing the level's 1st..4th message
#   C c G      coin, the second coin variant, gem
#   e m        beetle, moth
#   T u b      lantern: full light (0N0), big light (1N0), small light (2N0)
#   # .        terrain, empty
#
# Each level names its own background — a flat colour, or a colour with one of
# the sprites from _make-backgrounds.ps1 tiled over it.
#
# The hub's first three flags are round trips: all three lead to the same
# bonus room, which leads on to a second one. Only the hub is ever pushed, so
# the last room's flag — which has no exit behind it — unwinds the whole trip
# and drops her back out of whichever hub flag she dived into, with the hub
# exactly as she left it.

$hub = @(
  '#################################################',
  '#...............................................#',
  '#.........CCC...................CCC.............#',
  '#.........###...................###.............#',
  '#...............................................#',
  '#.....e..........G.....m.......G.........e......#',
  '#...######....#####..........#####.....######...#',
  '#...............................................#',
  '#....CcC..........CcC.............CcC...........#',
  '#...#####........#####...........#####..........#',
  '#.......................4.......................#',
  '#......................#####....................#',
  '#.....0.............1..............2........3...#',
  '#...#####.........#####..........#####....#####.#',
  '#...............................................#',
  '#.P.i.................j..l..............k.......#',
  '#################################################'
)

$room = @(
  '###############################',
  '#.............................#',
  '#....G....G....G....G....G....#',
  '#.............................#',
  '#...#####...........#####.....#',
  '#.............................#',
  '#......CcCcCcCcCcCcCcC........#',
  '#....#####################....#',
  '#.............................#',
  '#.............................#',
  '#.P......i.................0..#',
  '###############################'
)

$room2 = @(
  '###########################',
  '#.........................#',
  '#....G...............G....#',
  '#...###.............###...#',
  '#.........................#',
  '#.......CcCcCcCcC.........#',
  '#......###########........#',
  '#.........................#',
  '#..G...................G..#',
  '#.P..i......0.............#',
  '###########################'
)

# Three lamps, left to right: full light, a big one, a small one. Whichever
# she picked up last is the one she is seeing by — and the level's "pick" list
# starts her on the big one.
$lantern = @(
  '#############################################',
  '#...........................................#',
  '#....C.C.C......G.........C.C.C......G......#',
  '#...#######....####......#######....####....#',
  '#...........................................#',
  '#.......e..........m.............e..........#',
  '#...#########............#########..........#',
  '#...........................................#',
  '#.....C.c.C.......G.........C.c.C......G....#',
  '#....#######.....####......#######....###...#',
  '#...........................................#',
  '#.P.i...T.........u.........b.....j.....0...#',
  '#############################################'
)

# block = id, glyph, tint. Terrain repeats into all three layers; everything
# else sits on the main layer alone. Ordinal keys, or 'c' and 'C' collide.
$cells = [System.Collections.Hashtable]::new([System.StringComparer]::Ordinal)
$cells['#'] = @{ block = '0#2'; terrain = $true }
$cells['.'] = @{ block = '...'; terrain = $true }
$cells['P'] = @{ block = '0P0' }
$cells['0'] = @{ block = '0F0' }
$cells['1'] = @{ block = '1F0' }
$cells['2'] = @{ block = '2F0' }
$cells['3'] = @{ block = '3F0' }
$cells['4'] = @{ block = '4F0' }
$cells['i'] = @{ block = '0M0' }
$cells['j'] = @{ block = '1M0' }
$cells['k'] = @{ block = '2M0' }
$cells['l'] = @{ block = '3M0' }
$cells['C'] = @{ block = '0C0' }
$cells['c'] = @{ block = '1C0' }
$cells['G'] = @{ block = '0G0' }
$cells['T'] = @{ block = '0N0' }
$cells['u'] = @{ block = '1N0' }
$cells['b'] = @{ block = '2N0' }
$cells['e'] = @{ block = '0E0' }
$cells['m'] = @{ block = '1E0' }

function Expand-Sketch($sketch) {
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
  return , $map
}

$toRoom = [ordered]@{ to = 'bonus-room.json'; 'return' = $true }
$toLantern = [ordered]@{ to = 'lantern.json'; 'return' = $true }

$hubLevel = [ordered]@{
  name       = 'Bonus Hub'
  background = '#2b1d4a'
  exit       = @($toRoom, $toRoom, $toRoom, '../garden/levelpack.json', $toLantern)
  messages   = @(
    'All three flags on the platforms lead to the same bonus room — and whichever one you dive into is the one you climb back out of.'
    'Nothing here is lost while you are away. Collect what you like, drop into the room, and this level comes back exactly as you left it.'
    'The flag on the far right is the way on to the garden.'
    'The flag up on the high ledge leads to a room with a lantern in it. Take the lantern and you will see why it is worth the climb back.'
  )
  map        = (Expand-Sketch $hub)
}

$roomLevel = [ordered]@{
  name       = 'Bonus Room'
  background = [ordered]@{ color = '#0b0718'; texture = 'bg-stars.png'; scroll = 0.2 }
  exit       = @('bonus-room-2.json')
  messages   = @(
    'This room has no idea where you came from, and the flag here only goes deeper — one more room before the way back.'
  )
  map        = (Expand-Sketch $room)
}

$room2Level = [ordered]@{
  name       = 'Deep Room'
  background = [ordered]@{ color = '#3a2418'; texture = 'bg-bricks.png'; scroll = 0.6 }
  messages   = @(
    'Nothing down here has an exit behind it either, so this flag unwinds the whole trip at once and puts you back on the hub flag you first dived into.'
  )
  map        = (Expand-Sketch $room2)
}

$lanternLevel = [ordered]@{
  name       = 'Lantern Room'
  background = [ordered]@{ color = '#121a2a'; texture = 'bg-stars.png'; scroll = 0.15 }
  pick       = @('1N0')
  messages   = @(
    'This room opens with the small lamp already lit — that is the "pick" list in its level file, not anything you did.'
    'The three lanterns on the floor are full light, a small light and a big one. The one you picked up last is the one you see by.'
  )
  map        = (Expand-Sketch $lantern)
}

$dir = $PSScriptRoot
Set-Content (Join-Path $dir 'bonus-hub.json')    ($hubLevel     | ConvertTo-Json -Depth 5) -Encoding utf8
Set-Content (Join-Path $dir 'bonus-room.json')   ($roomLevel    | ConvertTo-Json -Depth 5) -Encoding utf8
Set-Content (Join-Path $dir 'bonus-room-2.json') ($room2Level   | ConvertTo-Json -Depth 5) -Encoding utf8
Set-Content (Join-Path $dir 'lantern.json')      ($lanternLevel | ConvertTo-Json -Depth 5) -Encoding utf8
"bonus-hub.json    {0} x {1}" -f $hub[0].Length, $hub.Count
"bonus-room.json   {0} x {1}" -f $room[0].Length, $room.Count
"bonus-room-2.json {0} x {1}" -f $room2[0].Length, $room2.Count
"lantern.json      {0} x {1}" -f $lantern[0].Length, $lantern.Count
