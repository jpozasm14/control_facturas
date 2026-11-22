(function () {
  'use strict';

  var API_BASE = (window.__USER__ && window.__USER__.apiBase) || 'php/api/';
  var $ = function (id) { return document.getElementById(id); };

  var allCuentas = [];
  var allLineas = [];
  var els = {};

  // ---------------------------------------------------------------
  // API fetch
  // ---------------------------------------------------------------
  function apiFetch(endpoint) {
    return fetch(API_BASE + endpoint, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); });
  }

  // ---------------------------------------------------------------
  // Formateo
  // ---------------------------------------------------------------
  function fmtMoney(v) {
    if (v === 0 || v === null || v === undefined) return '—';
    var neg = v < 0;
    var abs = Math.abs(Math.round(v));
    var s = abs.toLocaleString('es-CL');
    return neg ? '(' + s + ')' : (v > 0 ? '$' + s : '—');
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  // ---------------------------------------------------------------
  // Cargar datos
  // ---------------------------------------------------------------
  function loadAll() {
    return Promise.all([
      apiFetch('cuentas.php'),
      apiFetch('libro_diario.php')
    ]).then(function (results) {
      allCuentas = (results[0].cuentas || []).slice();
      allLineas = (results[1].lineas || []).slice();
    }).catch(function (err) {
      console.error('Libro Mayor load error:', err);
      allCuentas = [];
      allLineas = [];
    });
  }

  // ---------------------------------------------------------------
  // Agrupar líneas por cuenta
  // ---------------------------------------------------------------
  function aggregateByAccount() {
    var map = {};
    for (var i = 0; i < allLineas.length; i++) {
      var ln = allLineas[i];
      var code = ln.cuenta_code;
      if (!map[code]) map[code] = { debe: 0, haber: 0 };
      map[code].debe += ln.debe || 0;
      map[code].haber += ln.haber || 0;
    }
    return map;
  }

  // ---------------------------------------------------------------
  // Construir jerarquía
  // ---------------------------------------------------------------
  function buildTree() {
    var tree = [];
    var map = {};

    allCuentas.sort(function (a, b) { return a.code.localeCompare(b.code); });

    for (var i = 0; i < allCuentas.length; i++) {
      var c = allCuentas[i];
      var node = { code: c.code, name: c.name, level: c.level, 'class': c['class'], imp: c.imp, parent: c.parent, children: [], debe: 0, haber: 0 };
      map[c.code] = node;
      if (!c.parent || c.parent === '') {
        tree.push(node);
      } else if (map[c.parent]) {
        map[c.parent].children.push(node);
      } else {
        tree.push(node);
      }
    }

    return { tree: tree, map: map };
  }

  // ---------------------------------------------------------------
  // Agregar montos a nodos hoja y propagar a padres
  // ---------------------------------------------------------------
  function propagateAmounts(nodes, agg) {
    var totalDebe = 0, totalHaber = 0;

    function visit(node) {
      var fromAgg = agg[node.code];
      if (node.imp && fromAgg) {
        node.debe = fromAgg.debe;
        node.haber = fromAgg.haber;
      }

      var childDebe = 0, childHaber = 0;
      for (var i = 0; i < node.children.length; i++) {
        var ch = visit(node.children[i]);
        childDebe += ch.debe;
        childHaber += ch.haber;
      }

      if (!node.imp) {
        node.debe = childDebe;
        node.haber = childHaber;
      }

      totalDebe += node.debe;
      totalHaber += node.haber;

      return { debe: node.debe, haber: node.haber };
    }

    for (var i = 0; i < nodes.length; i++) {
      visit(nodes[i]);
    }

    return { totalDebe: totalDebe, totalHaber: totalHaber };
  }

  // ---------------------------------------------------------------
  // Render tabla jerárquica
  // ---------------------------------------------------------------
  function renderTable() {
    var body = els.tableBody;
    if (!body) return;

    var agg = aggregateByAccount();
    var hierarchy = buildTree();
    var totals = propagateAmounts(hierarchy.tree, agg);

    var diff = Math.round(totals.totalDebe - totals.totalHaber);
    var isBalanced = Math.abs(diff) < 1;

    // Summary
    els.summary.innerHTML =
      '<div class="lm-sum-item"><div class="lm-sum-label">Total Debe</div><div class="lm-sum-value">' + fmtMoney(Math.round(totals.totalDebe)) + '</div></div>' +
      '<div class="lm-sum-item"><div class="lm-sum-label">Total Haber</div><div class="lm-sum-value">' + fmtMoney(Math.round(totals.totalHaber)) + '</div></div>' +
      '<div class="lm-sum-item"><div class="lm-sum-label">Diferencia</div><div class="lm-sum-value">' + fmtMoney(diff) + '</div></div>' +
      '<div class="lm-sum-item"><div class="lm-sum-label">Estado global</div><div class="lm-sum-value ' + (isBalanced ? 'lm-ok' : 'lm-err') + '">' + (isBalanced ? '&#10003; Cuadrado' : '&#10007; Descuadrado') + '</div></div>';

    // Tabla
    var classLabels = { '1': 'ACTIVOS', '2': 'PASIVOS', '3': 'PATRIMONIO', '4': 'INGRESOS', '5': 'GASTOS', '6': 'GASTOS OPERACIONALES', '7': 'RESULTADO NO OPERACIONAL' };
    var html = '';

    function renderNode(node, depth) {
      var saldo = node.debe - node.haber;
      var hasChildren = node.children.length > 0;

      if (node.level === 1) {
        // Fila de clase (ACTIVOS, PASIVOS, etc.)
        html += '<tr class="lm-row-class"><td colspan="2"><strong>' + node.code + ' &nbsp; ' + esc(classLabels[node.code] || node.name) + '</strong></td><td></td><td></td><td></td></tr>';
        for (var i = 0; i < node.children.length; i++) renderNode(node.children[i], depth + 1);
      } else if (node.level === 2) {
        // Fila de subgrupo
        html += '<tr class="lm-row-sub"><td>' + esc(node.code) + '</td><td><strong>' + esc(node.name) + '</strong></td><td></td><td></td><td></td></tr>';
        for (var i = 0; i < node.children.length; i++) renderNode(node.children[i], depth + 1);
      } else {
        // Cuenta detalle
        var saldoStr = fmtMoney(Math.round(saldo));
        html += '<tr>';
        html += '<td>' + esc(node.code) + '</td>';
        html += '<td' + (hasChildren ? ' class="lm-bold"' : '') + '>' + esc(node.name) + '</td>';
        html += '<td class="num">' + fmtMoney(Math.round(node.debe)) + '</td>';
        html += '<td class="num">' + fmtMoney(Math.round(node.haber)) + '</td>';
        html += '<td class="num">' + saldoStr + '</td>';
        html += '</tr>';
        if (hasChildren) {
          for (var i = 0; i < node.children.length; i++) renderNode(node.children[i], depth + 1);
        }
      }
    }

    for (var i = 0; i < hierarchy.tree.length; i++) {
      renderNode(hierarchy.tree[i], 0);
    }

    body.innerHTML = html;
  }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    els.tableBody = $('lm-table-body');
    els.summary = $('lm-summary');

    document.addEventListener('libro-mayor:refresh', function () {
      loadAll().then(function () { renderTable(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
