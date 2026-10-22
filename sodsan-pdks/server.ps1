[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$port = 8085
$url = "http://localhost:$port/"
$folder = $PSScriptRoot

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SODSAN PDKS VE MAAS HESAPLAMA OTOMASYONU" -ForegroundColor Green
Write-Host " Sunucu Baslatildi: $url" -ForegroundColor Yellow
Write-Host " Kapatmak icin bu pencereyi kapatiniz veya Ctrl+C yapiniz." -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

Start-Process $url

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $localPath = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($localPath)) { $localPath = "index.html" }
    
    # URL decode
    $localPath = [System.Uri]::UnescapeDataString($localPath)
    $filePath = Join-Path $folder $localPath

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = "application/octet-stream"
        switch ($ext) {
            ".html" { $contentType = "text/html; charset=utf-8" }
            ".css"  { $contentType = "text/css; charset=utf-8" }
            ".js"   { $contentType = "application/javascript; charset=utf-8" }
            ".json" { $contentType = "application/json; charset=utf-8" }
            ".pdf"  { $contentType = "application/pdf" }
            ".dat"  { $contentType = "application/octet-stream" }
            ".ods"  { $contentType = "application/vnd.oasis.opendocument.spreadsheet" }
            ".xlsx" { $contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
            ".png"  { $contentType = "image/png" }
            ".svg"  { $contentType = "image/svg+xml" }
        }

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $contentType
        $response.ContentLength64 = $bytes.Length
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("Dosya bulunamadi: $localPath")
        $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
    }
    $response.Close()
}
