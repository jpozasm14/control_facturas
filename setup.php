<?php
// setup.php — Inicializar base de datos (ejecutar una sola vez)
// =====================================================
require_once __DIR__ . '/php/config.php';

$message = '';

// La clave de setup y la contraseña del admin se configuran por entorno.
// Nunca dejar credenciales escritas en este archivo.
$setupKey = getenv('SETUP_KEY') ?: '';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $setupKey !== '' && ($_POST['setup_key'] ?? '') === $setupKey) {
  try {
    $pdo = db();

    // Crear tabla users
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(100) NOT NULL DEFAULT '',
      email VARCHAR(100) NOT NULL DEFAULT '',
      role ENUM('admin','user') NOT NULL DEFAULT 'user',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB");

    // Crear tabla facturas
    $pdo->exec("CREATE TABLE IF NOT EXISTS facturas (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      numero VARCHAR(50) NOT NULL DEFAULT '',
      fecha VARCHAR(20) NOT NULL DEFAULT '',
      neto DECIMAL(15,2) DEFAULT NULL,
      iva DECIMAL(15,2) DEFAULT NULL,
      total DECIMAL(15,2) DEFAULT NULL,
      descripcion TEXT NOT NULL,
      tipo_documento VARCHAR(30) NOT NULL DEFAULT 'Factura',
      tipo_operacion VARCHAR(20) NOT NULL DEFAULT 'Venta',
      cuenta_contable VARCHAR(20) NOT NULL DEFAULT '',
      imagen MEDIUMBLOB DEFAULT NULL,
      imagen_mime VARCHAR(30) NOT NULL DEFAULT 'image/jpeg',
      ocr_text MEDIUMTEXT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_fecha (fecha),
      INDEX idx_numero (numero),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");

    // Crear tabla plan_cuentas
    $pdo->exec("CREATE TABLE IF NOT EXISTS plan_cuentas (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      code VARCHAR(20) NOT NULL,
      name VARCHAR(200) NOT NULL,
      level TINYINT UNSIGNED NOT NULL DEFAULT 1,
      class CHAR(1) NOT NULL DEFAULT '1',
      nat VARCHAR(20) NOT NULL DEFAULT 'Deudora',
      clasif VARCHAR(50) NOT NULL DEFAULT '',
      imp TINYINT(1) NOT NULL DEFAULT 0,
      parent VARCHAR(20) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_code (user_id, code),
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");

    // Agregar columna asiento_num a facturas si no existe
    $cols = $pdo->query("SHOW COLUMNS FROM facturas LIKE 'asiento_num'")->fetch();
    if (!$cols) {
      $pdo->exec("ALTER TABLE facturas ADD COLUMN asiento_num INT UNSIGNED DEFAULT NULL AFTER ocr_text");
    }

    // Crear tabla libro_diario
    $pdo->exec("CREATE TABLE IF NOT EXISTS libro_diario (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      asiento_num INT UNSIGNED NOT NULL,
      fecha DATE NOT NULL,
      cuenta_code VARCHAR(20) NOT NULL,
      glosa TEXT NOT NULL,
      debe DECIMAL(15,2) DEFAULT 0,
      haber DECIMAL(15,2) DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      INDEX idx_asiento (user_id, asiento_num),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");

    // Crear tabla flujo_caja_ajustes
    $pdo->exec("CREATE TABLE IF NOT EXISTS flujo_caja_ajustes (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      fecha DATE NOT NULL,
      concepto VARCHAR(200) NOT NULL DEFAULT '',
      tipo ENUM('ingreso','egreso') NOT NULL DEFAULT 'egreso',
      monto DECIMAL(15,2) NOT NULL DEFAULT 0,
      clasificacion ENUM('operacional','inversion','financiamiento') NOT NULL DEFAULT 'operacional',
      notas TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB");

    // Crear usuario admin por defecto (contraseña configurable o aleatoria)
    $adminPass = getenv('SETUP_ADMIN_PASSWORD') ?: bin2hex(random_bytes(12));
    $hash = password_hash($adminPass, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare("INSERT IGNORE INTO users (username, password_hash, full_name, email, role)
                           VALUES ('admin', ?, 'Administrador', 'admin@keysciti.com', 'admin')");
    $stmt->execute([$hash]);

    $message = '<div style="color:#0a0; margin:20px; font-weight:bold;">✅ Base de datos inicializada correctamente.</div>
                <div style="margin:20px;">
                  <p><strong>Usuario admin:</strong> admin</p>
                  <p><strong>Contraseña:</strong> ' . htmlspecialchars($adminPass) . '</p>
                  <p><a href="login.php" style="color:#103B70;">Ir al login →</a></p>
                </div>';

  } catch (Exception $e) {
    $message = '<div style="color:#c00; margin:20px;">❌ Error: ' . htmlspecialchars($e->getMessage()) . '</div>';
  }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST' && $setupKey === '') {
  $message = '<div style="color:#c00; margin:20px;">❌ Define la variable de entorno SETUP_KEY para habilitar el setup.</div>';
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Setup — Control de Facturas</title>
  <style>
    body { font-family: 'Segoe UI', system-ui, sans-serif; background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .setup-card { background: #fff; border-radius: 14px; box-shadow: 0 8px 30px rgba(16,59,112,0.12); padding: 36px 32px; max-width: 450px; width: 100%; }
    .setup-card h1 { color: #103B70; font-size: 1.3rem; margin: 0 0 8px; text-align: center; }
    .setup-card p { color: #666; font-size: 0.85rem; text-align: center; margin: 0 0 24px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #555; margin-bottom: 5px; }
    .field input { width: 100%; padding: 10px 14px; border: 1.5px solid #d1d9e6; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; }
    .btn { width: 100%; padding: 12px; background: #103B70; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    .btn:hover { background: #0B2A51; }
  </style>
</head>
<body>
  <div class="setup-card">
    <h1>🔧 Setup — Control de Facturas</h1>
    <p>Inicializa la base de datos MySQL en tu hosting</p>

    <?= $message ?>

    <?php if (!$message): ?>
    <form method="POST">
      <div class="field">
        <label for="setup_key">Clave de setup</label>
        <input type="text" id="setup_key" name="setup_key" required placeholder="Ingresa la clave de setup">
      </div>
      <button type="submit" class="btn">Inicializar BD</button>
    </form>
    <?php endif; ?>
  </div>
</body>
</html>
