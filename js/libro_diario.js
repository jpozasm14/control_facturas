/**
 * libro_diario.js — Gestión del Libro Diario
 * KeysCITI — Control de Facturas
 */
(function () {
  'use strict';

  var API_BASE = (window.__USER__ && window.__USER__.apiBase) || 'php/api/';
  var $ = function (id) { return document.getElementById(id); };
  var PAGE_SIZE = 5;
  var currentPage = 0;
  var cuentas = [];

  var els = {};
  var allLineas = [];

  // ---------------------------------------------------------------
  // API fetch
  // ---------------------------------------------------------------
  function apiFetch(endpoint, options) {
    options = options || {};
    options.credentials = 'same-origin';
    if (!options.headers) options.headers = {};
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    return fetch(API_BASE + endpoint, options).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Error del servidor');
        return data;
      });
    });
  }

  // ---------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || v === '' || v === 0) return '$0';
    var n = Number(v);
    if (isNaN(n)) return '$0';
    return '$' + n.toLocaleString('es-CL');
  }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // ---------------------------------------------------------------
  // Cargar cuentas imputables
  // ---------------------------------------------------------------
  function loadCuentas() {
    return apiFetch('cuentas.php').then(function (data) {
      var all = data.cuentas || [];
      cuentas = all.filter(function (a) { return a.imp; });
      cuentas.sort(function (a, b) { return a.code.localeCompare(b.code); });
    }).catch(function () { cuentas = []; });
  }

  // ---------------------------------------------------------------
  // Cargar líneas del libro diario
  // ---------------------------------------------------------------
  function loadAll() {
    return apiFetch('libro_diario.php').then(function (data) {
      allLineas = data.lineas || [];
      return allLineas;
    }).catch(function (err) {
      console.error('loadAll LD error:', err);
      allLineas = [];
      return allLineas;
    });
  }

  // ---------------------------------------------------------------
  // Render tabla
  // ---------------------------------------------------------------
  function renderTable() {
    var body = els.tableBody;

    if (allLineas.length === 0) {
      body.innerHTML = '<tr class="row-empty"><td colspan="9">Aún no hay asientos registrados. Crea tu primer asiento.</td></tr>';
      renderPagination(0);
      els.footerSummary.textContent = '';
      return;
    }

    // Agrupar por asiento_num
    var asientos = [];
    var currentNum = null;
    for (var a = 0; a < allLineas.length; a++) {
      if (allLineas[a].asiento_num !== currentNum) {
        currentNum = allLineas[a].asiento_num;
        asientos.push({ num: currentNum, lines: [] });
      }
      asientos[asientos.length - 1].lines.push(allLineas[a]);
    }

    var totalAsientos = asientos.length;
    var totalPages = Math.max(1, Math.ceil(totalAsientos / PAGE_SIZE));
    if (currentPage >= totalPages) currentPage = totalPages - 1;
    if (currentPage < 0) currentPage = 0;

    var startAsiento = currentPage * PAGE_SIZE;
    var endAsiento = Math.min(startAsiento + PAGE_SIZE, totalAsientos);
    var pageAsientos = asientos.slice(startAsiento, endAsiento);

    // Aplanar líneas de los asientos de esta página
    var pageList = [];
    for (var p = 0; p < pageAsientos.length; p++) {
      for (var q = 0; q < pageAsientos[p].lines.length; q++) {
        pageList.push(pageAsientos[p].lines[q]);
      }
    }

    var html = '';
    var i = 0;

    while (i < pageList.length) {
      var r = pageList[i];
      var num = r.asiento_num;

      var lineCount = 1;
      while (i + lineCount < pageList.length && pageList[i + lineCount].asiento_num === num) {
        lineCount++;
      }

      var totD = 0, totH = 0;
      for (var k = 0; k < lineCount; k++) {
        totD += pageList[i + k].debe || 0;
        totH += pageList[i + k].haber || 0;
      }
      var isBalanced = Math.abs(totD - totH) < 0.01;
      var estadoHtml = isBalanced
        ? '<span class="ld-status ld-ok">&#10003; Cuadrado</span>'
        : '<span class="ld-status ld-err">&#10007; Descuadrado</span>';

      if (i > 0) html += '<tr class="ld-row-sep">';

      for (var j = 0; j < lineCount; j++) {
        var ln = pageList[i + j];
        var isFirst = (j === 0);

        if (lineCount > 1 && isFirst) {
          html += '<td class="ld-asiento-cell" rowspan="' + lineCount + '"><strong>' + num + '</strong></td>';
          html += '<td rowspan="' + lineCount + '">' + esc(ln.fecha) + '</td>';
          html += '<td class="desc-cell" rowspan="' + lineCount + '"><p title="' + esc(ln.glosa || '') + '">' + esc(ln.glosa || '—') + '</p></td>';
        } else if (lineCount <= 1) {
          html += '<td class="ld-asiento-cell"><strong>' + num + '</strong></td>';
          html += '<td>' + esc(ln.fecha) + '</td>';
          html += '<td class="desc-cell"><p title="' + esc(ln.glosa || '') + '">' + esc(ln.glosa || '—') + '</p></td>';
        }

        html += '<td>' + esc(ln.cuenta_code) + '</td>';
        html += '<td class="desc-cell"><p title="' + esc(ln.cuenta_name) + '">' + esc(ln.cuenta_name) + '</p></td>';

        html += '<td class="num monto-cell">' + fmtMoney(ln.debe) + '</td>';
        html += '<td class="num monto-cell">' + fmtMoney(ln.haber) + '</td>';

        if (lineCount > 1 && isFirst) {
          html += '<td class="ld-center" rowspan="' + lineCount + '">' + estadoHtml + '</td>';
          html += '<td class="actions-col ld-center" rowspan="' + lineCount + '"><div class="row-actions">';
          html += '<button type="button" class="icon-btn" data-action="edit-asiento" title="Editar asiento" data-asiento="' + num + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>';
          html += '<button type="button" class="icon-btn danger" data-action="del-asiento" title="Eliminar asiento" data-asiento="' + num + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
          html += '</div></td>';
        } else if (lineCount <= 1) {
          html += '<td class="ld-center">' + estadoHtml + '</td>';
          html += '<td class="actions-col ld-center"><div class="row-actions">';
          html += '<button type="button" class="icon-btn" data-action="edit-asiento" title="Editar asiento" data-asiento="' + num + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg></button>';
          html += '<button type="button" class="icon-btn danger" data-action="del-asiento" title="Eliminar asiento" data-asiento="' + num + '"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>';
          html += '</div></td>';
        }

        html += '</tr>';
      }

      i += lineCount;
    }

    body.innerHTML = html;
    renderPagination(totalPages);

    var firstA = currentPage * PAGE_SIZE + 1;
    var lastA = Math.min((currentPage + 1) * PAGE_SIZE, totalAsientos);
    els.footerSummary.textContent = 'Mostrando asientos ' + firstA + '–' + lastA + ' de ' + totalAsientos + ' (' + allLineas.length + ' líneas)';
  }

  // ---------------------------------------------------------------
  // Paginación
  // ---------------------------------------------------------------
  function renderPagination(totalPages) {
    var container = els.pagination;
    if (!container) return;
    if (totalPages <= 1) { container.innerHTML = ''; return; }

    var prevDisabled = currentPage === 0 ? ' disabled' : '';
    var nextDisabled = currentPage >= totalPages - 1 ? ' disabled' : '';

    var html = '<button type="button" class="page-btn' + prevDisabled + '" data-page="prev">&laquo;</button>';
    var startPage = Math.max(0, currentPage - 2);
    var endPage = Math.min(totalPages, startPage + 5);
    if (endPage - startPage < 5) startPage = Math.max(0, endPage - 5);

    for (var p = startPage; p < endPage; p++) {
      var active = p === currentPage ? ' active' : '';
      html += '<button type="button" class="page-btn' + active + '" data-page="' + p + '">' + (p + 1) + '</button>';
    }
    html += '<button type="button" class="page-btn' + nextDisabled + '" data-page="next">&raquo;</button>';
    container.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Refresh
  // ---------------------------------------------------------------
  function refresh() {
    return loadAll().then(function () {
      currentPage = 0;
      renderTable();
    });
  }

  // ---------------------------------------------------------------
  // Modal — líneas del asiento
  // ---------------------------------------------------------------
  var lineCount = 0;

  function addLine(cuentaCode, debe, haber) {
    lineCount++;
    var idx = lineCount;
    var div = document.createElement('div');
    div.className = 'ld-line';
    div.setAttribute('data-idx', idx);

    var selectOpts = '<option value="">— Seleccionar cuenta —</option>';
    for (var i = 0; i < cuentas.length; i++) {
      var c = cuentas[i];
      var sel = c.code === cuentaCode ? ' selected' : '';
      selectOpts += '<option value="' + esc(c.code) + '"' + sel + '>' + esc(c.code) + ' — ' + esc(c.name) + '</option>';
    }

    div.innerHTML =
      '<select class="ld-line-cuenta">' + selectOpts + '</select>' +
      '<input type="text" class="ld-line-debe money-input" placeholder="$ Debe" inputmode="numeric" value="' + (debe || '') + '">' +
      '<input type="text" class="ld-line-haber money-input" placeholder="$ Haber" inputmode="numeric" value="' + (haber || '') + '">' +
      '<button type="button" class="icon-btn danger ld-remove-line" title="Quitar línea"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';

    els.ldLines.appendChild(div);
    bindLineEvents(div);
    updateTotals();
  }

  function bindLineEvents(div) {
    div.querySelector('.ld-remove-line').addEventListener('click', function () {
      div.remove();
      updateTotals();
    });
    div.querySelector('.ld-line-debe').addEventListener('input', function () {
      var h = div.querySelector('.ld-line-haber');
      if (this.value) h.value = '';
      updateTotals();
    });
    div.querySelector('.ld-line-haber').addEventListener('input', function () {
      var d = div.querySelector('.ld-line-debe');
      if (this.value) d.value = '';
      updateTotals();
    });
  }

  function updateTotals() {
    var totalD = 0, totalH = 0;
    var lines = els.ldLines.querySelectorAll('.ld-line');
    lines.forEach(function (line) {
      totalD += parseMoneyInput(line.querySelector('.ld-line-debe').value);
      totalH += parseMoneyInput(line.querySelector('.ld-line-haber').value);
    });
    els.ldTotalDebe.textContent = fmtMoney(totalD);
    els.ldTotalHaber.textContent = fmtMoney(totalH);

    var statusEl = els.ldBalanceStatus;
    if (lines.length === 0) {
      statusEl.innerHTML = '';
    } else if (Math.abs(totalD - totalH) < 0.01 && totalD > 0) {
      statusEl.innerHTML = '<span class="ld-status ld-ok">&#10003; Cuadrado</span>';
    } else {
      statusEl.innerHTML = '<span class="ld-status ld-err">&#10007; Descuadrado</span>';
    }
  }

  function parseMoneyInput(s) {
    if (!s) return 0;
    var cleaned = s.replace(/[^0-9]/g, '');
    return cleaned ? parseInt(cleaned, 10) : 0;
  }

  function formatMoneyInput(el) {
    el.addEventListener('input', function () {
      var raw = this.value.replace(/[^0-9]/g, '');
      if (raw) {
        this.value = parseInt(raw, 10).toLocaleString('es-CL');
      }
    });
    el.addEventListener('focus', function () {
      this.select();
    });
  }

  function resetModal() {
    els.ldFecha.value = todayStr();
    els.ldGlosa.value = '';
    els.ldLines.innerHTML = '';
    lineCount = 0;
    addLine();
    addLine();
    updateTotals();
  }

  // ---------------------------------------------------------------
  // Editar asiento
  // ---------------------------------------------------------------
  var editingAsientoNum = null;

  function openEditAsiento(num) {
    var lineas = allLineas.filter(function (l) { return l.asiento_num === num; });
    if (lineas.length === 0) return;
    editingAsientoNum = num;

    els.ldFecha.value = lineas[0].fecha || todayStr();
    els.ldGlosa.value = lineas[0].glosa || '';
    els.ldLines.innerHTML = '';
    lineCount = 0;
    for (var i = 0; i < lineas.length; i++) {
      addLine(lineas[i].cuenta_code, lineas[i].debe || 0, lineas[i].haber || 0);
    }
    updateTotals();
    els.ldBtnSave.textContent = 'Actualizar asiento';
    els.ldModal.hidden = false;
  }

  // ---------------------------------------------------------------
  // Guardar asiento
  // ---------------------------------------------------------------
  function saveAsiento() {
    var fecha = els.ldFecha.value;
    var glosa = els.ldGlosa.value.trim();
    var lineElements = els.ldLines.querySelectorAll('.ld-line');

    if (!fecha) { alert('La fecha es obligatoria'); return; }
    if (lineElements.length < 2) { alert('Debe haber al menos 2 líneas'); return; }

    var lineas = [];
    for (var i = 0; i < lineElements.length; i++) {
      var line = lineElements[i];
      var code = line.querySelector('.ld-line-cuenta').value;
      var debe = parseMoneyInput(line.querySelector('.ld-line-debe').value);
      var haber = parseMoneyInput(line.querySelector('.ld-line-haber').value);
      if (!code) { alert('Selecciona una cuenta en la línea ' + (i + 1)); return; }
      if (debe === 0 && haber === 0) { alert('Ingresa un monto en la línea ' + (i + 1)); return; }
      lineas.push({ cuenta_code: code, debe: debe, haber: haber });
    }

    var method = editingAsientoNum ? 'PUT' : 'POST';
    var body = { fecha: fecha, glosa: glosa, lineas: lineas };
    if (editingAsientoNum) body.asiento_num = editingAsientoNum;

    apiFetch('libro_diario.php', {
      method: method,
      body: body
    }).then(function (result) {
      els.ldModal.hidden = true;
      editingAsientoNum = null;
      els.ldBtnSave.textContent = 'Guardar asiento';
      refresh();
    }).catch(function (err) {
      alert(err.message || 'Error al guardar asiento');
    });
  }

  // ---------------------------------------------------------------
  // Eliminar asiento
  // ---------------------------------------------------------------
  var pendingDeleteAsiento = null;

  function confirmDeleteAsiento(num) {
    pendingDeleteAsiento = num;
    els.ldConfirmMsg.textContent = '¿Eliminar el asiento N° ' + num + '? Esta acción no se puede deshacer.';
    els.ldConfirmModal.hidden = false;
  }

  function doDeleteAsiento() {
    if (!pendingDeleteAsiento) return;
    var num = pendingDeleteAsiento;
    pendingDeleteAsiento = null;
    els.ldConfirmModal.hidden = true;

    apiFetch('libro_diario.php', {
      method: 'DELETE',
      body: { asiento_num: num }
    }).then(function () {
      refresh();
    }).catch(function (err) {
      alert(err.message || 'Error al eliminar');
    });
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    els.tableBody = $('ld-table-body');
    els.pagination = $('ld-pagination');
    els.footerSummary = $('ld-footer-summary');
    els.btnNew = $('ld-btn-new');
    els.ldModal = $('ld-modal');
    els.ldModalClose = $('ld-modal-close');
    els.ldForm = $('ld-form');
    els.ldFecha = $('ld-f-fecha');
    els.ldGlosa = $('ld-f-glosa');
    els.ldLines = $('ld-lines');
    els.ldAddLine = $('ld-add-line');
    els.ldTotalDebe = $('ld-total-debe');
    els.ldTotalHaber = $('ld-total-haber');
    els.ldBalanceStatus = $('ld-balance-status');
    els.ldBtnSave = $('ld-btn-save');
    els.ldBtnCancel = $('ld-btn-cancel');
    els.ldConfirmModal = $('ld-confirm-modal');
    els.ldConfirmMsg = $('ld-confirm-msg');
    els.ldBtnConfirmDel = $('ld-btn-confirm-del');

    // Nuevo asiento
    els.btnNew.addEventListener('click', function () {
      resetModal();
      els.ldModal.hidden = false;
    });

    // Cerrar modal
    els.ldModalClose.addEventListener('click', function () { els.ldModal.hidden = true; editingAsientoNum = null; els.ldBtnSave.textContent = 'Guardar asiento'; });
    els.ldBtnCancel.addEventListener('click', function () { els.ldModal.hidden = true; editingAsientoNum = null; els.ldBtnSave.textContent = 'Guardar asiento'; });
    els.ldModal.addEventListener('click', function (e) { if (e.target === els.ldModal) els.ldModal.hidden = true; });

    // Agregar línea
    els.ldAddLine.addEventListener('click', function () { addLine(); });

    // Guardar
    els.ldBtnSave.addEventListener('click', saveAsiento);

    // Eliminar asiento (delegación)
    els.tableBody.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.getAttribute('data-action') === 'del-asiento') {
        var num = parseInt(btn.getAttribute('data-asiento'), 10);
        if (num) confirmDeleteAsiento(num);
      } else if (btn.getAttribute('data-action') === 'edit-asiento') {
        var num = parseInt(btn.getAttribute('data-asiento'), 10);
        if (num) openEditAsiento(num);
      }
    });

    // Confirmar eliminación
    els.ldBtnConfirmDel.addEventListener('click', doDeleteAsiento);
    els.ldConfirmModal.addEventListener('click', function (e) {
      if (e.target.classList.contains('ld-close-confirm') || e.target === els.ldConfirmModal) {
        els.ldConfirmModal.hidden = true;
        pendingDeleteAsiento = null;
      }
    });

    // Paginación
    els.pagination.addEventListener('click', function (e) {
      var btn = e.target.closest('.page-btn');
      if (!btn || btn.disabled) return;
      var action = btn.getAttribute('data-page');
      if (action === 'prev') { currentPage--; }
      else if (action === 'next') { currentPage++; }
      else { currentPage = parseInt(action, 10) || 0; }
      renderTable();
    });

    // Formatear inputs de dinero
    document.querySelectorAll('.ld-line-debe, .ld-line-haber').forEach(formatMoneyInput);

    // Cargar datos iniciales
    loadCuentas().then(function () {
      return refresh();
    });

    // Escuchar refresh desde otros módulos (app.js al guardar factura)
    document.addEventListener('libro-diario:refresh', function () {
      refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
