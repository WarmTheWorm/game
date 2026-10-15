# Blows a sprite sheet up so single pixels can be looked at.
#
#   pwsh -NoProfile -File tools\gen\inspect.ps1 -Sheet lanternFull.png -Zoom 4
param([string]$Pack = 'garden', [string]$Sheet = 'lanternFull.png', [int]$Zoom = 3)
. (Join-Path $PSScriptRoot '_pack.ps1')

Add-Type -AssemblyName System.Drawing
if (-not (Test-Path $Sheet)) { $Sheet = Join-Path (Get-PackDir $Pack 'sprites') $Sheet }
$src = New-Object System.Drawing.Bitmap $Sheet
$out = New-Object System.Drawing.Bitmap ($src.Width * $Zoom), ($src.Height * $Zoom), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($out)
$gfx.Clear([System.Drawing.Color]::FromArgb(255, 18, 26, 42))
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gfx.DrawImage($src, 0, 0, $out.Width, $out.Height)
$gfx.Dispose()
$path = Join-Path (Get-DistDir) 'inspect.png'
$out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose(); $src.Dispose()
$path
