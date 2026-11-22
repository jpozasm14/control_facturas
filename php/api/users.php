<?php
// api/users.php — Gestión de usuarios (solo admin)
// =====================================================
require_once __DIR__ . '/../config.php';
startSession();
requireLogin();

if (currentUserRole() !== 'admin') {
  jsonError('Solo administradores pueden gestionar usuarios', 403);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
  case 'GET':
    // Listar usuarios
    $stmt = db()->query('SELECT id, username, full_name, email, role, created_at FROM users ORDER BY id');
    jsonResponse(['users' => $stmt->fetchAll()]);
    break;

  case 'POST':
    // Crear usuario
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $fullName = trim($data['full_name'] ?? '');
    $email    = trim($data['email'] ?? '');
    $role     = in_array($data['role'] ?? '', ['admin','user']) ? $data['role'] : 'user';

    if (!$username || !$password) jsonError('Usuario y contraseña son obligatorios');
    if (strlen($password) < 6) jsonError('La contraseña debe tener al menos 6 caracteres');

    $hash = password_hash($password, PASSWORD_DEFAULT);
    try {
      $stmt = db()->prepare('INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?, ?, ?, ?, ?)');
      $stmt->execute([$username, $hash, $fullName, $email, $role]);
      jsonResponse(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    } catch (PDOException $e) {
      if ($e->getCode() == 23000) jsonError('El usuario ya existe');
      throw $e;
    }
    break;

  case 'PUT':
    // Actualizar usuario
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? 0);
    if (!$id) jsonError('Falta id');

    $fields = [];
    $params = [];
    if (!empty($data['full_name'])) { $fields[] = 'full_name = ?'; $params[] = $data['full_name']; }
    if (!empty($data['email'])) { $fields[] = 'email = ?'; $params[] = $data['email']; }
    if (!empty($data['role']) && in_array($data['role'], ['admin','user'])) { $fields[] = 'role = ?'; $params[] = $data['role']; }
    if (!empty($data['password']) && strlen($data['password']) >= 6) {
      $fields[] = 'password_hash = ?';
      $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }

    if (empty($fields)) jsonError('Sin cambios');

    $params[] = $id;
    db()->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($params);
    jsonResponse(['ok' => true]);
    break;

  case 'DELETE':
    $data = json_decode(file_get_contents('php://input'), true);
    $id = (int)($data['id'] ?? ($_GET['id'] ?? 0));
    if (!$id) jsonError('Falta id');
    if ($id === currentUserId()) jsonError('No puedes eliminarte a ti mismo');

    db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    jsonResponse(['ok' => true]);
    break;
}
