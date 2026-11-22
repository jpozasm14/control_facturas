# deploy.ps1 — Despliegue automático por FTP a Hostinger
# Sube los archivos del sitio a ftp.control-facturas.keysciti.com
#
# Requisitos:
#   - curl.exe (viene con Windows 10/11)
#   - Archivo de credenciales en $env:USERPROFILE\.keysciti_ftp.env
#     Formato (una clave por linea):
#       FTP_HOST=ftp.control-facturas.keysciti.com
#       FTP_USER=...
#       FTP_PASS=...
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File deploy.ps1          # despliega
#   powershell -ExecutionPolicy Bypass -File deploy.ps1 -DryRun  # solo muestra

param(
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$CredFile = Join-Path $env:USERPROFILE '.keysciti_ftp.env'

function Get-Creds {
    if (-not (Test-Path -LiteralPath $CredFile)) {
        Write-Host "[ERROR] No existe $CredFile . Crea el archivo con FTP_HOST, FTP_USER y FTP_PASS." -ForegroundColor Red
        exit 1
    }
    $creds = @{}
    foreach ($line in Get-Content -LiteralPath $CredFile) {
        if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*?)\s*$') {
            $creds[$matches[1]] = $matches[2]
        }
    }
    foreach ($k in 'FTP_HOST','FTP_USER','FTP_PASS') {
        if (-not $creds[$k]) {
            Write-Host "[ERROR] Falta $k en $CredFile" -ForegroundColor Red
            exit 1
        }
    }
    return $creds
}

$creds = Get-Creds
$base = "ftp://$($creds.FTP_HOST)/"

# Archivos a subir (rutas relativas al repo). NO incluye Facturas_ejemplos,
# AGENTS.md, deploy.ps1 ni serve.ps1.
$files = @(
    'index.php',
    'setup.php',
    'css/styles.css',
    'js/app.js',
    'js/plan_cuentas.js',
    'js/libro_diario.js',
    'js/libro_mayor.js',
    'js/dashboard.js',
    'js/flujo_caja.js',
    'php/config.php',
    'php/login.php',
    'php/logout.php',
    'php/api/facturas.php',
    'php/api/cuentas.php',
    'php/api/libro_diario.php',
    'php/api/dashboard.php',
    'php/api/flujo_caja.php',
    'php/api/session.php',
    'php/api/users.php',
    'assets/logo_keysciti.png',
    '.htaccess'
)

function Upload-File([string]$rel, [string]$user, [string]$pass) {
    $local = Join-Path $ProjectRoot $rel
    if (-not (Test-Path -LiteralPath $local)) {
        Write-Host "  [SKIP] $rel (no existe localmente)" -ForegroundColor DarkGray
        return
    }
    $remote = $rel.Replace('\', '/')
    if ($DryRun) {
        Write-Host "  [DRYRUN] $rel -> $remote" -ForegroundColor Cyan
        return
    }
    Write-Host "  [SUBIR] $rel" -ForegroundColor Yellow
    # --ftp-create-dirs crea las carpetas remotas css/, js/, assets/ si faltan
    & curl.exe --silent --show-error --ftp-create-dirs `
        --user "${user}:${pass}" `
        --upload-file $local `
        "$base$remote"
    if ($LASTEXITCODE -ne 0) {
        throw "curl fallo subiendo $rel (exit $LASTEXITCODE)"
    }
}

Write-Host "=== Despliegue a $($creds.FTP_HOST) ===" -ForegroundColor Cyan
Write-Host "Carpeta raiz FTP = public_html del subdominio" -ForegroundColor DarkGray
foreach ($f in $files) {
    Upload-File $f $creds.FTP_USER $creds.FTP_PASS
}
Write-Host "=== Fin ($($files.Count) archivos) ===" -ForegroundColor Green
