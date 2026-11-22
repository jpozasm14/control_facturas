(function () {
  'use strict';

  var API_BASE = (window.__USER__ && window.__USER__.apiBase) || 'php/api/';
  var $ = function (id) { return document.getElementById(id); };

  var currentMonth = new Date().getMonth() + 1;
  var currentYear  = new Date().getFullYear();
  var data = null;

  var els = {};

  function apiFetch(endpoint) {
    return fetch(API_BASE + endpoint, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); });
  }

  function fmtMoney(v) {
    if (v === 0 || v === null || v === undefined) return '$0';
    var neg = v < 0;
    var abs = Math.abs(Math.round(v));
    var s = abs.toLocaleString('es-CL');
    return neg ? '($' + s + ')' : '$' + s;
  }

  function fmtPct(v) {
    return v != null ? v.toFixed(1) + '%' : '—';
  }

  function fmtRatio(v) {
    return v != null ? v.toFixed(2) : '—';
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ---------------------------------------------------------------
  // Cargar datos
  // ---------------------------------------------------------------
  function loadDashboard() {
    var params = '?mes=' + currentMonth + '&anio=' + currentYear;
    apiFetch('dashboard.php' + params).then(function (res) {
      if (!res.ok) return;
      data = res;
      renderKPIs();
      renderRatios();
      renderGraficos();
      renderPeriodo();
    }).catch(function (err) {
      console.error('Dashboard error:', err);
    });
  }

  // ---------------------------------------------------------------
  // Renderizar período
  // ---------------------------------------------------------------
  function renderPeriodo() {
    if (!els.periodo) return;
    var meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    els.periodo.textContent = meses[currentMonth] + ' ' + currentYear;
  }

  // ---------------------------------------------------------------
  // Renderizar KPIs
  // ---------------------------------------------------------------
  function renderKPIs() {
    if (!data || !els.kpis) return;
    var k = data.kpis;

    var cards = [
      { label: 'Facturas mes', value: k.facturas_mes, icon: '&#128196;', color: 'var(--keys-blue)' },
      { label: 'Ventas Netas', value: fmtMoney(k.ventas_neto), icon: '&#128176;', color: '#16a34a' },
      { label: 'Compras Netas', value: fmtMoney(k.compras_neto), icon: '&#128722;', color: '#e67e22' },
      { label: 'IVA Débito Fiscal', value: fmtMoney(k.iva_debito_fiscal), icon: '&#128202;', color: 'var(--keys-blue-soft)' },
      { label: 'IVA Crédito Fiscal', value: fmtMoney(k.iva_credito_fiscal), icon: '&#128202;', color: '#e74c3c' },
      { label: 'Saldo IVA', value: fmtMoney(k.iva_saldo), icon: '&#128176;', color: k.iva_saldo >= 0 ? '#16a34a' : '#e74c3c' },
      { label: 'Utilidad Bruta', value: fmtMoney(k.utilidad_bruta), icon: '&#128200;', color: '#16a34a' },
      { label: 'Utilidad Neta', value: fmtMoney(k.utilidad_neta), icon: '&#128200;', color: k.utilidad_neta >= 0 ? '#16a34a' : '#e74c3c' },
      { label: 'Saldo Caja', value: fmtMoney(k.saldo_caja), icon: '&#128176;', color: 'var(--keys-blue)' },
      { label: 'Total Facturas', value: k.facturas_total, icon: '&#128196;', color: 'var(--text-soft)' },
    ];

    var html = '';
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i];
      html += '<div class="dash-kpi-card">' +
        '<div class="dash-kpi-icon" style="color:' + c.color + '">' + c.icon + '</div>' +
        '<div class="dash-kpi-info">' +
          '<div class="dash-kpi-label">' + esc(c.label) + '</div>' +
          '<div class="dash-kpi-value" style="color:' + c.color + '">' + c.value + '</div>' +
        '</div>' +
      '</div>';
    }
    els.kpis.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Renderizar Ratios
  // ---------------------------------------------------------------
  function renderRatios() {
    if (!data || !els.ratios) return;
    var r = data.ratios;

    var ratioCards = [
      {
        label: 'Razón Corriente',
        value: fmtRatio(r.razon_corriente),
        desc: 'Activo / Pasivo — mide liquidez a corto plazo',
        ok: r.razon_corriente >= 1
      },
      {
        label: 'Nivel de Endeudamiento',
        value: fmtPct(r.nivel_endeudamiento),
        desc: 'Pasivos / Activos — porcentaje financiado con deuda',
        ok: r.nivel_endeudamiento < 60
      },
      {
        label: 'ROA',
        value: fmtPct(r.roa),
        desc: 'Utilidad Neta / Activos — rentabilidad de activos',
        ok: r.roa > 0
      },
      {
        label: 'Activos',
        value: fmtMoney(r.activos),
        desc: 'Total activos acumulados',
        ok: true
      },
      {
        label: 'Pasivos',
        value: fmtMoney(r.pasivos),
        desc: 'Total pasivos acumulados',
        ok: true
      },
      {
        label: 'Patrimonio',
        value: fmtMoney(r.patrimonio),
        desc: 'Patrimonio neto',
        ok: r.patrimonio >= 0
      }
    ];

    var html = '';
    for (var i = 0; i < ratioCards.length; i++) {
      var rc = ratioCards[i];
      var statusClass = rc.ok ? 'dash-ratio-ok' : 'dash-ratio-warn';
      html += '<div class="dash-ratio-card">' +
        '<div class="dash-ratio-header">' +
          '<span class="dash-ratio-label">' + esc(rc.label) + '</span>' +
          '<span class="dash-ratio-status ' + statusClass + '">' + (rc.ok ? '&#10003;' : '&#9888;') + '</span>' +
        '</div>' +
        '<div class="dash-ratio-value">' + rc.value + '</div>' +
        '<div class="dash-ratio-desc">' + esc(rc.desc) + '</div>' +
      '</div>';
    }
    els.ratios.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Renderizar Gráficos (barras CSS)
  // ---------------------------------------------------------------
  function renderGraficos() {
    if (!data || !els.graficos) return;
    var g = data.graficos;

    var maxVal = 0;
    for (var i = 0; i < g.ventas.length; i++) {
      var v = Math.abs(g.ventas[i].valor);
      var c = Math.abs(g.compras[i].valor);
      if (v > maxVal) maxVal = v;
      if (c > maxVal) maxVal = c;
    }
    if (maxVal === 0) maxVal = 1;

    var html = '<div class="dash-chart-container">';
    html += '<div class="dash-chart-legend"><span class="dash-legend-dot" style="background:#16a34a"></span> Ventas <span class="dash-legend-dot" style="background:#e67e22"></span> Compras</div>';

    for (var i = 0; i < g.ventas.length; i++) {
      var ventasVal = Math.abs(g.ventas[i].valor);
      var comprasVal = Math.abs(g.compras[i].valor);
      var vPct = (ventasVal / maxVal) * 100;
      var cPct = (comprasVal / maxVal) * 100;

      html += '<div class="dash-chart-row">' +
        '<div class="dash-chart-label">' + esc(g.ventas[i].mes) + '</div>' +
        '<div class="dash-chart-bars">' +
          '<div class="dash-bar-wrap">' +
            '<div class="dash-bar dash-bar-ventas" style="width:' + vPct + '%" title="Ventas: ' + fmtMoney(ventasVal) + '"></div>' +
          '</div>' +
          '<div class="dash-bar-wrap">' +
            '<div class="dash-bar dash-bar-compras" style="width:' + cPct + '%" title="Compras: ' + fmtMoney(comprasVal) + '"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    // Margen bruto
    html += '<div class="dash-chart-row">' +
      '<div class="dash-chart-label"><strong>Margen Bruto</strong></div>' +
      '<div class="dash-chart-bars">' +
        '<div class="dash-margin-bar">' +
          '<div class="dash-bar dash-bar-margin" style="width:' + Math.max(0, data.kpis.margen_bruto_pct) + '%"></div>' +
          '<span class="dash-margin-value">' + fmtPct(data.kpis.margen_bruto_pct) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';

    // Margen neto
    html += '<div class="dash-chart-row">' +
      '<div class="dash-chart-label"><strong>Margen Neto</strong></div>' +
      '<div class="dash-chart-bars">' +
        '<div class="dash-margin-bar">' +
          '<div class="dash-bar dash-bar-margin-n" style="width:' + Math.max(0, data.kpis.margen_neto_pct) + '%"></div>' +
          '<span class="dash-margin-value">' + fmtPct(data.kpis.margen_neto_pct) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';

    html += '</div>';
    els.graficos.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    els.kpis      = $('dash-kpis');
    els.ratios    = $('dash-ratios');
    els.graficos  = $('dash-graficos');
    els.periodo   = $('dash-periodo');
    els.btnPrev   = $('dash-prev');
    els.btnNext   = $('dash-next');

    if (els.btnPrev) {
      els.btnPrev.addEventListener('click', function () {
        currentMonth--;
        if (currentMonth < 1) { currentMonth = 12; currentYear--; }
        loadDashboard();
      });
    }
    if (els.btnNext) {
      els.btnNext.addEventListener('click', function () {
        currentMonth++;
        if (currentMonth > 12) { currentMonth = 1; currentYear++; }
        loadDashboard();
      });
    }

    document.addEventListener('dashboard:refresh', function () {
      loadDashboard();
    });

    // Cargar al inicio si el tab está activo
    loadDashboard();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
