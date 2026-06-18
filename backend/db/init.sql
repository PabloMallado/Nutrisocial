CREATE DATABASE IF NOT EXISTS nutrisocial;
USE nutrisocial;

CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  address VARCHAR(255) NULL,
  latitude DECIMAL(10, 7) NULL,
  longitude DECIMAL(10, 7) NULL,
  city VARCHAR(120) NOT NULL,
  logo VARCHAR(20) NOT NULL,
  accent VARCHAR(20) NOT NULL,
  image_url VARCHAR(500) NULL,
  source_provider VARCHAR(120) NULL,
  external_code VARCHAR(180) NULL,
  products_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  handle VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(180) NOT NULL UNIQUE,
  city VARCHAR(120) NULL,
  bio VARCHAR(300) NULL,
  avatar_url VARCHAR(500) NULL,
  verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  category VARCHAR(120) NOT NULL,
  brand VARCHAR(120) NOT NULL,
  store_id VARCHAR(50) NOT NULL,
  reference_amount DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
  reference_unit VARCHAR(30) NOT NULL DEFAULT 'g',
  image_url LONGTEXT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  stock INT NOT NULL DEFAULT 0,
  calories INT NOT NULL DEFAULT 0,
  protein DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  carbs DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  fat DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  source_provider VARCHAR(120) NULL,
  external_code VARCHAR(180) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_products_store (store_id)
);

INSERT INTO stores
  (id, name, description, address, latitude, longitude, city, logo, accent, image_url, source_provider, external_code)
VALUES
  ('open-food-facts', 'Open Food Facts', 'Productos reales importados desde la base de datos colaborativa Open Food Facts.', NULL, NULL, NULL, 'Global', 'OF', '#2f855a', NULL, 'open_food_facts', 'open-food-facts')
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  source_provider = VALUES(source_provider),
  external_code = VALUES(external_code);

CREATE TABLE IF NOT EXISTS recipes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  store_id VARCHAR(50) NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  steps TEXT NULL,
  image_url LONGTEXT NULL,
  servings INT NOT NULL DEFAULT 1,
  prep_time INT NOT NULL DEFAULT 0,
  difficulty ENUM('Facil', 'Media', 'Alta') NOT NULL DEFAULT 'Media',
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  calories_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  protein_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  carbs_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  fat_total DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_recipes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_recipes_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_recipes_user (user_id),
  INDEX idx_recipes_store (store_id)
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL DEFAULT 1,
  unit VARCHAR(30) NOT NULL DEFAULT 'unidad',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (recipe_id, product_id),
  CONSTRAINT fk_recipe_ingredients_recipe FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_recipe_ingredients_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS product_store_listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  store_id VARCHAR(50) NOT NULL,
  price DECIMAL(10, 2) NULL,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  availability_status ENUM('unknown', 'in_stock', 'low_stock', 'out_of_stock') NOT NULL DEFAULT 'unknown',
  offer_text VARCHAR(255) NULL,
  store_product_url VARCHAR(500) NULL,
  last_checked_at DATETIME NULL,
  source_provider VARCHAR(120) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_psl_product_store (product_id, store_id),
  CONSTRAINT fk_psl_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_psl_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_psl_store (store_id),
  INDEX idx_psl_status (availability_status)
);
