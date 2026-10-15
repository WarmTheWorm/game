param([string]$Sheet = (Join-Path $PSScriptRoot 'sprites/lantern.png'), [int]$Zoom = 3)

Add-Type -AssemblyName System.Drawing
$src = New-Object System.Drawing.Bitmap $Sheet
$out = New-Object System.Drawing.Bitmap ($src.Width * $Zoom), ($src.Height * $Zoom), ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$gfx = [System.Drawing.Graphics]::FromImage($out)
$gfx.Clear([System.Drawing.Color]::FromArgb(255, 18, 26, 42))
$gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$gfx.DrawImage($src, 0, 0, $out.Width, $out.Height)
$gfx.Dispose()
$path = Join-Path $PSScriptRoot '_inspect.png'
$out.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$out.Dispose(); $src.Dispose()
$path
