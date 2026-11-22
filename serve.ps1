# key_control_facturas_server.ps1
# ---------------------------------------------------------------
# Servidor HTTP local mínimo para "Control de Facturas | KeysCITI".
# Sirve la carpeta del proyecto en http://localhost:8080
# Permite que la cámara del navegador funcione (contexto localhost).
# Uso:
#   powershell -ExecutionPolicy Bypass -File serve.ps1
# Luego abre http://localhost:8080 en el navegador.
# Pulsa Ctrl+C para detener el servidor.
# ---------------------------------------------------------------

param(
    [int]$Port = 8080,
    [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$ErrorActionPreference = 'Stop'

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.webp' = 'image/webp'
    '.json' = 'application/json; charset=utf-8'
    '.txt'  = 'text/plain; charset=utf-8'
    '.ico'  = 'image/x-icon'
}

function Get-MimeType([string]$path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    if ($mimeTypes.ContainsKey($ext)) { return $mimeTypes[$ext] }
    return 'application/octet-stream'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "[ERROR] No se pudo iniciar en el puerto $Port : $_" -ForegroundColor Red
    Write-Host "Asegurate de que el puerto este libre o usa:  -Port 8081" -ForegroundColor Yellow
    exit 1
}

$rootFull = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')

Write-Host ""
Write-Host "  Control de Facturas | KeysCITI" -ForegroundColor Cyan
Write-Host "  ----------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Abre en tu navegador:  http://localhost:$Port" -ForegroundColor Green
Write-Host "  Detener servidor:      Ctrl+C" -ForegroundColor Yellow
Write-Host "  ----------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
    if ($urlPath -eq '/' -or $urlPath -eq '') { $urlPath = '/index.html' }

    # Prevenir navegacion fuera de la raiz
    $requested = [System.IO.Path]::GetFullPath((Join-Path $rootFull ($urlPath.TrimStart('/'))))
    if (-not $requested.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $response.StatusCode = 403
        $response.Close()
        continue
    }

    if (Test-Path -LiteralPath $requested -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($requested)
        $response.ContentType = Get-MimeType $requested
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        Write-Host ("  {0}  {1}" -f $request.Url.PathAndQuery, "200") -ForegroundColor DarkGray
    } else {
        $response.StatusCode = 404
        Write-Host ("  {0}  {1}" -f $request.Url.PathAndQuery, "404") -ForegroundColor Red
    }
    $response.Close()
}

$listener.Stop()