<?php
// api/dashboard.php — Dashboard ejecutivo con KPIs, ratios y gráficos
// =====================================================
require_once __DIR__ . '/../config.php';
startSession();
requireLogin();

$userId = currentUserId();
$method = $_SERVER['REQUEST_METHOD'];

header('Content-Type: application/json; charset=utf-8');

if ($method !== 'GET') jsonError('Método no soportado', 405);

handleGet($userId);

// -----------------------------------------------------
// GET — Calcular KPIs, ratios y datos para gráficos
// -----------------------------------------------------
function handleGet(int $userId) {
  $pdo = db();

  // --- Mes actual (parámetros opcionales: mes, anio) ---
  $mes  = isset($_GET['mes'])  ? max(1, min(12, (int)$_GET['mes']))  : (int)date('n');
  $anio = isset($_GET['anio']) ? max(2000, min(2100, (int)$_GET['anio'])) : (int)date('Y');
  $fechaInicio = sprintf('%04d-%02d-01', $anio, $mes);
  $fechaFin    = date('Y-m-t', strtotime($fechaInicio));

  // Mes anterior para comparación
  $mesAnt = $mes === 1 ? 12 : $mes - 1;
  $anioAnt = $mes === 1 ? $anio - 1 : $anio;
  $fechaInicioAnt = sprintf('%04d-%02d-01', $anioAnt, $mesAnt);
  $fechaFinAnt    = date('Y-m-t', strtotime($fechaInicioAnt));

  // --- Helper: obtener total debe/haber por rango de fechas ---
  function getTotalesPorClase(int $userId, string $fi, string $ff, string $campoFecha): array {
    $stmt = db()->prepare(
      "SELECT pc.class, pc.code,
              SUM(CASE WHEN pc.nat = 'Deudora' THEN ld.debe ELSE 0 END) AS total_debe,
              SUM(CASE WHEN pc.nat = 'Deudora' THEN 0 ELSE ld.haber END) AS total_haber,
              SUM(ld.debe) AS debe_raw,
              SUM(ld.haber) AS haber_raw
       FROM libro_diario ld
       LEFT JOIN plan_cuentas pc ON pc.user_id = ld.user_id AND pc.code = ld.cuenta_code
       WHERE ld.user_id = ? AND ld.{$campoFecha} BETWEEN ? AND ?
       GROUP BY pc.class, pc.code
       ORDER BY pc.class, pc.code"
    );
    $stmt->execute([$userId, $fi, $ff]);
    return $stmt->fetchAll();
  }

  // --- Helper: total facturas por tipo operación y rango ---
  function getFacturasTotales(int $userId, string $fi, string $ff): array {
    $stmt = db()->prepare(
      "SELECT tipo_operacion,
              COUNT(*) AS cantidad,
              SUM(COALESCE(neto,0)) AS neto,
              SUM(COALESCE(iva,0)) AS iva,
              SUM(COALESCE(total,0)) AS total
       FROM facturas
       WHERE user_id = ? AND fecha != '' AND STR_TO_DATE(fecha, '%d/%m/%Y') BETWEEN ? AND ?
       GROUP BY tipo_operacion"
    );
    $stmt->execute([$userId, $fi, $ff]);
    $rows = $stmt->fetchAll();
    $result = ['Venta' => ['cantidad'=>0,'neto'=>0,'iva'=>0,'total'=>0], 'Compra' => ['cantidad'=>0,'neto'=>0,'iva'=>0,'total'=>0]];
    foreach ($rows as $r) {
      $op = $r['tipo_operacion'];
      if (isset($result[$op])) {
        $result[$op]['cantidad'] = (int)$r['cantidad'];
        $result[$op]['neto']     = (float)$r['neto'];
        $result[$op]['iva']      = (float)$r['iva'];
        $result[$op]['total']    = (float)$r['total'];
      }
    }
    return $result;
  }

  // --- Helper: obtener cuentas 1.1.x (caja/bancos) ---
  function getCajaBancos(int $userId): array {
    $stmt = db()->prepare(
      "SELECT code, name FROM plan_cuentas WHERE user_id = ? AND code LIKE '1.1.%' AND imp = 1 ORDER BY code"
    );
    $stmt->execute([$userId]);
    return $stmt->fetchAll();
  }

  // --- Helper: obtener saldos por código de cuenta ---
  function getSaldosPorCodigo(int $userId, array $codes): array {
    if (empty($codes)) return [];
    $placeholders = implode(',', array_fill(0, count($codes), '?'));
    $stmt = db()->prepare(
      "SELECT cuenta_code, SUM(debe) AS total_debe, SUM(haber) AS total_haber
       FROM libro_diario WHERE user_id = ? AND cuenta_code IN ({$placeholders})
       GROUP BY cuenta_code"
    );
    $params = array_merge([$userId], $codes);
    $stmt->execute($params);
    $map = [];
    while ($r = $stmt->fetch()) {
      $map[$r['cuenta_code']] = ['debe' => (float)$r['total_debe'], 'haber' => (float)$r['total_haber']];
    }
    return $map;
  }

  // --- 1. KPIs ---
  $facturasMes = getFacturasTotales($userId, $fechaInicio, $fechaFin);
  $facturasAnt = getFacturasTotales($userId, $fechaInicioAnt, $fechaFinAnt);

  // Contar facturas del mes
  $stmtCount = $pdo->prepare(
    "SELECT COUNT(*) FROM facturas WHERE user_id = ? AND fecha != '' AND STR_TO_DATE(fecha, '%d/%m/%Y') BETWEEN ? AND ?"
  );
  $stmtCount->execute([$userId, $fechaInicio, $fechaFin]);
  $totalFacturas = (int)$stmtCount->fetchColumn();

  // Total facturas globales
  $stmtTotal = $pdo->prepare("SELECT COUNT(*) FROM facturas WHERE user_id = ?");
  $stmtTotal->execute([$userId]);
  $totalFacturasGlobal = (int)$stmtTotal->fetchColumn();

  // Totales por clase para balance general
  $clasesMes = getTotalesPorClase($userId, $fechaInicio, $fechaFin, 'fecha');

  // Calcular IVA
  $ivaDebitoFiscal  = abs($facturasMes['Venta']['iva']);
  $ivaCreditoFiscal = abs($facturasMes['Compra']['iva']);
  $saldoIVA = $ivaDebitoFiscal - $ivaCreditoFiscal;

  // Ventas/Compras
  $ventasNeto  = abs($facturasMes['Venta']['neto']);
  $ventasTotal = abs($facturasMes['Venta']['total']);
  $comprasNeto = abs($facturasMes['Compra']['neto']);
  $comprasTotal = abs($facturasMes['Compra']['total']);

  // Utilidad bruta = Ventas neto - Costo de ventas (simplificado)
  $utilidadBruta = $ventasNeto - $comprasNeto;
  $margenBrutoPct = $ventasNeto > 0 ? round(($utilidadBruta / $ventasNeto) * 100, 1) : 0;

  // Utilidad neta (simplificada: ingresos - costos - gastos)
  $ingresos  = 0;
  $costos    = 0;
  $gastos    = 0;
  foreach ($clasesMes as $r) {
    $cl = $r['class'];
    $neto = (float)$r['debe_raw'] - (float)$r['haber_raw'];
    if ($cl === '4') $ingresos += abs($neto);
    elseif ($cl === '5') $costos += abs($neto);
    elseif ($cl === '6' || $cl === '7') $gastos += abs($neto);
  }
  $utilidadNeta = $ingresos - $costos - $gastos;
  $margenNetoPct = $ingresos > 0 ? round(($utilidadNeta / $ingresos) * 100, 1) : 0;

  // Saldo caja/bancos (acumulado histórico)
  $cuentasCaja = getCajaBancos($userId);
  $codesCaja = array_column($cuentasCaja, 'code');
  $saldosCaja = getSaldosPorCodigo($userId, $codesCaja);
  $saldoCaja = 0;
  foreach ($saldosCaja as $s) {
    $saldoCaja += $s['debe'] - $s['haber'];
  }

  // Activos y pasivos totales
  $activos = 0;
  $pasivos = 0;
  $patrimonio = 0;
  $stmtBal = $pdo->prepare(
    "SELECT pc.class,
            SUM(CASE WHEN pc.nat = 'Deudora' THEN ld.debe - ld.haber ELSE ld.haber - ld.debe END) AS saldo
     FROM libro_diario ld
     LEFT JOIN plan_cuentas pc ON pc.user_id = ld.user_id AND pc.code = ld.cuenta_code
     WHERE ld.user_id = ?
     GROUP BY pc.class"
  );
  $stmtBal->execute([$userId]);
  while ($r = $stmtBal->fetch()) {
    $sal = (float)$r['saldo'];
    if ($r['class'] === '1') $activos = $sal;
    elseif ($r['class'] === '2') $pasivos = abs($sal);
    elseif ($r['class'] === '3') $patrimonio = abs($sal);
  }

  // --- 2. Ratios ---
  $razonCorriente = 0;
  $pruebaAcida = 0;
  $nivelEndeudamiento = 0;

  if ($pasivos > 0) {
    $razonCorriente = round($activos / $pasivos, 2);
    $nivelEndeudamiento = round(($pasivos / $activos) * 100, 1);
  }

  $roa = $activos > 0 ? round(($utilidadNeta / $activos) * 100, 1) : 0;

  // --- 3. Datos para gráficos (últimos 6 meses) ---
  $graficoVentas = [];
  $graficoCompras = [];
  for ($i = 5; $i >= 0; $i--) {
    $m = $mes - $i;
    $y = $anio;
    while ($m <= 0) { $m += 12; $y--; }
    $fi = sprintf('%04d-%02d-01', $y, $m);
    $ff = date('Y-m-t', strtotime($fi));
    $f = getFacturasTotales($userId, $fi, $ff);
    $graficoVentas[] = ['mes' => date('M', strtotime($fi)), 'valor' => abs($f['Venta']['neto'])];
    $graficoCompras[] = ['mes' => date('M', strtotime($fi)), 'valor' => abs($f['Compra']['neto'])];
  }

  jsonResponse([
    'ok' => true,
    'periodo' => ['mes' => $mes, 'anio' => $anio, 'inicio' => $fechaInicio, 'fin' => $fechaFin],
    'kpis' => [
      'facturas_mes'        => $totalFacturas,
      'facturas_total'      => $totalFacturasGlobal,
      'ventas_neto'         => round($ventasNeto),
      'ventas_total'        => round($ventasTotal),
      'ventas_cantidad'     => $facturasMes['Venta']['cantidad'],
      'compras_neto'        => round($comprasNeto),
      'compras_total'       => round($comprasTotal),
      'compras_cantidad'    => $facturasMes['Compra']['cantidad'],
      'iva_debito_fiscal'   => round($ivaDebitoFiscal),
      'iva_credito_fiscal'  => round($ivaCreditoFiscal),
      'iva_saldo'           => round($saldoIVA),
      'utilidad_bruta'      => round($utilidadBruta),
      'utilidad_neta'       => round($utilidadNeta),
      'margen_bruto_pct'    => $margenBrutoPct,
      'margen_neto_pct'     => $margenNetoPct,
      'saldo_caja'          => round($saldoCaja),
    ],
    'ratios' => [
      'razon_corriente'       => $razonCorriente,
      'prueba_acida'          => $pruebaAcida,
      'nivel_endeudamiento'   => $nivelEndeudamiento,
      'roa'                   => $roa,
      'activos'               => round($activos),
      'pasivos'               => round($pasivos),
      'patrimonio'            => round($patrimonio),
    ],
    'graficos' => [
      'ventas'  => $graficoVentas,
      'compras' => $graficoCompras,
    ],
  ]);
}
