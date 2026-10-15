# Inserts the shared "objects" block into every level file: the manifest each
# level draws from, and which of its objects each map glyph spawns.
$dir = Join-Path $PSScriptRoot '.'
$MANIFEST = '../objects.json'
# Ordinal keys and insertion order, or 'V' and 'v' would collide.
$glyphs = [System.Collections.Specialized.OrderedDictionary]::new([System.StringComparer]::Ordinal)
$glyphs['E'] = @('beetle', 'moth', 'frog')
$glyphs['C'] = @('coin', 'coin2')
$glyphs['G'] = 'gem'
$glyphs['K'] = 'key'
$glyphs['S'] = 'shield'
$glyphs['N'] = 'lantern'
$glyphs['O'] = 'portal'
$glyphs['!'] = 'checkpoint'
$glyphs['V'] = 'plant'
$glyphs['R'] = @('rock', 'rock2')
$glyphs['L'] = 'door'
$glyphs['F'] = 'flag'
$glyphs['M'] = 'sign'
$glyphs['>'] = 'platform'
$glyphs['<'] = 'platform'
$glyphs['^'] = 'platform'
$glyphs['v'] = 'platform'

# Written by hand rather than via ConvertTo-Json so the map stays one glyph
# per line and the map rows below keep their formatting.
function Block-Lines([int]$indent) {
  $pad = ' ' * $indent
  $lines = @("$pad`"objects`": {", "$pad  `"manifest`": `"$MANIFEST`",", "$pad  `"glyphs`": {")
  $keys = @($glyphs.Keys)
  for ($i = 0; $i -lt $keys.Count; $i++) {
    $k = $keys[$i]
    $v = $glyphs[$k]
    $val = if ($v -is [array]) { '[' + (($v | ForEach-Object { '"' + $_ + '"' }) -join ', ') + ']' } else { '"' + $v + '"' }
    $comma = if ($i -lt $keys.Count - 1) { ',' } else { '' }
    $lines += "$pad    `"$k`": $val$comma"
  }
  $lines += "$pad  }"
  $lines += "$pad},"
  return $lines
}

foreach ($file in Get-ChildItem $dir -Filter '*.json') {
  $lines = [System.Collections.Generic.List[string]](Get-Content $file.FullName)

  # drop any block already there, so re-running refreshes rather than skips
  $start = ($lines | Select-String -Pattern '^\s*"objects": \{' | Select-Object -First 1)
  if ($start) {
    $i = $start.LineNumber - 1
    $depth = 0
    do {
      $depth += ([regex]::Matches($lines[$i], '\{')).Count - ([regex]::Matches($lines[$i], '\}')).Count
      $i++
    } while ($depth -gt 0 -and $i -lt $lines.Count)
    $lines.RemoveRange($start.LineNumber - 1, $i - ($start.LineNumber - 1))
  }

  # sits just before "exit" where there is one, else before "map" — an ending
  # level has no exits to anchor on
  $anchor = ($lines | Select-String -Pattern '^\s*"exit":' | Select-Object -First 1)
  if (-not $anchor) { $anchor = ($lines | Select-String -Pattern '^\s*"map":' | Select-Object -First 1) }
  if (-not $anchor) { throw "$($file.Name): no exit or map line to anchor on" }
  $lines.InsertRange($anchor.LineNumber - 1, [string[]](Block-Lines 2))
  Set-Content $file.FullName $lines -Encoding utf8
  Write-Output ("  {0,-20} {1}" -f $file.Name, $(if ($start) { 'objects block refreshed' } else { 'objects block added' }))
}
