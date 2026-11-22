<?php
// api/cuentas.php — CRUD del plan de cuentas
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
// GET — Listar cuentas del usuario
// -----------------------------------------------------
function handleGet(int $userId) {
  $stmt = db()->prepare(
    'SELECT id, code, name, `level`, class, nat, clasif, imp, parent
     FROM plan_cuentas WHERE user_id = ? ORDER BY code'
  );
  $stmt->execute([$userId]);
  $rows = $stmt->fetchAll();

  // Si no tiene cuentas, copiar las por defecto
  if (empty($rows)) {
    $rows = seedDefaultAccounts($userId);
  }

  // Formato compatible con el JS
  $cuentas = array_map(function($r) {
    return [
      'id'     => (int)$r['id'],
      'code'   => $r['code'],
      'name'   => $r['name'],
      'level'  => (int)$r['level'],
      'class'  => $r['class'],
      'nat'    => $r['nat'],
      'clasif' => $r['clasif'],
      'imp'    => (bool)$r['imp'],
      'parent' => $r['parent'],
    ];
  }, $rows);

  jsonResponse(['cuentas' => $cuentas]);
}

// -----------------------------------------------------
// POST — Crear cuenta
// -----------------------------------------------------
function handlePost(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $code   = trim($data['code'] ?? '');
  $name   = trim($data['name'] ?? '');
  $level  = (int)($data['level'] ?? 1);
  $class  = trim($data['class'] ?? '1');
  $nat    = trim($data['nat'] ?? 'Deudora');
  $clasif = trim($data['clasif'] ?? '');
  $imp    = (bool)($data['imp'] ?? false);
  $parent = trim($data['parent'] ?? '');

  if (!$code || !$name) jsonError('Código y nombre son obligatorios');

  // Verificar duplicado
  $chk = db()->prepare('SELECT COUNT(*) FROM plan_cuentas WHERE user_id=? AND code=?');
  $chk->execute([$userId, $code]);
  if ($chk->fetchColumn() > 0) jsonError('Ya existe una cuenta con ese código');

  $stmt = db()->prepare(
    'INSERT INTO plan_cuentas (user_id, code, name, `level`, class, nat, clasif, imp, parent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );
  $stmt->execute([$userId, $code, $name, $level, $class, $nat, $clasif, $imp ? 1 : 0, $parent]);

  $newId = (int)db()->lastInsertId();
  jsonResponse(['ok' => true, 'id' => $newId]);
}

// -----------------------------------------------------
// PUT — Actualizar cuenta
// -----------------------------------------------------
function handlePut(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  if (!$data) jsonError('Sin datos');

  $id = (int)($data['id'] ?? 0);
  if (!$id) jsonError('Falta id');

  // Verificar pertenencia
  $chk = db()->prepare('SELECT id FROM plan_cuentas WHERE id=? AND user_id=?');
  $chk->execute([$id, $userId]);
  if (!$chk->fetch()) jsonError('Cuenta no encontrada', 404);

  $name   = trim($data['name'] ?? '');
  $nat    = trim($data['nat'] ?? 'Deudora');
  $clasif = trim($data['clasif'] ?? '');
  $imp    = (bool)($data['imp'] ?? false);

  if (!$name) jsonError('El nombre es obligatorio');

  $stmt = db()->prepare(
    'UPDATE plan_cuentas SET name=?, nat=?, clasif=?, imp=? WHERE id=? AND user_id=?'
  );
  $stmt->execute([$name, $nat, $clasif, $imp ? 1 : 0, $id, $userId]);
  jsonResponse(['ok' => true]);
}

// -----------------------------------------------------
// DELETE — Eliminar cuenta
// -----------------------------------------------------
function handleDelete(int $userId) {
  $data = json_decode(file_get_contents('php://input'), true);
  $id = (int)($data['id'] ?? ($_GET['id'] ?? 0));
  if (!$id) jsonError('Falta id');

  // Verificar que no tenga hijos
  $code = null;
  $chk = db()->prepare('SELECT code FROM plan_cuentas WHERE id=? AND user_id=?');
  $chk->execute([$id, $userId]);
  $row = $chk->fetch();
  if (!$row) jsonError('Cuenta no encontrada', 404);
  $code = $row['code'];

  $hijos = db()->prepare('SELECT COUNT(*) FROM plan_cuentas WHERE user_id=? AND parent=?');
  $hijos->execute([$userId, $code]);
  if ($hijos->fetchColumn() > 0) jsonError('No se puede eliminar: tiene cuentas hijas');

  $stmt = db()->prepare('DELETE FROM plan_cuentas WHERE id=? AND user_id=?');
  $stmt->execute([$id, $userId]);
  jsonResponse(['ok' => true]);
}

// -----------------------------------------------------
// Seed: copiar plan de cuentas por defecto al primer login
// -----------------------------------------------------
function seedDefaultAccounts(int $userId): array {
  $defaults = getDefaultAccounts();
  $stmt = db()->prepare(
    'INSERT INTO plan_cuentas (user_id, code, name, `level`, class, nat, clasif, imp, parent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  );

  db()->beginTransaction();
  try {
    foreach ($defaults as $a) {
      $stmt->execute([
        $userId, $a['code'], $a['name'], $a['level'], $a['class'],
        $a['nat'], $a['clasif'], $a['imp'] ? 1 : 0, $a['parent']
      ]);
    }
    db()->commit();
  } catch (Exception $e) {
    db()->rollBack();
    throw $e;
  }

  // Retornar lo que se insertó
  $stmt2 = db()->prepare('SELECT id, code, name, `level`, class, nat, clasif, imp, parent FROM plan_cuentas WHERE user_id=? ORDER BY code');
  $stmt2->execute([$userId]);
  return $stmt2->fetchAll();
}

// -----------------------------------------------------
// Plan de cuentas PYME chileno por defecto
// -----------------------------------------------------
function getDefaultAccounts(): array {
  return [
    // 1 - ACTIVO
    ['code'=>'1','name'=>'ACTIVO','level'=>1,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>''],
    ['code'=>'1.1','name'=>'ACTIVO CORRIENTE','level'=>2,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1'],
    ['code'=>'1.1.01','name'=>'Efectivo y Equivalentes','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1.1'],
    ['code'=>'1.1.01.01','name'=>'Caja General','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.01'],
    ['code'=>'1.1.01.02','name'=>'Caja Chica / Fondo Fijo','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.01'],
    ['code'=>'1.1.01.03','name'=>'Banco Principal Moneda Nacional','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.01'],
    ['code'=>'1.1.01.04','name'=>'Banco Moneda Extranjera','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.01'],
    ['code'=>'1.1.01.05','name'=>'Depósitos a Plazo / Inversiones CP','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.01'],
    ['code'=>'1.1.02','name'=>'Deudores Comerciales y Otras CxC','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1.1'],
    ['code'=>'1.1.02.01','name'=>'Clientes Nacionales','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.02'],
    ['code'=>'1.1.02.02','name'=>'Clientes Extranjeros','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.02'],
    ['code'=>'1.1.02.03','name'=>'Documentos y Cheques por Cobrar','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.02'],
    ['code'=>'1.1.02.04','name'=>'Deudores Varios','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.02'],
    ['code'=>'1.1.02.05','name'=>'( - ) Estimación Ctas Incobrables','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.02'],
    ['code'=>'1.1.03','name'=>'CxC Partes Relacionadas','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1.1'],
    ['code'=>'1.1.03.01','name'=>'CxC Socios / Accionistas','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.03'],
    ['code'=>'1.1.03.02','name'=>'CxC Empresas Relacionadas','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.03'],
    ['code'=>'1.1.04','name'=>'Inventarios / Existencias','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1.1'],
    ['code'=>'1.1.04.01','name'=>'Mercaderías / Productos Terminados','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.04'],
    ['code'=>'1.1.04.02','name'=>'Productos en Proceso','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.04'],
    ['code'=>'1.1.04.03','name'=>'Materias Primas y Materiales','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.04'],
    ['code'=>'1.1.04.04','name'=>'Repuestos y Suministros','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.04'],
    ['code'=>'1.1.04.05','name'=>'( - ) Provisión Obsolescencia Inventario','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.04'],
    ['code'=>'1.1.05','name'=>'Activos por Impuestos Corrientes','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1.1'],
    ['code'=>'1.1.05.01','name'=>'Remanente Crédito Fiscal IVA','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.05'],
    ['code'=>'1.1.05.02','name'=>'Pagos Provisorios Mensuales (PPM)','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.05'],
    ['code'=>'1.1.05.03','name'=>'Retenciones de Impuesto a Favor','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.05'],
    ['code'=>'1.1.06','name'=>'Gastos Pagados por Adelantado','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>false,'parent'=>'1.1'],
    ['code'=>'1.1.06.01','name'=>'Seguros Pagados por Adelantado','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.06'],
    ['code'=>'1.1.06.02','name'=>'Arriendos Pagados por Adelantado','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.06'],
    ['code'=>'1.1.06.03','name'=>'Anticipos a Proveedores','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo Corriente','imp'=>true,'parent'=>'1.1.06'],
    ['code'=>'1.2','name'=>'ACTIVO NO CORRIENTE','level'=>2,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>false,'parent'=>'1'],
    ['code'=>'1.2.01','name'=>'Propiedad, Planta y Equipo','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>false,'parent'=>'1.2'],
    ['code'=>'1.2.01.01','name'=>'Terrenos','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.01'],
    ['code'=>'1.2.01.02','name'=>'Edificios y Construcciones','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.01'],
    ['code'=>'1.2.01.03','name'=>'Maquinarias y Equipos de Trabajo','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.01'],
    ['code'=>'1.2.01.04','name'=>'Vehículos y Flota de Transporte','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.01'],
    ['code'=>'1.2.01.05','name'=>'Muebles y Útiles de Oficina','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.01'],
    ['code'=>'1.2.01.06','name'=>'Equipos Computacionales y Tecnología','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.01'],
    ['code'=>'1.2.02','name'=>'Depreciación Acumulada','level'=>3,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo No Corriente','imp'=>false,'parent'=>'1.2'],
    ['code'=>'1.2.02.01','name'=>'( - ) Dep. Acum. Edificios','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.02'],
    ['code'=>'1.2.02.02','name'=>'( - ) Dep. Acum. Maquinarias','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.02'],
    ['code'=>'1.2.02.03','name'=>'( - ) Dep. Acum. Vehículos','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.02'],
    ['code'=>'1.2.02.04','name'=>'( - ) Dep. Acum. Equipos Comput.','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.02'],
    ['code'=>'1.2.03','name'=>'Intangibles','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>false,'parent'=>'1.2'],
    ['code'=>'1.2.03.01','name'=>'Marcas y Patentes Comercial','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.03'],
    ['code'=>'1.2.03.02','name'=>'Licencias de Software y Software Propio','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.03'],
    ['code'=>'1.2.03.03','name'=>'( - ) Amortización Acum. Intangibles','level'=>4,'class'=>'1','nat'=>'Acreedora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.03'],
    ['code'=>'1.2.04','name'=>'Otras Inversiones de Largo Plazo','level'=>3,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>false,'parent'=>'1.2'],
    ['code'=>'1.2.04.01','name'=>'Inversiones de Largo Plazo','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.04'],
    ['code'=>'1.2.04.02','name'=>'Garantías en Arriendo y Depósitos','level'=>4,'class'=>'1','nat'=>'Deudora','clasif'=>'Activo No Corriente','imp'=>true,'parent'=>'1.2.04'],
    // 2 - PASIVO
    ['code'=>'2','name'=>'PASIVO','level'=>1,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>''],
    ['code'=>'2.1','name'=>'PASIVO CORRIENTE','level'=>2,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>'2'],
    ['code'=>'2.1.01','name'=>'Proveedores y CxC Comerciales','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>'2.1'],
    ['code'=>'2.1.01.01','name'=>'Proveedores Nacionales','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.01'],
    ['code'=>'2.1.01.02','name'=>'Proveedores Extranjeros / Importaciones','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.01'],
    ['code'=>'2.1.01.03','name'=>'Facturas y Documentos por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.01'],
    ['code'=>'2.1.02','name'=>'Obligaciones Financieras','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>'2.1'],
    ['code'=>'2.1.02.01','name'=>'Créditos Bancarios Corto Plazo','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.02'],
    ['code'=>'2.1.02.02','name'=>'Líneas de Crédito Utilizadas','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.02'],
    ['code'=>'2.1.02.03','name'=>'Contratos de Leasing Corto Plazo','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.02'],
    ['code'=>'2.1.03','name'=>'Remuneraciones y Beneficios por Pagar','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>'2.1'],
    ['code'=>'2.1.03.01','name'=>'Sueldos y Remuneraciones por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.03'],
    ['code'=>'2.1.03.02','name'=>'Cotizaciones Previsionales por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.03'],
    ['code'=>'2.1.03.03','name'=>'Gratificaciones y Bonos por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.03'],
    ['code'=>'2.1.03.04','name'=>'Provisión de Vacaciones del Personal','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.03'],
    ['code'=>'2.1.04','name'=>'Obligaciones Tributarias','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>'2.1'],
    ['code'=>'2.1.04.01','name'=>'Débito Fiscal IVA por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.04'],
    ['code'=>'2.1.04.02','name'=>'Impuesto Única 2da Categoría por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.04'],
    ['code'=>'2.1.04.03','name'=>'Retención Impuesto Retenido por Honorarios','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.04'],
    ['code'=>'2.1.04.04','name'=>'Impuesto de Primera Categoría por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.04'],
    ['code'=>'2.1.05','name'=>'Acreedores Varios','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>false,'parent'=>'2.1'],
    ['code'=>'2.1.05.01','name'=>'Acreedores Varios Corto Plazo','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.05'],
    ['code'=>'2.1.05.02','name'=>'Anticipos de Clientes','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.05'],
    ['code'=>'2.1.05.03','name'=>'Dividendos / Retiros por Pagar','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.05'],
    ['code'=>'2.1.05.04','name'=>'Provisiones para Gastos Operativos','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo Corriente','imp'=>true,'parent'=>'2.1.05'],
    ['code'=>'2.2','name'=>'PASIVO NO CORRIENTE','level'=>2,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>false,'parent'=>'2'],
    ['code'=>'2.2.01','name'=>'Obligaciones Financieras LP','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>false,'parent'=>'2.2'],
    ['code'=>'2.2.01.01','name'=>'Créditos Hipotecarios','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>true,'parent'=>'2.2.01'],
    ['code'=>'2.2.01.02','name'=>'Préstamos Bancarios Largo Plazo','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>true,'parent'=>'2.2.01'],
    ['code'=>'2.2.01.03','name'=>'Contratos de Leasing Largo Plazo','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>true,'parent'=>'2.2.01'],
    ['code'=>'2.2.02','name'=>'Otras Obligaciones con Partes Relacionadas','level'=>3,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>false,'parent'=>'2.2'],
    ['code'=>'2.2.02.01','name'=>'Préstamos de Socios / Accionistas','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>true,'parent'=>'2.2.02'],
    ['code'=>'2.2.02.02','name'=>'Ctas por Pagar a Empresas Relacionadas','level'=>4,'class'=>'2','nat'=>'Acreedora','clasif'=>'Pasivo No Corriente','imp'=>true,'parent'=>'2.2.02'],
    // 3 - PATRIMONIO NETO
    ['code'=>'3','name'=>'PATRIMONIO NETO','level'=>1,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>false,'parent'=>''],
    ['code'=>'3.1','name'=>'PATRIMONIO DE LOS DUEÑOS','level'=>2,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>false,'parent'=>'3'],
    ['code'=>'3.1.01','name'=>'Capital','level'=>3,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>false,'parent'=>'3.1'],
    ['code'=>'3.1.01.01','name'=>'Capital Pagado / Aportado','level'=>4,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.01'],
    ['code'=>'3.1.01.02','name'=>'Capital por Integrar','level'=>4,'class'=>'3','nat'=>'Deudora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.01'],
    ['code'=>'3.1.02','name'=>'Reservas','level'=>3,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>false,'parent'=>'3.1'],
    ['code'=>'3.1.02.01','name'=>'Reserva Legal','level'=>4,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.02'],
    ['code'=>'3.1.02.02','name'=>'Otras Reservas / Estatutarias','level'=>4,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.02'],
    ['code'=>'3.1.03','name'=>'Resultados Acumulados','level'=>3,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>false,'parent'=>'3.1'],
    ['code'=>'3.1.03.01','name'=>'Utilidades Acum. Ejercicios Anteriores','level'=>4,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.03'],
    ['code'=>'3.1.03.02','name'=>'( - ) Pérdidas Acum. Ejercicios Anteriores','level'=>4,'class'=>'3','nat'=>'Deudora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.03'],
    ['code'=>'3.1.04','name'=>'Resultado del Ejercicio','level'=>3,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>false,'parent'=>'3.1'],
    ['code'=>'3.1.04.01','name'=>'Utilidad (o Pérdida) del Ejercicio Actual','level'=>4,'class'=>'3','nat'=>'Acreedora','clasif'=>'Patrimonio Neto','imp'=>true,'parent'=>'3.1.04'],
    // 4 - INGRESOS OPERACIONALES
    ['code'=>'4','name'=>'INGRESOS OPERACIONALES','level'=>1,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>false,'parent'=>''],
    ['code'=>'4.1','name'=>'Ingresos por Ventas y Servicios','level'=>2,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>false,'parent'=>'4'],
    ['code'=>'4.1.01','name'=>'Ingresos por Ventas','level'=>3,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>false,'parent'=>'4.1'],
    ['code'=>'4.1.01.01','name'=>'Ventas Nacionales de Productos','level'=>4,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.01'],
    ['code'=>'4.1.01.02','name'=>'Ventas de Exportación','level'=>4,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.01'],
    ['code'=>'4.1.02','name'=>'Ingresos por Servicios','level'=>3,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>false,'parent'=>'4.1'],
    ['code'=>'4.1.02.01','name'=>'Ingresos por Servicios Profesionales','level'=>4,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.02'],
    ['code'=>'4.1.02.02','name'=>'Ingresos por Contratos de Mantenimiento','level'=>4,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.02'],
    ['code'=>'4.1.02.03','name'=>'Ingresos por Proyectos e Instalaciones','level'=>4,'class'=>'4','nat'=>'Acreedora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.02'],
    ['code'=>'4.1.03','name'=>'Devoluciones y Descuentos','level'=>3,'class'=>'4','nat'=>'Deudora','clasif'=>'Ingresos Operacionales','imp'=>false,'parent'=>'4.1'],
    ['code'=>'4.1.03.01','name'=>'( - ) Devoluciones en Ventas','level'=>4,'class'=>'4','nat'=>'Deudora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.03'],
    ['code'=>'4.1.03.02','name'=>'( - ) Descuentos Comerciales Otorgados','level'=>4,'class'=>'4','nat'=>'Deudora','clasif'=>'Ingresos Operacionales','imp'=>true,'parent'=>'4.1.03'],
    // 5 - COSTO DE VENTAS
    ['code'=>'5','name'=>'COSTO DE VENTAS','level'=>1,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>false,'parent'=>''],
    ['code'=>'5.1','name'=>'Costo de Mercadería Vendida','level'=>2,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>false,'parent'=>'5'],
    ['code'=>'5.1.01','name'=>'Costo de Compra','level'=>3,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>false,'parent'=>'5.1'],
    ['code'=>'5.1.01.01','name'=>'Costo de Compra de Productos Vendidos','level'=>4,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>true,'parent'=>'5.1.01'],
    ['code'=>'5.1.01.02','name'=>'Fletes y Gastos de Importación Directos','level'=>4,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>true,'parent'=>'5.1.01'],
    ['code'=>'5.1.02','name'=>'Costo de Prestación de Servicios','level'=>3,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>false,'parent'=>'5.1'],
    ['code'=>'5.1.02.01','name'=>'Remuneraciones Directas y Mano de Obra','level'=>4,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>true,'parent'=>'5.1.02'],
    ['code'=>'5.1.02.02','name'=>'Subcontratos y Servicios Externos Directos','level'=>4,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>true,'parent'=>'5.1.02'],
    ['code'=>'5.1.02.03','name'=>'Insumos y Materiales Directos para Servicios','level'=>4,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>true,'parent'=>'5.1.02'],
    ['code'=>'5.1.02.04','name'=>'Depreciación de Equipos Operativos','level'=>4,'class'=>'5','nat'=>'Deudora','clasif'=>'Costo de Ventas','imp'=>true,'parent'=>'5.1.02'],
    // 6 - GASTOS OPERACIONALES
    ['code'=>'6','name'=>'GASTOS OPERACIONALES','level'=>1,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>false,'parent'=>''],
    ['code'=>'6.1','name'=>'Gastos de Administración','level'=>2,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>false,'parent'=>'6'],
    ['code'=>'6.1.01','name'=>'Gastos de Personal Adm.','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>false,'parent'=>'6.1'],
    ['code'=>'6.1.01.01','name'=>'Sueldos y Salarios Personal de Administración','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.01'],
    ['code'=>'6.1.01.02','name'=>'Leyes Sociales y Aportes Patronales','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.01'],
    ['code'=>'6.1.01.03','name'=>'Capacitación y Bienestar del Personal','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.01'],
    ['code'=>'6.1.02','name'=>'Gastos de Funcionamiento Adm.','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>false,'parent'=>'6.1'],
    ['code'=>'6.1.02.01','name'=>'Arriendo de Oficinas y Locales','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.02'],
    ['code'=>'6.1.02.02','name'=>'Electricidad, Agua y Gas','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.02'],
    ['code'=>'6.1.02.03','name'=>'Telecomunicaciones e Internet','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.02'],
    ['code'=>'6.1.03','name'=>'Servicios Profesionales y Asesorías','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>false,'parent'=>'6.1'],
    ['code'=>'6.1.03.01','name'=>'Honorarios Contables y Auditoría','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.03'],
    ['code'=>'6.1.03.02','name'=>'Asesorías Legales y Técnicas','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.03'],
    ['code'=>'6.1.03.03','name'=>'Servicios Informáticos y Software Cloud','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.03'],
    ['code'=>'6.1.04','name'=>'Gastos Varios de Administración','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>false,'parent'=>'6.1'],
    ['code'=>'6.1.04.01','name'=>'Artículos de Oficina y Aseo','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.04'],
    ['code'=>'6.1.04.02','name'=>'Seguros Generales de Oficina','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.04'],
    ['code'=>'6.1.04.03','name'=>'Reparaciones y Mantenimiento de Oficina','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.04'],
    ['code'=>'6.1.04.04','name'=>'Depreciación Activos Fijos Administrativos','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Administración','imp'=>true,'parent'=>'6.1.04'],
    ['code'=>'6.2','name'=>'Gastos de Ventas','level'=>2,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>false,'parent'=>'6'],
    ['code'=>'6.2.01','name'=>'Gastos de Personal Comercial','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>false,'parent'=>'6.2'],
    ['code'=>'6.2.01.01','name'=>'Sueldos Equipo Comercial','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.01'],
    ['code'=>'6.2.01.02','name'=>'Comisiones e Incentivos por Ventas','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.01'],
    ['code'=>'6.2.02','name'=>'Publicidad y Promociones','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>false,'parent'=>'6.2'],
    ['code'=>'6.2.02.01','name'=>'Publicidad Digital (Google, Meta, LinkedIn)','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.02'],
    ['code'=>'6.2.02.02','name'=>'Imprenta, Merchandising y Materiales','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.02'],
    ['code'=>'6.2.02.03','name'=>'Gastos de Representación y Viajes Comerciales','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.02'],
    ['code'=>'6.2.03','name'=>'Gastos de Distribución y Despacho','level'=>3,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>false,'parent'=>'6.2'],
    ['code'=>'6.2.03.01','name'=>'Fletes y Despachos a Clientes','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.03'],
    ['code'=>'6.2.03.02','name'=>'Embalajes y Materiales de Despacho','level'=>4,'class'=>'6','nat'=>'Deudora','clasif'=>'Gastos de Ventas','imp'=>true,'parent'=>'6.2.03'],
    // 7 - RESULTADO NO OPERACIONAL
    ['code'=>'7','name'=>'RESULTADO NO OPERACIONAL','level'=>1,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>''],
    ['code'=>'7.1','name'=>'Ingresos No Operacionales','level'=>2,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>'7'],
    ['code'=>'7.1.01','name'=>'Ingresos Financieros','level'=>3,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>'7.1'],
    ['code'=>'7.1.01.01','name'=>'Intereses Ganados por Depósitos y Cuentas','level'=>4,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.1.01'],
    ['code'=>'7.1.01.02','name'=>'Ganancia por Diferencia de Cambio','level'=>4,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.1.01'],
    ['code'=>'7.1.01.03','name'=>'Reajustes y Corrección Monetaria Positiva','level'=>4,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.1.01'],
    ['code'=>'7.1.02','name'=>'Otros Ingresos No Operacionales','level'=>3,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>'7.1'],
    ['code'=>'7.1.02.01','name'=>'Ganancia en Venta de Activos Fijos','level'=>4,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.1.02'],
    ['code'=>'7.1.02.02','name'=>'Subsidios y Aportes Estatales / Fomento','level'=>4,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.1.02'],
    ['code'=>'7.1.02.03','name'=>'Otros Ingresos Extraordinarios','level'=>4,'class'=>'7','nat'=>'Acreedora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.1.02'],
    ['code'=>'7.2','name'=>'Gastos No Operacionales','level'=>2,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>'7'],
    ['code'=>'7.2.01','name'=>'Gastos Financieros','level'=>3,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>'7.2'],
    ['code'=>'7.2.01.01','name'=>'Intereses Bancarios y Financieros','level'=>4,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.2.01'],
    ['code'=>'7.2.01.02','name'=>'Comisiones Bancarias y Mantención de Cuentas','level'=>4,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.2.01'],
    ['code'=>'7.2.01.03','name'=>'Pérdida por Diferencia de Cambio','level'=>4,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.2.01'],
    ['code'=>'7.2.02','name'=>'Otros Gastos No Operacionales','level'=>3,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>false,'parent'=>'7.2'],
    ['code'=>'7.2.02.01','name'=>'Pérdida en Venta / Retiro de Activos Fijos','level'=>4,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.2.02'],
    ['code'=>'7.2.02.02','name'=>'Gastos No Deducibles e Intereses Penales','level'=>4,'class'=>'7','nat'=>'Deudora','clasif'=>'Resultado No Operacional','imp'=>true,'parent'=>'7.2.02'],
    ['code'=>'7.3','name'=>'Impuesto a la Renta','level'=>2,'class'=>'7','nat'=>'Deudora','clasif'=>'Impuesto a la Renta','imp'=>false,'parent'=>'7'],
    ['code'=>'7.3.01','name'=>'Impuesto de Primera Categoría','level'=>3,'class'=>'7','nat'=>'Deudora','clasif'=>'Impuesto a la Renta','imp'=>false,'parent'=>'7.3'],
    ['code'=>'7.3.01.01','name'=>'Gasto por Impuesto de Primera Categoría','level'=>4,'class'=>'7','nat'=>'Deudora','clasif'=>'Impuesto a la Renta','imp'=>true,'parent'=>'7.3.01'],
  ];
}
