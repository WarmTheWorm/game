# Folds the game page and every script it names into one standalone HTML file
# in the editor's folder. That file is what a downloaded pack ships as its
# index.html, so a pack carries one page rather than the engine's two dozen
# files — and the editor needs no list of its own, since the page names its
# scripts and this reads them from there.
#
#   pwsh -NoProfile -File assets\editor\_bundle.ps1
$ErrorActionPreference = 'Stop'

# where a pack writes the paths of its own copies, replacing this line
$MARKER = '<!-- pack roots -->'

$game = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$pageFile = Join-Path $game 'warm-worm-game.html'
$page = Get-Content $pageFile -Raw

$found = [regex]::Matches($page, '<script src="([^"]+)"></script>')
if ($found.Count -eq 0) { throw 'the page names no scripts — has its markup changed?' }

$out = New-Object System.Text.StringBuilder
$at = 0
$bytes = 0
foreach ($match in $found) {
  [void]$out.Append($page.Substring($at, $match.Index - $at))
  if ($at -eq 0) { [void]$out.Append("$MARKER`r`n") }

  $src = $match.Groups[1].Value
  $path = Join-Path $game $src
  if (-not (Test-Path $path)) { throw "$src is named by the page but is not there" }
  $code = Get-Content $path -Raw
  # the first one of these inside the code would end the block early
  if ($code -match '</script') { throw "$src contains </script and cannot be inlined" }

  [void]$out.Append("<!-- $src -->`r`n<script>`r`n$code`r`n</script>")
  $bytes += $code.Length
  $at = $match.Index + $match.Length
}
[void]$out.Append($page.Substring($at))

$dest = Join-Path $PSScriptRoot 'game.html'
Set-Content $dest $out.ToString() -NoNewline -Encoding UTF8
"{0,-24} {1} scripts inlined ({2:N0} bytes of code), {3:N0} bytes total" -f 'game.html', $found.Count, $bytes, (Get-Item $dest).Length
