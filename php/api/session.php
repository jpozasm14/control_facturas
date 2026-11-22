<?php
// api/session.php — Verificar sesión y logout
// =====================================================
require_once __DIR__ . '/../config.php';
startSession();

$action = $_GET['action'] ?? 'check';

if ($action === 'check') {
  if (isLoggedIn()) {
    jsonResponse([
      'logged_in' => true,
      'user_id'   => currentUserId(),
      'username'  => $_SESSION['username'] ?? '',
      'full_name' => $_SESSION['full_name'] ?? '',
      'role'      => currentUserRole(),
    ]);
  } else {
    jsonResponse(['logged_in' => false], 401);
  }
} elseif ($action === 'logout') {
  session_destroy();
  jsonResponse(['ok' => true]);
}
