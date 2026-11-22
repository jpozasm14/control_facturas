<?php
// logout.php — Cerrar sesión
require_once __DIR__ . '/config.php';
startSession();
session_destroy();
header('Location: /index.php');
exit;
