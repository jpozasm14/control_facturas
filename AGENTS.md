# AGENTS.md — Control de Facturas | KeysCITI

App estática (sin build, sin npm, sin framework) para extraer por OCR datos de facturas/vouchers chilenos y guardarlos en `localStorage`. Todo el HTML/CSS/JS vive en la raíz.

## Cómo se sirve y se prueba
- `python.exe` y `node` **no están disponibles** (python.exe es un stub de Microsoft Store). No uses Node/Python para nada aquí.
- Servidor local: `powershell -ExecutionPolicy Bypass -File serve.ps1` → `http://localhost:8080` (cámara solo funciona en localhost/HTTPS, no en `file://`).
- **Gotcha del servidor**: el `HttpListener` falla si ya hay una instancia en el puerto. Antes de relanzar, matar la anterior (`Get-NetTCPConnection -LocalPort 8080 -State Listen` → `Stop-Process` del `OwningProcess`). Para capturar el log del server, usar `*>` dentro de `-Command` de `Start-Process` (no `-RedirectStandardOutput`, que cuelga).
- Sin tests ni CI. Validación con Edge headless: `msedge --headless=new --disable-gpu --dump-dom <url>` con `--virtual-time-budget` para JS síncrono (el parser). Herramientas de prueba viven fuera del repo en `C:\Users\jpoza\AppData\Local\Temp\opencode` (no las muevas al repo).

## Arquitectura y dependencias
- `index.html` carga desde CDN (requiere internet la primera vez): `tesseract.js@5` y `cropperjs@1.6.2`. Sin red, el OCR muere con error genérico.
- `js/app.js` = IIFE monolítico de ~900 líneas (sin módulos ni clases). No hay tests unitarios; todo el estado en `localStorage` clave `keysciti_facturas` (`STORAGE_KEY`).
- Las imágenes se guardan como **dataURL** (persisten en recargas), nunca `blob:` URL. Texto OCR actual en `currentText`.
- API de Tesseract v5: `worker.recognize(blob, {}, { text: true })`. **Nunca pases `null` como opciones** — rompe el worker silenciosamente ("error desconocido"). El worker se cachea en `workerPromise` y se reinicia a `null` en el catch.

## Parser (`parseInvoice` en js/app.js) — trampas críticas
- `parseMoney`: formato chileno/mixto (`1.234.567` → 1234567, `$ 12.300` → 12300). Monedas chilenas sin decimales.
- **`normalizeText` DEBE conservar los saltos de línea `\n`** (parser por líneas). No lo "limpies" con `.replace(/\s+/g,' ')` ni colapses las líneas, o todo el parseo devuelve null/0. Ya hubo ese bug.
- `parseInvoice` auto-detecta tipo de documento:
  - **Voucher TRANSBANK** (`VENTA - COPIA CLIENTE`, `MONTO VENTA`, `AUTORIZACION`, `VALIDO COMO BOLETA`): número desde folio `AJO<digits>` / `OPERACION` / `AUTORIZACION`; neto desde `MONTO VENTA`; descripción = nombre del comercio (razón social `SPA|LTDA|...`).
  - **Factura electrónica**: número desde `N°`/`FOLIO`; neto desde `NETO`; descripción desde detalle de ítems.
- IVA: el regex debe capturar el **monto** (ej. 19000), no el porcentaje `19%` de la etiqueta. Regex actual: `(?:^|\s)(?:IVA|I\.\s*(?:V\.)?\s*A\.?)\s*(?:[0-9]{1,3}\s*%)?\s*[:$]?\s*`.

## Otros gotchas
- `Facturas_ejemplos/factura_de_prueba.jpeg` **no es una factura**: es un voucher de tarjeta TRANSBANK. No asumas el formato al escribir/validar el parser; el parser es de doble tipo a propósito.
- Paleta de marca (del logo, `assets/logo_keysciti.png`): azul #103B70 con variantes #0B2A51/#071D38/#1E4D8E, acento amarillo #FDD504.
- Estilos/código en español; UI en español (DD/MM/AAAA, es-CL para montos).
- Repo sin commits aún (todos los archivos siguen como untracked) — no se ha inicializado historial.