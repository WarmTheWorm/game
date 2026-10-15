# Rotation is in place and self-inverse only after three runs, so name just the
# sheets you have re-copied from assets/.
param([string[]]$Files = @('tiles.png', 'objects.png'))

Add-Type -AssemblyName System.Drawing

# Rotates each pixel's channels (r,g,b) -> (b,r,g), alpha untouched, so this
# pack's art is unmistakably not the garden pack's and a crossing between the
# two shows at a glance whether the loader swapped sheets. Edits in place, so
# re-run it after re-copying art from assets/ — three runs return the original.
function Invoke-ChannelRotate([string]$Path) {
  $src = New-Object System.Drawing.Bitmap $Path
  $w = $src.Width; $h = $src.Height
  $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.DrawImage($src, 0, 0, $w, $h)
  $g.Dispose(); $src.Dispose()

  $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
  $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadWrite, $bmp.PixelFormat)
  $len = $data.Stride * $h
  $buf = New-Object byte[] $len
  [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $buf, 0, $len)
  for ($i = 0; $i -lt $len; $i += 4) {
    $blue = $buf[$i]; $green = $buf[$i + 1]; $red = $buf[$i + 2]
    $buf[$i] = $green; $buf[$i + 1] = $red; $buf[$i + 2] = $blue
  }
  [System.Runtime.InteropServices.Marshal]::Copy($buf, 0, $data.Scan0, $len)
  $bmp.UnlockBits($data)
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "{0}  {1}x{2}" -f (Split-Path $Path -Leaf), $w, $h
}

foreach ($f in $Files) { Invoke-ChannelRotate (Join-Path $PSScriptRoot $f) }
