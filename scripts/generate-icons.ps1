Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path 'public/icons' | Out-Null
$srcPath = Resolve-Path 'public/logo.png'
$src = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Img($destPath, [int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($src, 0, 0, $w, $h)
    $g.Dispose()
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Generated $destPath ($w x $h)"
}

Resize-Img 'public/icons/icon-192.png' 192 192
Resize-Img 'public/icons/icon-512.png' 512 512
Resize-Img 'public/icons/apple-touch-icon.png' 180 180
Resize-Img 'public/icons/icon-maskable-512.png' 512 512

$src.Dispose()
