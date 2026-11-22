<?php
// index.php — Router principal
// Requiere login; sirve index.html si está autenticado
// =====================================================
require_once __DIR__ . '/php/config.php';
startSession();

// Si no está logueado, mostrar login
if (!isLoggedIn()) {
  require __DIR__ . '/php/login.php';
  exit;
}

// Está logueado → servir la app principal
// Pass user info to the frontend via meta tags
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="csrf-token" content="<?= htmlspecialchars($_SESSION['csrf_token'] ?? '') ?>">
  <title>Control de Facturas — KeysCITI</title>
  <link rel="stylesheet" href="css/styles.css?v=8">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📄</text></svg>">
</head>
<body>

  <!-- Header -->
  <header class="app-header">
    <div class="header-left">
      <img src="assets/logo_keysciti.png" alt="KeysCITI" class="header-logo">
      <h1>Control de Facturas</h1>
    </div>
    <div class="header-right">
      <span class="user-info"><?= htmlspecialchars($_SESSION['full_name'] ?: $_SESSION['username']) ?></span>
      <span class="user-role"><?= htmlspecialchars($_SESSION['role']) ?></span>
      <a href="php/logout.php" class="btn btn-ghost btn-sm">Salir</a>
    </div>
  </header>

  <!-- Tabs -->
  <nav class="tabs-nav">
    <button class="tab-btn active" data-tab="facturas">Facturas</button>
    <button class="tab-btn" data-tab="plan-cuentas">Plan de Cuentas</button>
  </nav>

  <!-- Sección: Facturas -->
  <section class="tab-content active" id="tab-facturas">

    <!-- Zona de carga -->
    <div class="card upload-card">
      <div class="upload-zone" id="upload-zone">
        <p>Arrastra un PDF o imagen aquí</p>
        <p>o</p>
        <label class="btn btn-primary" for="file-input">Seleccionar archivo</label>
        <input type="file" id="file-input" accept="image/*,.pdf" multiple hidden>
        <button type="button" id="btn-camera" class="btn btn-ghost">Tomar foto</button>
      </div>
      <div id="progress-wrap" class="progress-wrap" hidden>
        <div class="progress-bar" id="progress-bar" style="width:0%"></div>
      </div>
      <p id="ocr-status" class="ocr-status" hidden></p>
      <p id="ocr-pct" class="ocr-pct" hidden></p>
      <p id="ocr-error" class="ocr-error" hidden></p>
    </div>

    <!-- Resultado OCR / formulario -->
    <div class="card result-card" id="result-section" hidden>
      <div class="result-grid">
        <div class="result-preview">
          <img id="preview-img" alt="Vista previa">
        </div>
        <div class="result-form">
          <h3>Datos extraídos</h3>
          <form id="invoice-form" autocomplete="off">
            <div class="form-row form-row-3">
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
              <div class="field">
                <label for="f-numero">Número de Folio</label>
                <input type="text" id="f-numero" placeholder="Ej: 3378">
              </div>
            </div>
            <div class="form-row form-row-3">
              <div class="field">
                <label for="f-fecha">Fecha</label>
                <input type="text" id="f-fecha" placeholder="DD/MM/AAAA">
              </div>
              <div class="field">
                <label for="f-neto">Neto</label>
                <input type="text" id="f-neto" inputmode="decimal" placeholder="$0">
              </div>
              <div class="field">
                <label for="f-iva">IVA</label>
                <input type="text" id="f-iva" inputmode="decimal" placeholder="$0">
              </div>
            </div>
            <div class="form-row form-row-2">
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
    </div>

    <!-- Tabla de facturas -->
    <section class="card table-card">
      <div class="card-title-row between">
        <div>
          <h2>Facturas registradas</h2>
          <p class="card-subtitle" id="table-subtitle">Sin facturas registradas.</p>
        </div>
        <div class="table-tools">
          <input type="search" id="search-input" class="filter-input search-input" placeholder="Buscar por número, descripción...">
          <button type="button" id="btn-export" class="btn btn-primary btn-sm">Exportar CSV</button>
          <button type="button" id="btn-clear" class="btn btn-ghost btn-sm">Vaciar todo</button>
        </div>
      </div>

      <!-- Filtros -->
      <div class="filters-row">
        <div class="filter-group">
          <label>Desde</label>
          <input type="date" id="filter-fecha-desde" class="filter-input">
        </div>
        <div class="filter-group">
          <label>Hasta</label>
          <input type="date" id="filter-fecha-hasta" class="filter-input">
        </div>
        <div class="filter-group">
          <label>Tipo Documento</label>
          <select id="filter-tipo-doc" class="filter-input">
            <option value="">Todos</option>
            <option value="Factura">Factura</option>
            <option value="Boleta">Boleta</option>
            <option value="Comprobante de Pago">Comprobante de Pago</option>
            <option value="Nota de crédito">Nota de crédito</option>
          </select>
        </div>
        <div class="filter-group">
          <label>Tipo Operación</label>
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
              <th class="actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody id="table-body">
            <tr class="row-empty"><td colspan="11">Aún no hay facturas registradas. Sube tu primera factura.</td></tr>
          </tbody>
        </table>
      </div>
      <p class="footer-summary" id="footer-summary"></p>
      <div class="footer-stats">
        <span id="stat-count">0</span> facturas · Total: <span id="stat-total">$0</span>
      </div>
    </section>
  </section>

  <!-- Sección: Plan de Cuentas -->
  <section class="tab-content" id="tab-plan-cuentas" hidden>
    <div class="card pc-card">
      <div class="card-title-row between">
        <div>
          <h2>Plan de Cuentas</h2>
          <p class="card-subtitle" id="pc-subtitle">Chart of accounts — Chilean PYME</p>
        </div>
        <div class="table-tools">
          <input type="search" id="pc-search" class="filter-input search-input" placeholder="Buscar cuenta...">
          <select id="pc-filter-class" class="filter-input">
            <option value="">Todas las clases</option>
            <option value="1">1 — Activo</option>
            <option value="2">2 — Pasivo</option>
            <option value="3">3 — Patrimonio</option>
            <option value="4">4 — Ingresos</option>
            <option value="5">5 — Costo</option>
            <option value="6">6 — Gastos</option>
            <option value="7">7 — Resultado No Op.</option>
          </select>
          <button type="button" id="pc-btn-add" class="btn btn-primary btn-sm">+ Agregar cuenta</button>
        </div>
      </div>

      <!-- Resumen -->
      <div class="pc-summary" id="pc-summary"></div>

      <!-- Árbol -->
      <div class="pc-tree-wrap">
        <div class="pc-tree" id="pc-tree"></div>
      </div>
    </div>
  </section>

  <!-- Modal: imagen ampliada -->
  <div class="modal-overlay" id="image-modal" hidden>
    <div class="modal-content">
      <button type="button" class="modal-close" id="close-image-modal">&times;</button>
      <img id="modal-img" alt="Factura ampliada">
    </div>
  </div>

  <!-- Modal: cámara -->
  <div class="camera-modal" id="camera-modal" hidden>
    <div class="camera-container">
      <video id="camera-video" autoplay playsinline></video>
      <canvas id="camera-canvas" hidden></canvas>
      <div class="camera-actions">
        <button type="button" id="btn-capture" class="btn btn-primary">Tomar foto</button>
        <button type="button" id="btn-retake" class="btn btn-ghost" hidden>Reintentar</button>
        <button type="button" id="btn-cancel-camera" class="btn btn-ghost">Cancelar</button>
        <button type="button" id="btn-accept-photo" class="btn btn-primary" hidden>Usar foto</button>
      </div>
    </div>
  </div>

  <!-- Modal: confirmar vaciar -->
  <div class="modal-overlay" id="confirm-modal" hidden>
    <div class="modal-content modal-sm">
      <h3>¿Vaciar todo?</h3>
      <p>Se eliminarán todas las facturas registradas. Esta acción no se puede deshacer.</p>
      <div class="form-actions">
        <button type="button" id="btn-confirm-clear" class="btn btn-primary">Sí, vaciar</button>
        <button type="button" id="btn-cancel-clear" class="btn btn-ghost">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- Modal: agregar/editar cuenta -->
  <div class="modal-overlay" id="pc-modal" hidden>
    <div class="modal-content modal-md">
      <div class="pc-modal-header">
        <h3 id="pc-modal-title">Agregar cuenta</h3>
        <button type="button" class="modal-close" id="pc-btn-close-modal">&times;</button>
      </div>
      <form id="pc-form" autocomplete="off">
        <div class="field">
          <label for="pc-f-code">Código</label>
          <input type="text" id="pc-f-code" placeholder="Ej: 6.1.04.01" required>
        </div>
        <div class="field">
          <label for="pc-f-name">Nombre</label>
          <input type="text" id="pc-f-name" placeholder="Nombre de la cuenta" required>
        </div>
        <div class="form-row form-row-3">
          <div class="field">
            <label for="pc-f-level">Nivel</label>
            <input type="number" id="pc-f-level" min="1" max="4" value="4">
          </div>
          <div class="field">
            <label for="pc-f-class">Clase</label>
            <select id="pc-f-class">
              <option value="1">1 — Activo</option>
              <option value="2">2 — Pasivo</option>
              <option value="3">3 — Patrimonio</option>
              <option value="4">4 — Ingresos</option>
              <option value="5">5 — Costo</option>
              <option value="6">6 — Gastos</option>
              <option value="7">7 — Resultado</option>
            </select>
          </div>
          <div class="field">
            <label for="pc-f-parent">Código padre</label>
            <input type="text" id="pc-f-parent" placeholder="Ej: 6.1.04">
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
            <label for="pc-f-clasif">Clasificación</label>
            <input type="text" id="pc-f-clasif" placeholder="Ej: Gastos de Administración">
          </div>
        </div>
        <div class="field">
          <label class="checkbox-label">
            <input type="checkbox" id="pc-f-imp"> Cuenta imputable (se puede cargar facturas)
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" id="pc-btn-save" class="btn btn-primary">Guardar</button>
          <button type="button" id="pc-btn-cancel" class="btn btn-ghost">Cancelar</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Modal: eliminar cuenta -->
  <div class="modal-overlay" id="pc-delete-modal" hidden>
    <div class="modal-content modal-sm">
      <h3>¿Eliminar esta cuenta?</h3>
      <p id="pc-delete-msg">Esta acción no se puede deshacer.</p>
      <div class="form-actions">
        <button type="button" id="pc-btn-confirm-delete" class="btn btn-primary">Eliminar</button>
        <button type="button" id="pc-btn-cancel-delete" class="btn btn-ghost">Cancelar</button>
      </div>
    </div>
  </div>

  <!-- Datos de usuario para JS -->
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
  <script src="https://cdn.jsdelivr.net/npm/cropperjs@1.6.2/dist/cropper.min.js"></script>
  <script src="js/app.js?v=15"></script>
  <script src="js/plan_cuentas.js?v=2"></script>

</body>
</html>
