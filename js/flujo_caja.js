(function () {
  'use strict';

  var API_BASE = (window.__USER__ && window.__USER__.apiBase) || 'php/api/';
  var $ = function (id) { return document.getElementById(id); };

  var currentMonth = new Date().getMonth() + 1;
  var currentYear  = new Date().getFullYear();
  var currentMetodo = 'directo';
  var data = null;

  var els = {};

  function apiFetch(endpoint, opts) {
    opts = opts || {};
    var fetchOpts = { credentials: 'same-origin' };
    if (opts.method) fetchOpts.method = opts.method;
    if (opts.body) {
      fetchOpts.method = fetchOpts.method || 'POST';
      fetchOpts.headers = { 'Content-Type': 'application/json' };
      fetchOpts.body = JSON.stringify(opts.body);
    }
    return fetch(API_BASE + endpoint, fetchOpts).then(function (r) { return r.json(); });
  }

  function fmtMoney(v) {
    if (v === 0 || v === null || v === undefined) return '$0';
    var neg = v < 0;
    var abs = Math.abs(Math.round(v));
    var s = abs.toLocaleString('es-CL');
    return neg ? '($' + s + ')' : '$' + s;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ---------------------------------------------------------------
  // Cargar datos
  // ---------------------------------------------------------------
  function loadFlujo() {
    var params = '?mes=' + currentMonth + '&anio=' + currentYear + '&metodo=' + currentMetodo;
    apiFetch('flujo_caja.php' + params).then(function (res) {
      if (!res.ok) return;
      data = res;
      renderPeriodo();
      renderResumen();
      renderDetalles();
      renderAjustes();
    }).catch(function (err) {
      console.error('Flujo de caja error:', err);
    });
  }

  // ---------------------------------------------------------------
  // Renderizar período
  // ---------------------------------------------------------------
  function renderPeriodo() {
    if (!els.periodo) return;
    var meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    els.periodo.textContent = meses[currentMonth] + ' ' + currentYear;

    // Actualizar botones de método
    var btnDirecto = $('fc-btn-directo');
    var btnIndirecto = $('fc-btn-indirecto');
    if (btnDirecto && btnIndirecto) {
      btnDirecto.className = currentMetodo === 'directo' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
      btnIndirecto.className = currentMetodo === 'indirecto' ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm';
    }
  }

  // ---------------------------------------------------------------
  // Renderizar resumen
  // ---------------------------------------------------------------
  function renderResumen() {
    if (!data || !els.resumen) return;
    var f = data.flujo;

    var cards = [
      { label: 'Saldo Inicial', value: fmtMoney(f.saldo_inicial), color: 'var(--keys-blue)' },
      { label: 'Flujo Operacional', value: fmtMoney(f.operacional), color: f.operacional >= 0 ? '#16a34a' : '#e74c3c' },
      { label: 'Flujo Inversión', value: fmtMoney(f.inversion), color: f.inversion >= 0 ? '#16a34a' : '#e74c3c' },
      { label: 'Flujo Financiamiento', value: fmtMoney(f.financiamiento), color: f.financiamiento >= 0 ? '#16a34a' : '#e74c3c' },
      { label: 'Flujo Neto del Mes', value: fmtMoney(f.neto), color: f.neto >= 0 ? '#16a34a' : '#e74c3c', bold: true },
      { label: 'Saldo Final', value: fmtMoney(f.saldo_final), color: 'var(--keys-blue)', bold: true },
    ];

    var html = '';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div class="fc-card">' +
        '<div class="fc-card-label">' + esc(c.label) + '</div>' +
        '<div class="fc-card-value' + (c.bold ? ' fc-bold' : '') + '" style="color:' + c.color + '">' + c.value + '</div>' +
      '</div>';
    }
    els.resumen.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Renderizar detalles
  // ---------------------------------------------------------------
  function renderDetalles() {
    if (!data || !els.detalles) return;
    var d = data.detalles;

    var html = '<div class="fc-details-grid">';

    if (currentMetodo === 'directo') {
      html += '<div class="fc-detail-item"><span class="fc-detail-label">Ingresos Operacionales</span><span class="fc-detail-value">' + fmtMoney(d.ingresos_operacionales) + '</span></div>';
      html += '<div class="fc-detail-item"><span class="fc-detail-label">Egresos Operacionales</span><span class="fc-detail-value">' + fmtMoney(d.egresos_operacionales) + '</span></div>';
      html += '<div class="fc-detail-item"><span class="fc-detail-label">Inversiones Netas</span><span class="fc-detail-value">' + fmtMoney(d.inversiones_netas) + '</span></div>';
      html += '<div class="fc-detail-item"><span class="fc-detail-label">Financiamiento Neto</span><span class="fc-detail-value">' + fmtMoney(d.financiamiento_neto) + '</span></div>';
    } else {
      html += '<div class="fc-detail-item"><span class="fc-detail-label">Utilidad Neta</span><span class="fc-detail-value">' + fmtMoney(d.utilidad_neta) + '</span></div>';
      html += '<div class="fc-detail-item"><span class="fc-detail-label">(+) Depreciación</span><span class="fc-detail-value">' + fmtMoney(d.depreciacion) + '</span></div>';
      html += '<div class="fc-detail-item"><span class="fc-detail-label">(+) Variación Cap. Trabajo</span><span class="fc-detail-value">' + fmtMoney(d.var_capital_trabajo) + '</span></div>';
      html += '<div class="fc-detail-item"><span class="fc-detail-label">(+) Ajustes Manuales</span><span class="fc-detail-value">' + fmtMoney(d.ajustes_manuales) + '</span></div>';
    }

    html += '</div>';
    els.detalles.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Renderizar ajustes manuales
  // ---------------------------------------------------------------
  function renderAjustes() {
    if (!data || !els.ajustesList) return;
    var ajustes = data.ajustes || [];

    if (ajustes.length === 0) {
      els.ajustesList.innerHTML = '<div class="fc-empty">Sin ajustes manuales este período.</div>';
      return;
    }

    var html = '<table class="invoice-table fc-table"><thead><tr>' +
      '<th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Clasificación</th><th class="num">Monto</th><th class="actions-col">Acciones</th>' +
    '</tr></thead><tbody>';

    var clasifLabels = { 'operacional': 'Operacional', 'inversion': 'Inversión', 'financiamiento': 'Financiamiento' };
    for (var i = 0; i < ajustes.length; i++) {
      var a = ajustes[i];
      html += '<tr>' +
        '<td class="fecha-cell">' + esc(a.fecha) + '</td>' +
        '<td>' + esc(a.concepto) + '</td>' +
        '<td><span class="fc-badge fc-badge-' + a.tipo + '">' + (a.tipo === 'ingreso' ? 'Ingreso' : 'Egreso') + '</span></td>' +
        '<td>' + esc(clasifLabels[a.clasificacion] || a.clasificacion) + '</td>' +
        '<td class="num monto-cell">' + fmtMoney(a.tipo === 'ingreso' ? a.monto : -a.monto) + '</td>' +
        '<td class="actions-col"><div class="row-actions">' +
          '<button type="button" class="icon-btn fc-edit-ajuste" data-id="' + a.id + '" title="Editar">&#9998;</button>' +
          '<button type="button" class="icon-btn danger fc-del-ajuste" data-id="' + a.id + '" title="Eliminar">&#128465;</button>' +
        '</div></td>' +
      '</tr>';
    }
    html += '</tbody></table>';
    els.ajustesList.innerHTML = html;

    // Bind edit/delete
    var editBtns = els.ajustesList.querySelectorAll('.fc-edit-ajuste');
    for (var j = 0; j < editBtns.length; j++) {
      editBtns[j].addEventListener('click', function () {
        openAjusteModal(parseInt(this.dataset.id));
      });
    }
    var delBtns = els.ajustesList.querySelectorAll('.fc-del-ajuste');
    for (var k = 0; k < delBtns.length; k++) {
      delBtns[k].addEventListener('click', function () {
        deleteAjuste(parseInt(this.dataset.id));
      });
    }
  }

  // ---------------------------------------------------------------
  // Modal de ajuste
  // ---------------------------------------------------------------
  function openAjusteModal(editId) {
    if (!els.modal || !els.modalForm) return;
    var item = null;
    if (editId && data && data.ajustes) {
      for (var i = 0; i < data.ajustes.length; i++) {
        if (data.ajustes[i].id === editId) { item = data.ajustes[i]; break; }
      }
    }

    els.modalTitle.textContent = item ? 'Editar Ajuste' : 'Nuevo Ajuste';
    $('fc-f-id').value = item ? item.id : '';
    $('fc-f-fecha').value = item ? item.fecha : currentYear + '-' + String(currentMonth).padStart(2, '0') + '-01';
    $('fc-f-concepto').value = item ? item.concepto : '';
    $('fc-f-tipo').value = item ? item.tipo : 'egreso';
    $('fc-f-monto').value = item ? Math.abs(item.monto) : '';
    $('fc-f-clasificacion').value = item ? item.clasificacion : 'operacional';
    $('fc-f-notas').value = item ? item.notas : '';

    els.modal.hidden = false;
  }

  function closeAjusteModal() {
    if (els.modal) els.modal.hidden = true;
  }

  function saveAjuste() {
    var id           = $('fc-f-id').value;
    var fecha        = $('fc-f-fecha').value;
    var concepto     = $('fc-f-concepto').value.trim();
    var tipo         = $('fc-f-tipo').value;
    var monto        = parseFloat($('fc-f-monto').value) || 0;
    var clasificacion = $('fc-f-clasificacion').value;
    var notas        = $('fc-f-notas').value.trim();

    if (!fecha) { alert('La fecha es obligatoria'); return; }
    if (!concepto) { alert('El concepto es obligatorio'); return; }
    if (monto === 0) { alert('El monto no puede ser cero'); return; }

    var payload = { fecha: fecha, concepto: concepto, tipo: tipo, monto: monto, clasificacion: clasificacion, notas: notas };

    if (id) {
      payload.id = parseInt(id);
      apiFetch('flujo_caja.php', { method: 'PUT', body: payload }).then(function (res) {
        if (res.ok) { closeAjusteModal(); loadFlujo(); }
        else { alert(res.error || 'Error al guardar'); }
      });
    } else {
      apiFetch('flujo_caja.php', { method: 'POST', body: payload }).then(function (res) {
        if (res.ok) { closeAjusteModal(); loadFlujo(); }
        else { alert(res.error || 'Error al guardar'); }
      });
    }
  }

  function deleteAjuste(id) {
    if (!confirm('¿Eliminar este ajuste?')) return;
    apiFetch('flujo_caja.php', { method: 'DELETE', body: { id: id } }).then(function (res) {
      if (res.ok) loadFlujo();
      else { alert(res.error || 'Error al eliminar'); }
    });
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    els.resumen    = $('fc-resumen');
    els.detalles   = $('fc-detalles');
    els.ajustesList = $('fc-ajustes-list');
    els.periodo    = $('fc-periodo');
    els.modal      = $('fc-modal');
    els.modalForm  = $('fc-ajuste-form');
    els.modalTitle = $('fc-modal-title');

    // Navegación período
    var btnPrev = $('fc-prev');
    var btnNext = $('fc-next');
    if (btnPrev) {
      btnPrev.addEventListener('click', function () {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        loadFlujo();
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', function () {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        loadFlujo();
      });
    }

    // Toggle método
    var btnDirecto = $('fc-btn-directo');
    var btnIndirecto = $('fc-btn-indirecto');
    if (btnDirecto) {
      btnDirecto.addEventListener('click', function () {
        currentMetodo = 'directo';
        loadFlujo();
      });
    }
    if (btnIndirecto) {
      btnIndirecto.addEventListener('click', function () {
        currentMetodo = 'indirecto';
        loadFlujo();
      });
    }

    // Nuevo ajuste
    var btnNew = $('fc-btn-new');
    if (btnNew) {
      btnNew.addEventListener('click', function () { openAjusteModal(null); });
    }

    // Modal
    var btnSave = $('fc-btn-save');
    var btnCancel = $('fc-btn-cancel');
    var btnClose = $('fc-modal-close');
    if (btnSave) btnSave.addEventListener('click', saveAjuste);
    if (btnCancel) btnCancel.addEventListener('click', closeAjusteModal);
    if (btnClose) btnClose.addEventListener('click', closeAjusteModal);

    // Cerrar modal al hacer clic fuera
    if (els.modal) {
      els.modal.addEventListener('click', function (e) {
        if (e.target === els.modal) closeAjusteModal();
      });
    }

    document.addEventListener('flujo-caja:refresh', function () {
      loadFlujo();
    });

    loadFlujo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
