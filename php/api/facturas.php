<?php
// api/facturas.php — CRUD de facturas
// =====================================================
require_once __DIR__ . '/../config.php';
startSession();
requireLogin();

$userId = currentUserId();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

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
// GET — Listar facturas
// -----------------------------------------------------
function handleGet(int $userId) {
  $stmt = db()->prepare(
    'SELECT id, numero, fecha, neto, iva, total, descripcion,
            tipo_documento, tipo_operacion, cuenta_contable,
            imagen, imagen_mime, created_at, updated_at, asiento_num
     FROM facturas WHERE user_id = ? ORDER BY id DESC'
  );
  $stmt->execute([$userId]);
  $rows = $stmt->fetchAll();

  // Convertir campos numéricos y imagen BLOB → dataURL
  foreach ($rows as &$r) {
    $r['id'] = (int)$r['id'];
    $r['neto'] = $r['neto'] !== null ? (float)$r['neto'] : null;
    $r['iva'] = $r['iva'] !== null ? (float)$r['iva'] : null;
    $r['total'] = $r['total'] !== null ? (float)$r['total'] : null;
    $r['asiento_num'] = $r['asiento_num'] !== null ? (int)$r['asiento_num'] : null;
    // Convertir BLOB a dataURL para que el JS pueda usarlo como src de imagen
    if ($r['imagen'] !== null && $r['imagen'] !== '' && isset($r['imagen_mime'])) {
      $r['imagen'] = 'data:' . $r['imagen_mime'] . ';base64,' . base64_encode($r['imagen']);
    } else {
      $r['imagen'] = '';
    }
    unset($r['imagen_mime']);
  }

  jsonResponse(['facturas' => $rows]);
}

// -----------------------------------------------------
// POST — Crear factura
// -----------------------------------------------------
function handlePost(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) $data = $_POST;

  $numero         = trim($data['numero'] ?? '');
  $fecha          = trim($data['fecha'] ?? '');
  $neto           = $data['neto'] ?? null;
  $iva            = $data['iva'] ?? null;
  $total          = $data['total'] ?? null;
  $descripcion    = trim($data['descripcion'] ?? '');
  $tipoDocumento  = trim($data['tipoDocumento'] ?? 'Factura');
  $tipoOperacion  = trim($data['tipoOperacion'] ?? 'Venta');
  $cuentaContable = trim($data['cuentaContable'] ?? '');
  $imagen         = $data['imagen'] ?? null; // base64 data URL
  $ocrText        = $data['ocrText'] ?? null;

  // Negatizar si Compra
  if ($tipoOperacion === 'Compra') {
    if ($neto !== null) $neto = -abs((float)$neto);
    if ($iva !== null)  $iva  = -abs((float)$iva);
    if ($total !== null) $total = -abs((float)$total);
  } else {
    if ($neto !== null) $neto = abs((float)$neto);
    if ($iva !== null)  $iva  = abs((float)$iva);
    if ($total !== null) $total = abs((float)$total);
  }

  // Guardar imagen como BLOB
  $imagenBlob = null;
  $imagenMime = 'image/jpeg';
  if ($imagen && preg_match('/^data:(image\/\w+);base64,(.+)$/', $imagen, $m)) {
    $imagenMime = $m[1];
    $imagenBlob = base64_decode($m[2]);
  }

  // Verificar duplicado
  if ($numero && $fecha) {
    $chk = db()->prepare('SELECT COUNT(*) FROM facturas WHERE user_id=? AND numero=? AND fecha=?');
    $chk->execute([$userId, $numero, $fecha]);
    if ($chk->fetchColumn() > 0) {
      jsonError('Ya existe una factura con ese número en la misma fecha.');
    }
  }

  $stmt = db()->prepare(
    'INSERT INTO facturas (user_id, numero, fecha, neto, iva, total, descripcion,
                           tipo_documento, tipo_operacion, cuenta_contable,
                           imagen, imagen_mime, ocr_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  $stmt->execute([
    $userId, $numero, $fecha, $neto, $iva, $total, $descripcion,
    $tipoDocumento, $tipoOperacion, $cuentaContable,
    $imagenBlob, $imagenMime, $ocrText
  ]);

  $newId = (int)db()->lastInsertId();

  // Crear asiento automático en Libro Diario
  $asientoNum = createAsientoForFactura($userId, $newId, $fecha, $neto, $iva, $total,
                                         $tipoOperacion, $cuentaContable, $descripcion);

  jsonResponse(['ok' => true, 'id' => $newId, 'asiento_num' => $asientoNum]);
}

// -----------------------------------------------------
// PUT — Actualizar factura
// -----------------------------------------------------
function handlePut(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $id = (int)($data['id'] ?? 0);
  if (!$id) jsonError('Falta id');

  // Verificar que pertenece al usuario
  $chk = db()->prepare('SELECT id FROM facturas WHERE id=? AND user_id=?');
  $chk->execute([$id, $userId]);
  if (!$chk->fetch()) jsonError('Factura no encontrada', 404);

  $numero         = trim($data['numero'] ?? '');
  $fecha          = trim($data['fecha'] ?? '');
  $neto           = $data['neto'] ?? null;
  $iva            = $data['iva'] ?? null;
  $total          = $data['total'] ?? null;
  $descripcion    = trim($data['descripcion'] ?? '');
  $tipoDocumento  = trim($data['tipoDocumento'] ?? 'Factura');
  $tipoOperacion  = trim($data['tipoOperacion'] ?? 'Venta');
  $cuentaContable = trim($data['cuentaContable'] ?? '');
  $imagen         = $data['imagen'] ?? null;

  if ($tipoOperacion === 'Compra') {
    if ($neto !== null) $neto = -abs((float)$neto);
    if ($iva !== null)  $iva  = -abs((float)$iva);
    if ($total !== null) $total = -abs((float)$total);
  } else {
    if ($neto !== null) $neto = abs((float)$neto);
    if ($iva !== null)  $iva  = abs((float)$iva);
    if ($total !== null) $total = abs((float)$total);
  }

  // Actualizar imagen solo si se envía nueva
  $imgSql = '';
  $imgParams = [];
  if ($imagen && preg_match('/^data:(image\/\w+);base64,(.+)$/', $imagen, $m)) {
    $imgSql = ', imagen = ?, imagen_mime = ?';
    $imgParams = [base64_decode($m[2]), $m[1]];
  }

  $sql = "UPDATE facturas SET numero=?, fecha=?, neto=?, iva=?, total=?, descripcion=?,
          tipo_documento=?, tipo_operacion=?, cuenta_contable=?{$imgSql}
          WHERE id=? AND user_id=?";
  $params = array_merge([$numero, $fecha, $neto, $iva, $total, $descripcion,
                          $tipoDocumento, $tipoOperacion, $cuentaContable],
                         $imgParams, [$id, $userId]);

  db()->prepare($sql)->execute($params);
  jsonResponse(['ok' => true]);
}

// -----------------------------------------------------
// DELETE — Eliminar factura
// -----------------------------------------------------
function handleDelete(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  $id = (int)($data['id'] ?? ($_GET['id'] ?? 0));
  if (!$id) jsonError('Falta id');

  $stmt = db()->prepare('DELETE FROM facturas WHERE id=? AND user_id=?');
  $stmt->execute([$id, $userId]);
  if ($stmt->rowCount() === 0) jsonError('Factura no encontrada', 404);
  jsonResponse(['ok' => true]);
}

// -----------------------------------------------------
// Crear asiento automático en Libro Diario para una factura
// -----------------------------------------------------
// Venta:  Debe Clientes (total) / Haber Ventas (neto) + Haber IVA Débito Fiscal (IVA)
// Compra: Debe [cuenta_contable] (neto) + Debe IVA Crédito Fiscal (IVA) / Haber Proveedores (total)
function createAsientoForFactura(
  int $userId, int $facturaId, string $fecha,
  ?float $neto, ?float $iva, ?float $total,
  string $tipoOperacion, string $cuentaContable, string $descripcion
): ?int {
  // Si no hay montos, no crear asiento
  if ($neto === null && $iva === null && $total === null) return null;
  if ($total === null || $total == 0) return null;

  // Convertir DD/MM/AAAA → YYYY-MM-DD
  $fechaISO = $fecha;
  if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $fecha, $fm)) {
    $fechaISO = $fm[3] . '-' . $fm[2] . '-' . $fm[1];
  }

  $absNeto = abs((float)$neto);
  $absIva  = abs((float)$iva);
  $absTotal = abs((float)$total);

  // Cuentas IVA (estándar chilenas)
  $ctaIvaDebito  = '2.1.04.01'; // Débito Fiscal IVA por Pagar
  $ctaIvaCredito = '1.1.05.01'; // Remanente Crédito Fiscal IVA

  // Cuentas de contrapartida
  $ctaClientes    = '1.1.02.01'; // Clientes Nacionales
  $ctaProveedores = '2.1.01.01'; // Proveedores Nacionales
  $ctaVentas      = '4.1.01.01'; // Ventas Nacionales

  $lineas = [];
  $glosa = 'Automático — Factura ' . ($descripcion ?: $tipoOperacion);
  if (strlen($glosa) > 200) $glosa = substr($glosa, 0, 200);

  if ($tipoOperacion === 'Venta') {
    // Debe: Clientes por el total
    $lineas[] = ['cuenta_code' => $ctaClientes, 'debe' => $absTotal, 'haber' => 0];
    // Haber: Ventas por el neto
    if ($absNeto > 0) {
      $lineas[] = ['cuenta_code' => $ctaVentas, 'debe' => 0, 'haber' => $absNeto];
    }
    // Haber: IVA Débito Fiscal
    if ($absIva > 0) {
      $lineas[] = ['cuenta_code' => $ctaIvaDebito, 'debe' => 0, 'haber' => $absIva];
    }
  } else {
    // Compra
    // Debe: Gasto/Activo por el neto (cuenta_contable de la factura)
    $ctaGasto = $cuentaContable ?: '6.1.04.01';
    if ($absNeto > 0) {
      $lineas[] = ['cuenta_code' => $ctaGasto, 'debe' => $absNeto, 'haber' => 0];
    }
    // Debe: IVA Crédito Fiscal
    if ($absIva > 0) {
      $lineas[] = ['cuenta_code' => $ctaIvaCredito, 'debe' => $absIva, 'haber' => 0];
    }
    // Haber: Proveedores por el total
    $lineas[] = ['cuenta_code' => $ctaProveedores, 'debe' => 0, 'haber' => $absTotal];
  }

  if (empty($lineas)) return null;

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
      $stmt->execute([
        $userId, $nextNum, $fechaISO, $l['cuenta_code'], $glosa,
        $l['debe'], $l['haber']
      ]);
    }
    // Vincular factura con el asiento
    db()->prepare('UPDATE facturas SET asiento_num = ? WHERE id = ? AND user_id = ?')
       ->execute([$nextNum, $facturaId, $userId]);
    db()->commit();
    return $nextNum;
  } catch (Exception $e) {
    db()->rollBack();
    error_log('Error creando asiento automático: ' . $e->getMessage());
    return null;
  }
}
