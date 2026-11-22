<?php
require_once __DIR__ . '/php/config.php';
startSession();
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: Thu, 01 Jan 1970 00:00:00 GMT');
if (!isLoggedIn()) { require __DIR__ . '/php/login.php'; exit; }
?>
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Control de Facturas | KeysCITI</title>
<link rel="icon" type="image/png" href="assets/logo_keysciti.png">
<link rel="stylesheet" href="css/styles.css?v=<?= time() ?>">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.css">
</head>
<body>

<header class="site-header">
  <div class="header-inner container">
    <div class="brand">
      <img src="assets/logo_keysciti.png" alt="KeysCITI" class="brand-logo">
      <div class="brand-text">
        <h1>KeysCITI</h1>
        <span>Control de Facturas</span>
      </div>
    </div>
    <nav class="header-nav" aria-label="Resumen">
      <div class="stat-chip">
        <span class="stat-label">Facturas</span>
        <span id="stat-count" class="stat-value">0</span>
      </div>
      <div class="stat-chip">
        <span class="stat-label">Total</span>
        <span id="stat-total" class="stat-value">$0</span>
      </div>
      <div class="stat-chip" style="border-color:rgba(255,255,255,0.4);">
        <span class="stat-label"><?= htmlspecialchars($_SESSION['username']) ?></span>
        <a href="php/logout.php" style="color:#fff;font-size:0.7rem;">Salir</a>
      </div>
    </nav>
  </div>
</header>

<main class="container">

  <!-- Navegación por pestañas -->
  <nav class="tabs-nav" id="tabs-nav">
    <button type="button" class="tab-btn active" data-tab="dashboard">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
      Dashboard
    </button>
    <button type="button" class="tab-btn" data-tab="facturas">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z"/></svg>
      Facturas
    </button>
    <button type="button" class="tab-btn" data-tab="plan-cuentas">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
      Plan de Cuentas
    </button>
    <button type="button" class="tab-btn" data-tab="libro-diario">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z"/></svg>
      Libro Diario
    </button>
    <button type="button" class="tab-btn" data-tab="libro-mayor">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
      Libro Mayor
    </button>
    <button type="button" class="tab-btn" data-tab="flujo-caja">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg>
      Flujo de Caja
    </button>
  </nav>

  <!-- ====== SECCIÓN DASHBOARD ====== -->
  <section id="tab-dashboard" class="tab-content active">
    <section class="card">
      <div class="card-title-row between">
        <div>
          <h2>Dashboard</h2>
          <p class="card-subtitle">Indicadores clave de rendimiento de la empresa.</p>
        </div>
        <div class="table-tools">
          <button type="button" id="dash-prev" class="btn btn-ghost btn-sm">&larr; Anterior</button>
          <span id="dash-periodo" style="font-weight:700;color:var(--keys-blue);min-width:140px;text-align:center;"></span>
          <button type="button" id="dash-next" class="btn btn-ghost btn-sm">Siguiente &rarr;</button>
        </div>
      </div>
      <div id="dash-kpis" class="dash-kpi-grid"></div>
    </section>
    <div class="dash-row-2">
      <section class="card">
        <div class="card-title-row"><h2>Ratios Financieros</h2></div>
        <div id="dash-ratios" class="dash-ratio-grid"></div>
      </section>
      <section class="card">
        <div class="card-title-row"><h2>Tendencia (6 meses)</h2></div>
        <div id="dash-graficos" class="dash-chart"></div>
      </section>
    </div>
  </section><!-- fin tab-dashboard -->

  <!-- ====== SECCIÓN FACTURAS ====== -->
  <section id="tab-facturas" class="tab-content" hidden>

  <!-- Zona de carga -->
  <section class="card upload-card">
    <div class="card-title-row">
      <h2>Subir Factura</h2>
      <p class="card-subtitle">Sube una imagen o captura con la cámara para extraer los datos automáticamente.</p>
    </div>

    <div id="drop-zone" class="drop-zone" tabindex="0" role="button" aria-label="Seleccionar imagen de factura">
      <input type="file" id="file-input" accept="image/*,.pdf" hidden>
      <div class="drop-content">
        <svg class="drop-icon" viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">
          <path fill="currentColor" d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 0 0 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/>
        </svg>
        <p class="drop-main">Arrastra la imagen aquí o <span class="link">selecciona un archivo</span></p>
        <p class="drop-hint">JPG, PNG, WEBP, PDF o captura con cámara</p>
      </div>
      <div class="drop-actions">
        <button type="button" id="btn-camera" class="btn btn-primary">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM9 2l-1.83 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"/></svg>
          Capturar con cámara
        </button>
        <button type="button" id="btn-browse" class="btn btn-outline">Elegir archivo</button>
      </div>
    </div>

    <!-- Progreso OCR -->
    <div id="ocr-progress" class="ocr-progress" hidden>
      <div class="progress-top">
        <span id="ocr-status">Procesando imagen…</span>
        <span id="ocr-pct">0%</span>
      </div>
      <div class="progress-track"><div id="progress-bar" class="progress-bar"></div></div>
    </div>

    <div id="ocr-error" class="alert alert-error" hidden></div>
  </section>

  <!-- Previsualización y datos extraídos -->
  <section id="result-section" class="card result-card" hidden>
    <div id="doc-selector" class="doc-selector" hidden></div>
    <div class="result-grid">
      <div class="result-preview">
        <div class="preview-frame">
          <img id="preview-img" alt="Vista previa de la factura">
        </div>
      </div>
      <div class="result-form">
        <h3>Datos extraídos</h3>
        <p class="card-subtitle">Revisa y corrige la información antes de guardar.</p>
        <form id="invoice-form" autocomplete="off">
          <div class="form-row">
            <div class="field">
              <label for="f-numero">Número de factura</label>
              <input type="text" id="f-numero" placeholder="Ej: 123456" maxlength="40">
            </div>
            <div class="field">
              <label for="f-fecha">Fecha</label>
              <input type="text" id="f-fecha" placeholder="DD/MM/AAAA" maxlength="10">
            </div>
          </div>
          <div class="form-row form-row-2">
            <div class="field">
              <label for="f-tipo-doc">Tipo de Documento</label>
              <select id="f-tipo-doc">
                <option value="Factura">Factura</option>
                <option value="Boleta">Boleta</option>
                <option value="Comprobante de Pago">Comprobante de Pago</option>
                <option value="Nota de crédito">Nota de crédito</option>
              </select>
            </div>
            <div class="field">
              <label for="f-tipo-op">Tipo de Operación</label>
              <select id="f-tipo-op">
                <option value="Venta">Venta</option>
                <option value="Compra">Compra</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="field">
              <label for="f-neto">Valor Neto</label>
              <input type="text" id="f-neto" inputmode="decimal" placeholder="$0">
            </div>
            <div class="field">
              <label for="f-iva">Valor IVA</label>
              <input type="text" id="f-iva" inputmode="decimal" placeholder="$0">
            </div>
            <div class="field">
              <label for="f-total">Valor Total</label>
              <input type="text" id="f-total" inputmode="decimal" placeholder="$0">
            </div>
          </div>
          <div class="field">
            <label for="f-descripcion">Descripción del producto / servicio</label>
            <textarea id="f-descripcion" rows="3" maxlength="500" placeholder="Ej: Revestimiento de muro y pintura interior"></textarea>
          </div>
          <div class="form-row form-row-2">
            <div class="field">
              <label for="f-cuenta">Cuenta Contable Asociada</label>
              <select id="f-cuenta">
                <option value="">— Seleccionar cuenta —</option>
              </select>
            </div>
            <div class="field">
              <label for="f-cuenta-auto">Auto-asignación</label>
              <div class="account-match-info" id="account-match-info" hidden>
                <span class="match-badge">Sugerencia:</span> <span id="match-suggestion">—</span>
              </div>
              <div id="no-match-info" class="account-match-info no-match" hidden>
                <span class="no-match-badge">Sin coincidencia</span> — Seleccionar manualmente
              </div>
            </div>
          </div>
          <div class="form-actions">
            <button type="button" id="btn-save" class="btn btn-primary btn-lg">Guardar factura</button>
            <button type="button" id="btn-cancel" class="btn btn-ghost">Cancelar</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Panel debug: texto OCR crudo -->
    <details id="ocr-debug" class="ocr-debug" open>
      <summary>Ver texto OCR (debug)</summary>
      <pre id="ocr-debug-text" class="ocr-debug-text">(aún sin datos)</pre>
    </details>
  </section>

  <!-- Tabla de facturas -->
  <section class="card table-card">
    <div class="card-title-row between">
      <div>
        <h2>Facturas registradas</h2>
        <p class="card-subtitle" id="table-subtitle">Sin facturas registradas.</p>
      </div>
      <div class="table-tools">
        <input type="search" id="search-input" class="search-input" placeholder="Buscar…" aria-label="Buscar facturas">
        <button type="button" id="btn-export" class="btn btn-outline" title="Exportar a CSV">Exportar CSV</button>
        <button type="button" id="btn-clear" class="btn btn-danger-ghost" title="Eliminar todas las facturas">Vaciar</button>
      </div>
    </div>

    <div class="filters-row" id="filters-row">
      <div class="filter-group">
        <label for="filter-fecha-desde">Fecha desde</label>
        <input type="date" id="filter-fecha-desde" class="filter-input">
      </div>
      <div class="filter-group">
        <label for="filter-fecha-hasta">Fecha hasta</label>
        <input type="date" id="filter-fecha-hasta" class="filter-input">
      </div>
      <div class="filter-group">
        <label for="filter-tipo-doc">Tipo Documento</label>
        <select id="filter-tipo-doc" class="filter-input">
          <option value="">Todos</option>
          <option value="Factura">Factura</option>
          <option value="Boleta">Boleta</option>
          <option value="Comprobante de Pago">Comprobante de Pago</option>
          <option value="Nota de crédito">Nota de crédito</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filter-tipo-op">Operación</label>
        <select id="filter-tipo-op" class="filter-input">
          <option value="">Todas</option>
          <option value="Venta">Venta</option>
          <option value="Compra">Compra</option>
        </select>
      </div>
      <div class="filter-group filter-group-btn">
        <button type="button" id="btn-clear-filters" class="btn btn-ghost btn-sm">Limpiar filtros</button>
      </div>
    </div>

    <div class="table-wrap">
      <table class="invoice-table">
        <thead>
          <tr>
            <th>N°</th>
            <th>Número</th>
            <th>Tipo Doc.</th>
            <th>Operación</th>
            <th>Fecha</th>
            <th class="num">Neto</th>
            <th class="num">IVA</th>
            <th class="num">Total</th>
            <th>Descripción</th>
            <th>Cuenta</th>
            <th>Asiento</th>
            <th class="actions-col">Acciones</th>
          </tr>
        </thead>
        <tbody id="table-body"></tbody>
      </table>
    </div>
    <div class="table-footer">
      <span id="footer-summary"></span>
      <div id="pagination" class="pagination"></div>
    </div>
  </section>
</section><!-- fin tab-facturas -->

  <!-- ====== SECCIÓN PLAN DE CUENTAS ====== -->
  <section id="tab-plan-cuentas" class="tab-content" hidden>
    <section class="card">
      <div class="card-title-row between">
        <div>
          <h2>Plan de Cuentas</h2>
          <p class="card-subtitle">Gestiona el catálogo de cuentas contables de la empresa.</p>
        </div>
        <div class="table-tools">
          <input type="search" id="pc-search" class="search-input" placeholder="Buscar cuenta…" aria-label="Buscar cuentas">
          <select id="pc-filter-class" class="filter-input">
            <option value="">Todas las clases</option>
            <option value="1">1 - Activo</option>
            <option value="2">2 - Pasivo</option>
            <option value="3">3 - Patrimonio Neto</option>
            <option value="4">4 - Ingresos Operacionales</option>
            <option value="5">5 - Costo de Ventas</option>
            <option value="6">6 - Gastos Operacionales</option>
            <option value="7">7 - Resultado No Operacional</option>
          </select>
          <button type="button" id="pc-btn-add" class="btn btn-primary">+ Nueva Cuenta</button>
        </div>
      </div>
      <div class="pc-summary" id="pc-summary"></div>
      <div class="pc-tree-wrap">
        <div id="pc-tree" class="pc-tree"></div>
      </div>
    </section>
  </section><!-- fin tab-plan-cuentas -->

  <!-- ====== SECCIÓN LIBRO DIARIO ====== -->
  <section id="tab-libro-diario" class="tab-content" hidden>
    <section class="card">
      <div class="card-title-row between">
        <div>
          <h2>Libro Diario</h2>
          <p class="card-subtitle">Registra tus asientos. Cada asiento debe tener al menos una línea con Debe y una con Haber por el mismo monto.</p>
        </div>
        <div class="table-tools">
          <button type="button" id="ld-btn-new" class="btn btn-primary">+ Nuevo Asiento</button>
        </div>
      </div>
      <div class="table-wrap">
        <table class="invoice-table ld-table">
          <thead>
            <tr>
              <th>N° Asiento</th>
              <th>Fecha</th>
              <th>Glosa / Descripción</th>
              <th>Cuenta</th>
              <th>Nombre Cuenta</th>
              <th class="num">Debe</th>
              <th class="num">Haber</th>
              <th>Estado</th>
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody id="ld-table-body"></tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="ld-footer-summary"></span>
        <div id="ld-pagination" class="pagination"></div>
      </div>
    </section>
  </section><!-- fin tab-libro-diario -->

  <!-- ====== SECCIÓN LIBRO MAYOR ====== -->
  <section id="tab-libro-mayor" class="tab-content" hidden>
    <section class="card">
      <div class="card-title-row between">
        <div>
          <h2>Libro Mayor</h2>
          <p class="card-subtitle">Calculado automáticamente desde el Libro Diario. Cada cuenta muestra su Debe, Haber y Saldo.</p>
        </div>
      </div>
      <div id="lm-summary" class="lm-summary"></div>
      <div class="table-wrap">
        <table class="invoice-table lm-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nombre Cuenta</th>
              <th class="num">Total Debe</th>
              <th class="num">Total Haber</th>
              <th class="num">Saldo</th>
            </tr>
          </thead>
          <tbody id="lm-table-body"></tbody>
        </table>
      </div>
    </section>
  </section><!-- fin tab-libro-mayor -->

  <!-- ====== SECCIÓN FLUJO DE CAJA ====== -->
  <section id="tab-flujo-caja" class="tab-content" hidden>
    <section class="card">
      <div class="card-title-row between">
        <div>
          <h2>Flujo de Caja</h2>
          <p class="card-subtitle">Flujo de efectivo del período. Calculado desde Libro Diario + ajustes manuales.</p>
        </div>
        <div class="table-tools">
          <div id="fc-metodo-toggle" style="display:flex;gap:4px;">
            <button type="button" id="fc-btn-directo" class="btn btn-primary btn-sm">Directo</button>
            <button type="button" id="fc-btn-indirecto" class="btn btn-ghost btn-sm">Indirecto</button>
          </div>
          <button type="button" id="fc-prev" class="btn btn-ghost btn-sm">&larr;</button>
          <span id="fc-periodo" style="font-weight:700;color:var(--keys-blue);min-width:120px;text-align:center;"></span>
          <button type="button" id="fc-next" class="btn btn-ghost btn-sm">&rarr;</button>
          <button type="button" id="fc-btn-new" class="btn btn-primary">+ Ajuste</button>
        </div>
      </div>

      <!-- Resumen -->
      <div id="fc-resumen" class="fc-resumen"></div>

      <!-- Detalles -->
      <div id="fc-detalles" class="fc-detalles"></div>

      <!-- Ajustes manuales -->
      <div style="margin-top:18px;">
        <h3 style="margin:0 0 10px;color:var(--keys-blue-dark);">Ajustes Manuales</h3>
        <div id="fc-ajustes-list"></div>
      </div>
    </section>
  </section><!-- fin tab-flujo-caja -->

</main>

<!-- Modal cámara -->
<div id="camera-modal" class="modal" hidden>
  <div class="modal-box">
    <div class="modal-header">
      <h3>Capturar factura</h3>
      <button type="button" id="btn-close-modal" class="btn-icon" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <video id="camera-video" autoplay playsinline></video>
      <canvas id="camera-canvas" class="camera-canvas" hidden></canvas>
      <div id="crop-wrap" class="crop-wrap" hidden>
        <div id="crop-photo">
          <img id="crop-image" alt="Foto capturada para recortar">
        </div>
        <p class="crop-hint">Arrastra para mover, usá las esquinas para ajustar la zona del recorte.</p>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" id="btn-capture" class="btn btn-primary">Tomar foto</button>
      <button type="button" id="btn-retake" class="btn btn-ghost" hidden>Volver a capturar</button>
      <button type="button" id="btn-cancel-camera" class="btn btn-ghost">Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal confirmación vaciado -->
<div id="confirm-modal" class="modal" hidden>
  <div class="modal-box small">
    <div class="modal-header">
      <h3>Eliminar todas las facturas</h3>
      <button type="button" class="btn-icon btn-close-confirm" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <p>¿Estás seguro? Esta acción borrará permanentemente todas las facturas registradas.</p>
    </div>
    <div class="modal-footer">
      <button type="button" id="btn-confirm-clear" class="btn btn-danger">Sí, vaciar</button>
      <button type="button" class="btn btn-ghost btn-close-confirm">Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal cuenta contable -->
<div id="pc-modal" class="modal" hidden>
  <div class="modal-box">
    <div class="modal-header">
      <h3 id="pc-modal-title">Nueva Cuenta</h3>
      <button type="button" id="pc-modal-close" class="btn-icon" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <form id="pc-form" autocomplete="off">
        <div class="form-row">
          <div class="field">
            <label for="pc-f-code">Código</label>
            <input type="text" id="pc-f-code" placeholder="Ej: 1.1.01.01" maxlength="20" required>
          </div>
          <div class="field">
            <label for="pc-f-name">Nombre</label>
            <input type="text" id="pc-f-name" placeholder="Ej: Caja General" maxlength="120" required>
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="field">
            <label for="pc-f-parent">Cuenta Padre</label>
            <select id="pc-f-parent">
              <option value="">(Nivel superior / Raíz)</option>
            </select>
          </div>
          <div class="field">
            <label for="pc-f-class">Clase</label>
            <select id="pc-f-class">
              <option value="1">1 - Activo</option>
              <option value="2">2 - Pasivo</option>
              <option value="3">3 - Patrimonio Neto</option>
              <option value="4">4 - Ingresos Operacionales</option>
              <option value="5">5 - Costo de Ventas</option>
              <option value="6">6 - Gastos Operacionales</option>
              <option value="7">7 - Resultado No Operacional</option>
            </select>
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="field">
            <label for="pc-f-nat">Naturaleza</label>
            <select id="pc-f-nat">
              <option value="Deudora">Deudora</option>
              <option value="Acreedora">Acreedora</option>
            </select>
          </div>
          <div class="field">
            <label for="pc-f-clasif">Clasificación EEFF</label>
            <select id="pc-f-clasif">
              <option value="Activo Corriente">Activo Corriente</option>
              <option value="Activo No Corriente">Activo No Corriente</option>
              <option value="Pasivo Corriente">Pasivo Corriente</option>
              <option value="Pasivo No Corriente">Pasivo No Corriente</option>
              <option value="Patrimonio Neto">Patrimonio Neto</option>
              <option value="Ingresos Operacionales">Ingresos Operacionales</option>
              <option value="Costo de Ventas">Costo de Ventas</option>
              <option value="Gastos de Administración">Gastos de Administración</option>
              <option value="Gastos de Ventas">Gastos de Ventas</option>
              <option value="Resultado No Operacional">Resultado No Operacional</option>
              <option value="Impuesto a la Renta">Impuesto a la Renta</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label class="pc-check-label">
            <input type="checkbox" id="pc-f-imp"> Cuenta imputable (acepta asientos directos)
          </label>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" id="pc-btn-save" class="btn btn-primary">Guardar</button>
      <button type="button" id="pc-btn-cancel" class="btn btn-ghost">Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal confirmación eliminar cuenta -->
<div id="pc-confirm-modal" class="modal" hidden>
  <div class="modal-box small">
    <div class="modal-header">
      <h3>Eliminar cuenta</h3>
      <button type="button" class="btn-icon pc-close-confirm" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <p id="pc-confirm-msg">¿Eliminar esta cuenta?</p>
    </div>
    <div class="modal-footer">
      <button type="button" id="pc-btn-confirm-del" class="btn btn-danger">Sí, eliminar</button>
      <button type="button" class="btn btn-ghost pc-close-confirm">Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal Nuevo Asiento Libro Diario -->
<div id="ld-modal" class="modal" hidden>
  <div class="modal-box" style="max-width:720px;">
    <div class="modal-header">
      <h3 id="ld-modal-title">Nuevo Asiento</h3>
      <button type="button" id="ld-modal-close" class="btn-icon" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <form id="ld-form" autocomplete="off">
        <div class="form-row form-row-2">
          <div class="field">
            <label for="ld-f-fecha">Fecha</label>
            <input type="date" id="ld-f-fecha" required>
          </div>
          <div class="field">
            <label for="ld-f-glosa">Glosa / Descripción</label>
            <input type="text" id="ld-f-glosa" placeholder="Ej: Venta al contado con IVA" maxlength="200">
          </div>
        </div>

        <div class="ld-lines-header">
          <span class="ld-col-cuenta">Cuenta</span>
          <span class="ld-col-debe">Debe</span>
          <span class="ld-col-haber">Haber</span>
          <span class="ld-col-actions"></span>
        </div>
        <div id="ld-lines"></div>

        <div class="ld-lines-footer">
          <button type="button" id="ld-add-line" class="btn btn-ghost btn-sm">+ Agregar línea</button>
          <div class="ld-totals">
            <span>Total Debe: <strong id="ld-total-debe">$0</strong></span>
            <span>Total Haber: <strong id="ld-total-haber">$0</strong></span>
            <span id="ld-balance-status"></span>
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" id="ld-btn-save" class="btn btn-primary">Guardar asiento</button>
      <button type="button" id="ld-btn-cancel" class="btn btn-ghost">Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal confirmación eliminar asiento -->
<div id="ld-confirm-modal" class="modal" hidden>
  <div class="modal-box small">
    <div class="modal-header">
      <h3>Eliminar asiento</h3>
      <button type="button" class="btn-icon ld-close-confirm" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <p id="ld-confirm-msg">¿Eliminar este asiento?</p>
    </div>
    <div class="modal-footer">
      <button type="button" id="ld-btn-confirm-del" class="btn btn-danger">Sí, eliminar</button>
      <button type="button" class="btn btn-ghost ld-close-confirm">Cancelar</button>
    </div>
  </div>
</div>

<!-- Modal Ajuste Flujo de Caja -->
<div id="fc-modal" class="modal" hidden>
  <div class="modal-box small">
    <div class="modal-header">
      <h3 id="fc-modal-title">Nuevo Ajuste</h3>
      <button type="button" id="fc-modal-close" class="btn-icon" aria-label="Cerrar">&times;</button>
    </div>
    <div class="modal-body">
      <form id="fc-ajuste-form" autocomplete="off">
        <input type="hidden" id="fc-f-id">
        <div class="form-row form-row-2">
          <div class="field">
            <label for="fc-f-fecha">Fecha</label>
            <input type="date" id="fc-f-fecha" required>
          </div>
          <div class="field">
            <label for="fc-f-concepto">Concepto</label>
            <input type="text" id="fc-f-concepto" placeholder="Ej: Depreciación mensual" maxlength="200" required>
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="field">
            <label for="fc-f-tipo">Tipo</label>
            <select id="fc-f-tipo">
              <option value="ingreso">Ingreso</option>
              <option value="egreso">Egreso</option>
            </select>
          </div>
          <div class="field">
            <label for="fc-f-monto">Monto</label>
            <input type="number" id="fc-f-monto" step="0.01" min="0" placeholder="0" required>
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="field">
            <label for="fc-f-clasificacion">Clasificación</label>
            <select id="fc-f-clasificacion">
              <option value="operacional">Operacional</option>
              <option value="inversion">Inversión</option>
              <option value="financiamiento">Financiamiento</option>
            </select>
          </div>
          <div class="field">
            <label for="fc-f-notas">Notas</label>
            <input type="text" id="fc-f-notas" placeholder="Opcional" maxlength="300">
          </div>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button type="button" id="fc-btn-save" class="btn btn-primary">Guardar</button>
      <button type="button" id="fc-btn-cancel" class="btn btn-ghost">Cancelar</button>
    </div>
  </div>
</div>

<footer class="site-footer">
  <div class="container">KeysCITI &copy; <span id="year"></span> — Control de Facturas</div>
</footer>

<script>
  window.__USER__ = <?= json_encode([
    'id'       => currentUserId(),
    'username' => $_SESSION['username'] ?? '',
    'full_name'=> $_SESSION['full_name'] ?? '',
    'role'     => currentUserRole(),
    'apiBase'  => 'php/api/',
  ], JSON_UNESCAPED_UNICODE) ?>;
</script>
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js"></script>
<script src="js/app.js?v=<?= time() ?>"></script>
<script src="js/plan_cuentas.js?v=<?= time() ?>"></script>
<script src="js/libro_diario.js?v=<?= time() ?>"></script>
<script src="js/libro_mayor.js?v=<?= time() ?>"></script>
<script src="js/dashboard.js?v=<?= time() ?>"></script>
<script src="js/flujo_caja.js?v=<?= time() ?>"></script>
</body>
</html>
