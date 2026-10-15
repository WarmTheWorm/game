# Every generator beside this makes art for one asset pack, so they all take
# the same -Pack name and resolve where they write through here. Dot-source it
# right after the param block:
#
#   . (Join-Path $PSScriptRoot '_pack.ps1')
$ErrorActionPreference = 'Stop'
$GEN_ROOT = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path

function Get-PackDir([string]$Pack = 'garden', [string]$Sub = '') {
  Get-AnyPackDir (Join-Path $GEN_ROOT 'assetpacks') $Pack $Sub 'asset pack'
}

function Get-LevelPackDir([string]$Pack = 'garden', [string]$Sub = '') {
  Get-AnyPackDir (Join-Path $GEN_ROOT 'levelpacks') $Pack $Sub 'level pack'
}

# Artwork that is looked at rather than shipped goes here, so a pack never
# carries a diagnostic image it has no use for.
function Get-DistDir() {
  $dir = Join-Path $GEN_ROOT 'dist'
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  $dir
}

function Get-AnyPackDir([string]$Base, [string]$Pack, [string]$Sub, [string]$Kind) {
  $dir = Join-Path $Base $Pack
  if (-not (Test-Path $dir)) {
    $have = (Get-ChildItem $Base -Directory | ForEach-Object Name) -join ', '
    throw "no $Kind called '$Pack' - there is: $have"
  }
  if ($Sub) {
    $dir = Join-Path $dir $Sub
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  $dir
}
