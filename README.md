# Control de Facturas — KeysCITI

Aplicación para extraer datos de facturas y vouchers chilenos mediante OCR (Tesseract.js) y gestionarlos en el navegador (`localStorage`). Incluye además un backend PHP opcional para persistencia, login, plan de cuentas, libro diario y flujo de caja.

## Desarrollo local

La versión estática no requiere build ni dependencias:

```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Abrir `http://localhost:8080`. La cámara solo funciona en `localhost` o HTTPS. Si el puerto 8080 está ocupado, detener el proceso previo antes de relanzar el servidor.

> Tesseract.js y Cropper.js se cargan desde CDN, por lo que se requiere internet la primera vez.

## Backend PHP

1. Copiar `php/config.example.php` a `php/config.php`.
2. Completar los valores reales (o definir variables de entorno `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`).
3. Para inicializar la base de datos con `setup.php`, definir `SETUP_KEY` y opcionalmente `SETUP_ADMIN_PASSWORD`. Si no se define esta última, se genera una contraseña aleatoria que se muestra una sola vez.

`php/config.php` está excluido de Git a propósito: contiene credenciales reales y nunca debe versionarse.

## Despliegue

`deploy.ps1` sube los archivos por FTP a Hostinger. Lee las credenciales desde `%USERPROFILE%\.keysciti_ftp.env` (`FTP_HOST`, `FTP_USER`, `FTP_PASS`), archivo que tampoco se versiona.

```powershell
powershell -ExecutionPolicy Bypass -File deploy.ps1 -DryRun  # solo muestra qué se subiría
powershell -ExecutionPolicy Bypass -File deploy.ps1         # despliega
```

## Datos de prueba

`Facturas_ejemplos/` contiene documentos con datos personales y está excluido mediante `.gitignore`.
