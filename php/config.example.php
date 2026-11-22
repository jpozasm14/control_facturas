<?php
// config.example.php — Plantilla de configuración (sin credenciales)
// Copiar a php/config.php y completar con los valores reales.
// El archivo php/config.php está ignorado por Git.

// Base de datos (se pueden definir como variables de entorno en el hosting)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: '');
define('DB_USER', getenv('DB_USER') ?: '');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

// Seguridad
define('SESSION_LIFETIME', 86400 * 7); // 7 días

// -----------------------------------------------------
// Conexión PDO
// -----------------------------------------------------
function db(): PDO {
  static $pdo = null;
  if ($pdo === null) {
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
  }
  return $pdo;
}

// -----------------------------------------------------
// Sesión
// -----------------------------------------------------
function startSession() {
  if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
      'lifetime' => SESSION_LIFETIME,
      'path'     => '/',
      'httponly'  => true,
      'samesite' => 'Lax',
    ]);
    session_start();
  }
}

function isLoggedIn(): bool {
  startSession();
  return !empty($_SESSION['user_id']);
}

function requireLogin() {
  if (!isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['error' => 'No autenticado']);
    exit;
  }
}

function currentUserId(): int {
  startSession();
  return (int)($_SESSION['user_id'] ?? 0);
}

function currentUserRole(): string {
  startSession();
  return $_SESSION['role'] ?? 'user';
}

// -----------------------------------------------------
// Respuesta JSON
// -----------------------------------------------------
function jsonResponse($data, int $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function jsonError(string $msg, int $code = 400) {
  jsonResponse(['error' => $msg], $code);
}
