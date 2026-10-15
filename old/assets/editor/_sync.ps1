# The editor's folder is meant to stand on its own, so it keeps its own copy of
# the sheet, the object manifest, the sound library and the game itself rather
# than reaching into the game's assets. Run this after regenerating any of them
# to bring the copies up to date.
#
#   pwsh -NoProfile -File assets\editor\_sync.ps1
$ErrorActionPreference = 'Stop'

$game = Resolve-Path (Join-Path $PSScriptRoot '..')
$pairs = @(
  @{ From = 'tiles\tiles.png';    To = 'tiles\tiles.png' },
  @{ From = 'objects.json';       To = 'objects\objects.json' },
  @{ From = 'objects.png';        To = 'objects\objects.png' },
  @{ From = 'sounds\sounds.json'; To = 'sounds\default.json' }
)

foreach ($pair in $pairs) {
  $src = Join-Path $game $pair.From
  $dst = Join-Path $PSScriptRoot $pair.To
  New-Item -ItemType Directory -Force -Path (Split-Path $dst) | Out-Null
  Copy-Item $src $dst -Force
  "{0,-24} <- {1} ({2:N0} bytes)" -f $pair.To, $pair.From, (Get-Item $dst).Length
}

# Whole folders, because a sound def's `src` is relative to its manifest: the
# copies have to sit under it exactly as the originals sit under sounds.json.
foreach ($folder in 'sounds\music', 'sounds\clips') {
  $dst = Join-Path $PSScriptRoot $folder
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  # the path has to end in a wildcard or -Exclude matches the folder, not its contents
  Get-ChildItem (Join-Path $game "$folder\*") -File -Exclude '_*' | ForEach-Object {
    Copy-Item $_.FullName (Join-Path $dst $_.Name) -Force
    "{0,-28} <- {1} ({2:N0} bytes)" -f "$folder\$($_.Name)", "$folder\$($_.Name)", $_.Length
  }
}

& (Join-Path $PSScriptRoot '_bundle.ps1')
