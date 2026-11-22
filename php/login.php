<?php
// login.php — Autenticación de usuarios
// =====================================================
require_once __DIR__ . '/config.php';
startSession();

// Si ya está logueado, redirigir
if (isLoggedIn()) {
  header('Location: index.php');
  exit;
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $username = trim($_POST['username'] ?? '');
  $password = $_POST['password'] ?? '';

  if ($username === '' || $password === '') {
    $error = 'Ingresa usuario y contraseña.';
  } else {
    try {
      $stmt = db()->prepare('SELECT id, username, password_hash, full_name, role FROM users WHERE username = ? LIMIT 1');
      $stmt->execute([$username]);
      $user = $stmt->fetch();

      if ($user && password_verify($password, $user['password_hash'])) {
        session_regenerate_id(true);
        $_SESSION['user_id']   = $user['id'];
        $_SESSION['username']  = $user['username'];
        $_SESSION['full_name'] = $user['full_name'];
        $_SESSION['role']      = $user['role'];
  header('Location: /index.php');
        exit;
      } else {
        $error = 'Usuario o contraseña incorrectos.';
      }
    } catch (PDOException $e) {
      $error = 'Error de conexión: ' . $e->getMessage();
    }
  }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Iniciar sesión — Control de Facturas</title>
  <link rel="stylesheet" href="css/styles.css?v=7">
  <style>
    body { background: #f0f4f8; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; }
    .login-wrapper { width: 100%; max-width: 400px; padding: 20px; }
    .login-card { background: #fff; border-radius: 14px; box-shadow: 0 8px 30px rgba(16,59,112,0.12); padding: 36px 32px; }
    .login-logo { text-align: center; margin-bottom: 24px; }
    .login-logo img { height: 60px; }
    .login-logo h1 { font-size: 1.2rem; color: #103B70; margin: 12px 0 4px; }
    .login-logo p { font-size: 0.85rem; color: #888; margin: 0; }
    .login-card h2 { text-align: center; font-size: 1.1rem; color: #333; margin: 0 0 20px; }
    .field { margin-bottom: 16px; }
    .field label { display: block; font-size: 0.8rem; font-weight: 600; color: #555; margin-bottom: 5px; }
    .field input { width: 100%; padding: 10px 14px; border: 1.5px solid #d1d9e6; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; }
    .field input:focus { outline: none; border-color: #103B70; box-shadow: 0 0 0 3px rgba(16,59,112,0.1); }
    .btn-login { width: 100%; padding: 12px; background: #103B70; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .btn-login:hover { background: #0B2A51; }
    .login-error { background: #fee; border: 1px solid #fcc; color: #c33; padding: 10px 14px; border-radius: 8px; font-size: 0.85rem; margin-bottom: 16px; text-align: center; }
    .login-footer { text-align: center; margin-top: 16px; font-size: 0.78rem; color: #aaa; }
  </style>
</head>
<body>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="login-logo">
        <img src="assets/logo_keysciti.png" alt="KeysCITI">
        <h1>Control de Facturas</h1>
        <p>Sistema de gestión de facturas y plan de cuentas</p>
      </div>

      <h2>Iniciar sesión</h2>

      <?php if ($error): ?>
        <div class="login-error"><?= htmlspecialchars($error) ?></div>
      <?php endif; ?>

      <form method="POST" action="/php/login.php">
        <div class="field">
          <label for="username">Usuario</label>
          <input type="text" id="username" name="username" required autofocus placeholder="Tu usuario">
        </div>
        <div class="field">
          <label for="password">Contraseña</label>
          <input type="password" id="password" name="password" required placeholder="Tu contraseña">
        </div>
        <button type="submit" class="btn-login">Entrar</button>
      </form>
    </div>
    <div class="login-footer">KeysCITI &copy; <?= date('Y') ?> — Control de Facturas v2.0</div>
  </div>
</body>
</html>
