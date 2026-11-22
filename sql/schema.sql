-- =====================================================
-- Base de datos: keysciti_facturas
-- Control de Facturas — KeysCITI
-- =====================================================
-- NOTA: La BD ya fue creada en Hostinger.
-- Este script solo crea las tablas dentro de ella.

-- -----------------------------------------------------
-- Tabla de usuarios (login)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(100) NOT NULL DEFAULT '',
  email         VARCHAR(100) NOT NULL DEFAULT '',
  role          ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabla de facturas
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS facturas (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  numero          VARCHAR(50)  NOT NULL DEFAULT '',
  fecha           VARCHAR(20)  NOT NULL DEFAULT '',
  neto            DECIMAL(15,2) DEFAULT NULL,
  iva             DECIMAL(15,2) DEFAULT NULL,
  total           DECIMAL(15,2) DEFAULT NULL,
  descripcion     TEXT NOT NULL,
  tipo_documento  VARCHAR(30)  NOT NULL DEFAULT 'Factura',
  tipo_operacion  VARCHAR(20)  NOT NULL DEFAULT 'Venta',
  cuenta_contable VARCHAR(20)  NOT NULL DEFAULT '',
  imagen          MEDIUMBLOB   DEFAULT NULL,
  imagen_mime     VARCHAR(30)  NOT NULL DEFAULT 'image/jpeg',
  ocr_text        MEDIUMTEXT   DEFAULT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_fecha (fecha),
  INDEX idx_numero (numero),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- -----------------------------------------------------
-- Tabla del plan de cuentas
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS plan_cuentas (
  id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id   INT UNSIGNED NOT NULL,
  code      VARCHAR(20)  NOT NULL,
  name      VARCHAR(200) NOT NULL,
  level     TINYINT UNSIGNED NOT NULL DEFAULT 1,
  class     CHAR(1)      NOT NULL DEFAULT '1',
  nat       VARCHAR(20)  NOT NULL DEFAULT 'Deudora',
  clasif    VARCHAR(50)  NOT NULL DEFAULT '',
  imp       TINYINT(1)   NOT NULL DEFAULT 0,
  parent    VARCHAR(20)  NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_code (user_id, code),
  INDEX idx_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
