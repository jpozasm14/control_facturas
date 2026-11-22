<?php
// api/libro_diario.php — CRUD del Libro Diario
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
// GET — Listar líneas del libro diario
// -----------------------------------------------------
function handleGet(int $userId) {
  $stmt = db()->prepare(
    'SELECT ld.id, ld.asiento_num, ld.fecha, ld.cuenta_code,
            COALESCE(pc.name, ld.cuenta_code) AS cuenta_name,
            ld.glosa, ld.debe, ld.haber
     FROM libro_diario ld
     LEFT JOIN plan_cuentas pc ON pc.user_id = ld.user_id AND pc.code = ld.cuenta_code
     WHERE ld.user_id = ?
      ORDER BY ld.asiento_num ASC, ld.debe DESC, ld.id ASC'
  );
  $stmt->execute([$userId]);
  $rows = $stmt->fetchAll();

  $lineas = array_map(function($r) {
    return [
      'id'          => (int)$r['id'],
      'asiento_num' => (int)$r['asiento_num'],
      'fecha'       => $r['fecha'],
      'cuenta_code' => $r['cuenta_code'],
      'cuenta_name' => $r['cuenta_name'],
      'glosa'       => $r['glosa'],
      'debe'        => (float)$r['debe'],
      'haber'       => (float)$r['haber'],
    ];
  }, $rows);

  jsonResponse(['lineas' => $lineas]);
}

// -----------------------------------------------------
// POST — Crear asiento (array de líneas)
// -----------------------------------------------------
function handlePost(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $fecha  = trim($data['fecha'] ?? '');
  $glosa  = trim($data['glosa'] ?? '');
  $lineas = $data['lineas'] ?? [];

  if (!$fecha) jsonError('La fecha es obligatoria');
  if (empty($lineas)) jsonError('El asiento debe tener al menos una línea');

  // Validar que haya al menos 1 Debe y 1 Haber
  $totalDebe = 0;
  $totalHaber = 0;
  foreach ($lineas as $l) {
    $d = (float)($l['debe'] ?? 0);
    $h = (float)($l['haber'] ?? 0);
    if ($d < 0 || $h < 0) jsonError('Los montos no pueden ser negativos');
    if ($d > 0 && $h > 0) jsonError('Una línea no puede tener Debe y Haber al mismo tiempo');
    if ($d == 0 && $h == 0) jsonError('Cada línea debe tener Debe o Haber');
    $totalDebe += $d;
    $totalHaber += $h;
  }

  if (abs($totalDebe - $totalHaber) > 0.01) {
    jsonError('El asiento no está cuadrado: Debe (' . number_format($totalDebe, 0) . ') ≠ Haber (' . number_format($totalHaber, 0) . ')');
  }

  // Obtener siguiente número de asiento
  $stmtMax = db()->prepare('SELECT COALESCE(MAX(asiento_num), 0) + 1 FROM libro_diario WHERE user_id = ?');
  $stmtMax->execute([$userId]);
  $nextNum = (int)$stmtMax->fetchColumn();

  // Insertar líneas
  $stmt = db()->prepare(
    'INSERT INTO libro_diario (user_id, asiento_num, fecha, cuenta_code, glosa, debe, haber)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  db()->beginTransaction();
  try {
    foreach ($lineas as $l) {
      $code = trim($l['cuenta_code'] ?? '');
      if (!$code) jsonError('Código de cuenta requerido en cada línea');
      $stmt->execute([
        $userId, $nextNum, $fecha, $code, $glosa,
        (float)($l['debe'] ?? 0), (float)($l['haber'] ?? 0)
      ]);
    }
    db()->commit();
  } catch (Exception $e) {
    db()->rollBack();
    throw $e;
  }

  jsonResponse(['ok' => true, 'asiento_num' => $nextNum]);
}

// -----------------------------------------------------
// PUT — Actualizar asiento (reemplazar líneas)
// -----------------------------------------------------
function handlePut(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $asientoNum = (int)($data['asiento_num'] ?? 0);
  $fecha  = trim($data['fecha'] ?? '');
  $glosa  = trim($data['glosa'] ?? '');
  $lineas = $data['lineas'] ?? [];

  if (!$asientoNum) jsonError('Falta número de asiento');
  if (!$fecha) jsonError('La fecha es obligatoria');
  if (empty($lineas)) jsonError('El asiento debe tener al menos una línea');

  $totalDebe = 0;
  $totalHaber = 0;
  foreach ($lineas as $l) {
    $d = (float)($l['debe'] ?? 0);
    $h = (float)($l['haber'] ?? 0);
    if ($d < 0 || $h < 0) jsonError('Los montos no pueden ser negativos');
    if ($d > 0 && $h > 0) jsonError('Una línea no puede tener Debe y Haber al mismo tiempo');
    if ($d == 0 && $h == 0) jsonError('Cada línea debe tener Debe o Haber');
    $totalDebe += $d;
    $totalHaber += $h;
  }

  if (abs($totalDebe - $totalHaber) > 0.01) {
    jsonError('El asiento no está cuadrado: Debe (' . number_format($totalDebe, 0) . ') ≠ Haber (' . number_format($totalHaber, 0) . ')');
  }

  db()->beginTransaction();
  try {
    db()->prepare('DELETE FROM libro_diario WHERE user_id = ? AND asiento_num = ?')
       ->execute([$userId, $asientoNum]);

    $stmt = db()->prepare(
      'INSERT INTO libro_diario (user_id, asiento_num, fecha, cuenta_code, glosa, debe, haber)
       VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($lineas as $l) {
      $code = trim($l['cuenta_code'] ?? '');
      if (!$code) jsonError('Código de cuenta requerido en cada línea');
      $stmt->execute([
        $userId, $asientoNum, $fecha, $code, $glosa,
        (float)($l['debe'] ?? 0), (float)($l['haber'] ?? 0)
      ]);
    }
    db()->commit();
  } catch (Exception $e) {
    db()->rollBack();
    throw $e;
  }

  jsonResponse(['ok' => true, 'asiento_num' => $asientoNum]);
}

// -----------------------------------------------------
// DELETE — Eliminar un asiento completo
// -----------------------------------------------------
function handleDelete(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  $asientoNum = (int)($data['asiento_num'] ?? 0);
  if (!$asientoNum) jsonError('Falta número de asiento');

  $stmt = db()->prepare('DELETE FROM libro_diario WHERE user_id = ? AND asiento_num = ?');
  $stmt->execute([$userId, $asientoNum]);
  if ($stmt->rowCount() === 0) jsonError('Asiento no encontrado', 404);

  jsonResponse(['ok' => true]);
}
