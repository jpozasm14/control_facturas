<?php
// hash_gen.php — Generar hash de contraseña (usar temporalmente y eliminar)
// Uso: php hash_gen.php 'mi-contraseña'
//      (o definir la variable de entorno NEW_PASSWORD)

$password = $argv[1] ?? (getenv('NEW_PASSWORD') ?: '');
if ($password === '') {
  fwrite(STDERR, "Uso: php hash_gen.php <contraseña>\n");
  exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
echo "Hash: $hash\n";
echo "\nSQL:\n";
echo "INSERT INTO users (username, password_hash, full_name, email, role) VALUES\n";
echo "('admin', '$hash', 'Administrador', 'admin@keysciti.com', 'admin');\n";
