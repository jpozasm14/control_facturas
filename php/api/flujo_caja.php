<?php
// api/flujo_caja.php — Flujo de Caja (método directo/indirecto) + ajustes manuales
// =====================================================
require_once __DIR__ . '/../config.php';
startSession();
requireLogin();

$userId = currentUserId();
$method = $_SERVER['REQUEST_METHOD'];

header('Content-Type: application/json; charset=utf-8');

switch ($method) {
  case 'GET':
    handleGet($userId);
    break;
  case 'POST':
    handlePost($userId);
    break;
  case 'PUT':
    handlePut($userId);
    break;
  case 'DELETE':
    handleDelete($userId);
    break;
  default:
    jsonError('Método no soportado', 405);
}

// -----------------------------------------------------
// GET — Calcular flujo de caja
// -----------------------------------------------------
function handleGet(int $userId) {
  $metodo = $_GET['metodo'] ?? 'directo'; // directo | indirecto
  $mes  = isset($_GET['mes'])  ? max(1, min(12, (int)$_GET['mes']))  : (int)date('n');
  $anio = isset($_GET['anio']) ? max(2000, min(2100, (int)$_GET['anio'])) : (int)date('Y');

  $fechaInicio = sprintf('%04d-%02d-01', $anio, $mes);
  $fechaFin    = date('Y-m-t', strtotime($fechaInicio));

  // Mes anterior para saldo inicial
  $mesAnt  = $mes === 1 ? 12 : $mes - 1;
  $anioAnt = $mes === 1 ? $anio - 1 : $anio;
  $fechaFinAnt = date('Y-m-t', strtotime(sprintf('%04d-%02d-01', $anioAnt, $mesAnt)));

  $pdo = db();

  // --- Helper: obtener movimientos del libro diario por código de cuenta en rango ---
  function getMovimientosCuenta(int $userId, string $code, string $fi, string $ff): array {
    $stmt = db()->prepare(
      "SELECT SUM(debe) AS debe, SUM(haber) AS haber
       FROM libro_diario
       WHERE user_id = ? AND cuenta_code = ? AND fecha BETWEEN ? AND ?"
    );
    $stmt->execute([$userId, $code, $fi, $ff]);
    $r = $stmt->fetch();
    return ['debe' => (float)($r['debe'] ?? 0), 'haber' => (float)($r['haber'] ?? 0)];
  }

  // --- Helper: obtener movimientos por prefijo de código (ej: '4' = clase 4) ---
  function getMovimientosPorPrefijo(int $userId, string $prefijo, string $fi, string $ff): array {
    $stmt = db()->prepare(
      "SELECT ld.cuenta_code, pc.nat, pc.name,
              SUM(ld.debe) AS debe, SUM(ld.haber) AS haber
       FROM libro_diario ld
       LEFT JOIN plan_cuentas pc ON pc.user_id = ld.user_id AND pc.code = ld.cuenta_code
       WHERE ld.user_id = ? AND ld.cuenta_code LIKE ? AND ld.fecha BETWEEN ? AND ?
       GROUP BY ld.cuenta_code, pc.nat, pc.name
       ORDER BY ld.cuenta_code"
    );
    $stmt->execute([$userId, $prefijo . '%', $fi, $ff]);
    return $stmt->fetchAll();
  }

  // --- Helper: saldo acumulado de una cuenta hasta una fecha ---
  function getSaldoAcumulado(int $userId, string $code, string $hasta): float {
    $stmt = db()->prepare(
      "SELECT SUM(debe) AS debe, SUM(haber) AS haber
       FROM libro_diario WHERE user_id = ? AND cuenta_code = ? AND fecha <= ?"
    );
    $stmt->execute([$userId, $code, $hasta]);
    $r = $stmt->fetch();
    return (float)($r['debe'] ?? 0) - (float)($r['haber'] ?? 0);
  }

  // --- 1. Obtener ajustes manuales ---
  $stmtAjustes = $pdo->prepare(
    "SELECT * FROM flujo_caja_ajustes WHERE user_id = ? AND fecha BETWEEN ? AND ? ORDER BY fecha"
  );
  $stmtAjustes->execute([$userId, $fechaInicio, $fechaFin]);
  $ajustesRaw = $stmtAjustes->fetchAll();
  $ajustes = array_map(function($r) {
    return [
      'id'             => (int)$r['id'],
      'fecha'          => $r['fecha'],
      'concepto'       => $r['concepto'],
      'tipo'           => $r['tipo'],
      'monto'          => (float)$r['monto'],
      'clasificacion'  => $r['clasificacion'],
      'notas'          => $r['notas'],
    ];
  }, $ajustesRaw);

  // --- 2. Obtener movimientos por clase ---
  $claseIngresos   = getMovimientosPorPrefijo($userId, '4', $fechaInicio, $fechaFin);
  $claseCostos     = getMovimientosPorPrefijo($userId, '5', $fechaInicio, $fechaFin);
  $claseGastos     = getMovimientosPorPrefijo($userId, '6', $fechaInicio, $fechaFin);
  $claseResultado  = getMovimientosPorPrefijo($userId, '7', $fechaInicio, $fechaFin);

  // Cuentas de caja/bancos (clase 1.1)
  $stmtCaja = $pdo->prepare(
    "SELECT code, name FROM plan_cuentas WHERE user_id = ? AND code LIKE '1.1.%' AND imp = 1 ORDER BY code"
  );
  $stmtCaja->execute([$userId]);
  $cuentasCaja = $stmtCaja->fetchAll();

  // Cuentas de inversión (clase 1.2)
  $stmtInversion = $pdo->prepare(
    "SELECT code, name FROM plan_cuentas WHERE user_id = ? AND code LIKE '1.2.%' AND imp = 1 ORDER BY code"
  );
  $stmtInversion->execute([$userId]);
  $cuentasInversion = $stmtInversion->fetchAll();

  // Cuentas de financiamiento (clase 2)
  $stmtFinanciamiento = $pdo->prepare(
    "SELECT code, name FROM plan_cuentas WHERE user_id = ? AND code LIKE '2.%' AND imp = 1 ORDER BY code"
  );
  $stmtFinanciamiento->execute([$userId]);
  $cuentasFinanciamiento = $stmtFinanciamiento->fetchAll();

  // --- 3. Calcular flujos por método ---
  if ($metodo === 'directo') {
    // MÉTODO DIRECTO: clasificar directamente por tipo de actividad
    $ingresosOperacionales = 0;
    $egresosOperacionales = 0;
    $inversionesNetas = 0;
    $financiamientoNeto = 0;

    // Ingresos operacionales = clase 4 (credito) - devoluciones
    foreach ($claseIngresos as $r) {
      $neto = (float)$r['haber'] - (float)$r['debe'];
      $ingresosOperacionales += $neto;
    }
    // Ajustes manuales de ingreso
    foreach ($ajustes as $aj) {
      if ($aj['tipo'] === 'ingreso' && $aj['clasificacion'] === 'operacional') {
        $ingresosOperacionales += $aj['monto'];
      }
    }

    // Egresos operacionales = clase 5 (debito) + clase 6 (debito)
    foreach ($claseCostos as $r) {
      $neto = (float)$r['debe'] - (float)$r['haber'];
      $egresosOperacionales += $neto;
    }
    foreach ($claseGastos as $r) {
      $neto = (float)$r['debe'] - (float)$r['haber'];
      $egresosOperacionales += $neto;
    }
    // Ajustes manuales de egreso
    foreach ($ajustes as $aj) {
      if ($aj['tipo'] === 'egreso' && $aj['clasificacion'] === 'operacional') {
        $egresosOperacionales += $aj['monto'];
      }
    }

    // Inversiones = movimientos en cuentas 1.2.x (compra de activos)
    foreach ($cuentasInversion as $c) {
      $mov = getMovimientosCuenta($userId, $c['code'], $fechaInicio, $fechaFin);
      $neto = $mov['debe'] - $mov['haber'];
      $inversionesNetas += $neto;
    }
    foreach ($ajustes as $aj) {
      if ($aj['clasificacion'] === 'inversion') {
        $inversionesNetas += ($aj['tipo'] === 'egreso' ? $aj['monto'] : -$aj['monto']);
      }
    }

    // Financiamiento = variación en pasivos (clase 2)
    foreach ($cuentasFinanciamiento as $c) {
      $mov = getMovimientosCuenta($userId, $c['code'], $fechaInicio, $fechaFin);
      $neto = $mov['haber'] - $mov['debe'];
      $financiamientoNeto += $neto;
    }
    foreach ($ajustes as $aj) {
      if ($aj['clasificacion'] === 'financiamiento') {
        $financiamientoNeto += ($aj['tipo'] === 'ingreso' ? $aj['monto'] : -$aj['monto']);
      }
    }

    // Saldo caja
    $saldoCaja = 0;
    foreach ($cuentasCaja as $c) {
      $saldoCaja += getSaldoAcumulado($userId, $c['code'], $fechaFin);
    }
    $saldoCajaAnt = 0;
    foreach ($cuentasCaja as $c) {
      $saldoCajaAnt += getSaldoAcumulado($userId, $c['code'], $fechaFinAnt);
    }

    $flujoOperacional = $ingresosOperacionales - $egresosOperacionales;
    $flujoInversion   = -$inversionesNetas;
    $flujoFinanciamiento = $financiamientoNeto;
    $flujoNeto = $flujoOperacional + $flujoInversion + $flujoFinanciamiento;

    jsonResponse([
      'ok'     => true,
      'metodo' => 'directo',
      'periodo' => ['mes' => $mes, 'anio' => $anio],
      'flujo' => [
        'operacional' => round($flujoOperacional),
        'inversion'   => round($flujoInversion),
        'financiamiento' => round($flujoFinanciamiento),
        'neto'        => round($flujoNeto),
        'saldo_inicial' => round($saldoCajaAnt),
        'saldo_final'   => round($saldoCaja),
      ],
      'detalles' => [
        'ingresos_operacionales' => round($ingresosOperacionales),
        'egresos_operacionales'  => round($egresosOperacionales),
        'inversiones_netas'      => round($inversionesNetas),
        'financiamiento_neto'    => round($financiamientoNeto),
      ],
      'ajustes' => $ajustes,
    ]);

  } else {
    // MÉTODO INDIRECTO: utilidad neta + ajustes
    // Utilidad neta
    $ingresos = 0;
    $costos   = 0;
    $gastos   = 0;
    foreach ($claseIngresos as $r) { $ingresos += (float)$r['haber'] - (float)$r['debe']; }
    foreach ($claseCostos as $r)   { $costos += (float)$r['debe'] - (float)$r['haber']; }
    foreach ($claseGastos as $r)   { $gastos += (float)$r['debe'] - (float)$r['haber']; }
    foreach ($claseResultado as $r) {
      $neto = (float)$r['haber'] - (float)$r['debe'];
      $ingresos += abs($neto);
    }
    $utilidadNeta = $ingresos - $costos - $gastos;

    // Depreciación acumulada (clase 1.2.02)
    $depreciacion = 0;
    $stmtDep = $pdo->prepare(
      "SELECT SUM(haber) AS haber FROM libro_diario
       WHERE user_id = ? AND cuenta_code LIKE '1.2.02.%' AND fecha BETWEEN ? AND ?"
    );
    $stmtDep->execute([$userId, $fechaInicio, $fechaFin]);
    $depRow = $stmtDep->fetch();
    $depreciacion = (float)($depRow['haber'] ?? 0);

    // Variación capital de trabajo = (AC - PC) variación
    $acAnt = 0;
    $pcAnt = 0;
    $acAct = 0;
    $pcAct = 0;
    $stmtAC = $pdo->prepare(
      "SELECT SUM(debe - haber) AS saldo FROM libro_diario ld
       LEFT JOIN plan_cuentas pc ON pc.user_id = ld.user_id AND pc.code = ld.cuenta_code
       WHERE ld.user_id = ? AND pc.clasif = 'Activo Corriente' AND ld.fecha <= ?"
    );
    $stmtAC->execute([$userId, $fechaFinAnt]);
    $acAnt = (float)($stmtAC->fetchColumn() ?? 0);
    $stmtAC->execute([$userId, $fechaFin]);
    $acAct = (float)($stmtAC->fetchColumn() ?? 0);

    $stmtPC = $pdo->prepare(
      "SELECT SUM(haber - debe) AS saldo FROM libro_diario ld
       LEFT JOIN plan_cuentas pc ON pc.user_id = ld.user_id AND pc.code = ld.cuenta_code
       WHERE ld.user_id = ? AND pc.clasif = 'Pasivo Corriente' AND ld.fecha <= ?"
    );
    $stmtPC->execute([$userId, $fechaFinAnt]);
    $pcAnt = (float)($stmtPC->fetchColumn() ?? 0);
    $stmtPC->execute([$userId, $fechaFin]);
    $pcAct = (float)($stmtPC->fetchColumn() ?? 0);

    $varCapitalTrabajo = ($acAct - $pcAct) - ($acAnt - $pcAnt);

    // Ajustes manuales
    $ajustesDirectos = 0;
    foreach ($ajustes as $aj) {
      $ajustesDirectos += ($aj['tipo'] === 'ingreso' ? $aj['monto'] : -$aj['monto']);
    }

    $flujoOperacional = $utilidadNeta + $depreciacion + $varCapitalTrabajo + $ajustesDirectos;

    // Inversiones y financiamiento igual al método directo
    $inversionesNetas = 0;
    foreach ($cuentasInversion as $c) {
      $mov = getMovimientosCuenta($userId, $c['code'], $fechaInicio, $fechaFin);
      $inversionesNetas += $mov['debe'] - $mov['haber'];
    }
    $financiamientoNeto = 0;
    foreach ($cuentasFinanciamiento as $c) {
      $mov = getMovimientosCuenta($userId, $c['code'], $fechaInicio, $fechaFin);
      $financiamientoNeto += $mov['haber'] - $mov['debe'];
    }

    // Saldo caja
    $saldoCaja = 0;
    foreach ($cuentasCaja as $c) {
      $saldoCaja += getSaldoAcumulado($userId, $c['code'], $fechaFin);
    }
    $saldoCajaAnt = 0;
    foreach ($cuentasCaja as $c) {
      $saldoCajaAnt += getSaldoAcumulado($userId, $c['code'], $fechaFinAnt);
    }

    $flujoInversion      = -$inversionesNetas;
    $flujoFinanciamiento = $financiamientoNeto;
    $flujoNeto = $flujoOperacional + $flujoInversion + $flujoFinanciamiento;

    jsonResponse([
      'ok'     => true,
      'metodo' => 'indirecto',
      'periodo' => ['mes' => $mes, 'anio' => $anio],
      'flujo' => [
        'operacional' => round($flujoOperacional),
        'inversion'   => round($flujoInversion),
        'financiamiento' => round($flujoFinanciamiento),
        'neto'        => round($flujoNeto),
        'saldo_inicial' => round($saldoCajaAnt),
        'saldo_final'   => round($saldoCaja),
      ],
      'detalles' => [
        'utilidad_neta'       => round($utilidadNeta),
        'depreciacion'        => round($depreciacion),
        'var_capital_trabajo' => round($varCapitalTrabajo),
        'ajustes_manuales'    => round($ajustesDirectos),
      ],
      'ajustes' => $ajustes,
    ]);
  }
}

// -----------------------------------------------------
// POST — Crear ajuste manual
// -----------------------------------------------------
function handlePost(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $fecha         = trim($data['fecha'] ?? '');
  $concepto      = trim($data['concepto'] ?? '');
  $tipo          = $data['tipo'] ?? 'egreso';
  $monto         = (float)($data['monto'] ?? 0);
  $clasificacion = $data['clasificacion'] ?? 'operacional';
  $notas         = trim($data['notas'] ?? '');

  if (!$fecha) jsonError('La fecha es obligatoria');
  if (!$concepto) jsonError('El concepto es obligatorio');
  if ($monto == 0) jsonError('El monto no puede ser cero');
  if (!in_array($tipo, ['ingreso', 'egreso'])) jsonError('Tipo inválido');
  if (!in_array($clasificacion, ['operacional', 'inversion', 'financiamiento'])) jsonError('Clasificación inválida');

  $stmt = db()->prepare(
    "INSERT INTO flujo_caja_ajustes (user_id, fecha, concepto, tipo, monto, clasificacion, notas)
     VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  $stmt->execute([$userId, $fecha, $concepto, $tipo, abs($monto), $clasificacion, $notas]);

  jsonResponse(['ok' => true, 'id' => (int)db()->lastInsertId()]);
}

// -----------------------------------------------------
// PUT — Actualizar ajuste manual
// -----------------------------------------------------
function handlePut(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $id = (int)($data['id'] ?? 0);
  if (!$id) jsonError('Falta id del ajuste');

  $fecha         = trim($data['fecha'] ?? '');
  $concepto      = trim($data['concepto'] ?? '');
  $tipo          = $data['tipo'] ?? 'egreso';
  $monto         = (float)($data['monto'] ?? 0);
  $clasificacion = $data['clasificacion'] ?? 'operacional';
  $notas         = trim($data['notas'] ?? '');

  if (!$fecha) jsonError('La fecha es obligatoria');
  if (!$concepto) jsonError('El concepto es obligatorio');
  if ($monto == 0) jsonError('El monto no puede ser cero');

  $stmt = db()->prepare(
    "UPDATE flujo_caja_ajustes SET fecha=?, concepto=?, tipo=?, monto=?, clasificacion=?, notas=?
     WHERE id=? AND user_id=?"
  );
  $stmt->execute([$fecha, $concepto, $tipo, abs($monto), $clasificacion, $notas, $id, $userId]);
  if ($stmt->rowCount() === 0) jsonError('Ajuste no encontrado', 404);

  jsonResponse(['ok' => true]);
}

// -----------------------------------------------------
// DELETE — Eliminar ajuste manual
// -----------------------------------------------------
function handleDelete(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  $id = (int)($data['id'] ?? 0);
  if (!$id) jsonError('Falta id del ajuste');

  $stmt = db()->prepare('DELETE FROM flujo_caja_ajustes WHERE id = ? AND user_id = ?');
  $stmt->execute([$id, $userId]);
  if ($stmt->rowCount() === 0) jsonError('Ajuste no encontrado', 404);

  jsonResponse(['ok' => true]);
}
