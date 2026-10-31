-- =====================================================================
-- SHOPPING MALL - COMPLETE E-COMMERCE DATABASE SCHEMA (MySQL 8)
-- Production Grade Normalized Database with Sample Seed Data
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `shopping_mall_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `shopping_mall_db`;

-- Disable foreign key checks for clean recreation
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `notifications`;
DROP TABLE IF EXISTS `reviews`;
DROP TABLE IF EXISTS `inventory_transactions`;
DROP TABLE IF EXISTS `order_status_history`;
DROP TABLE IF EXISTS `payments`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `wishlist_items`;
DROP TABLE IF EXISTS `wishlists`;
DROP TABLE IF EXISTS `cart_items`;
DROP TABLE IF EXISTS `carts`;
DROP TABLE IF EXISTS `addresses`;
DROP TABLE IF EXISTS `product_images`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `admins`;
DROP TABLE IF EXISTS `sellers`;
DROP TABLE IF EXISTS `customers`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. USERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('CUSTOMER', 'SELLER', 'ADMIN') NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. CUSTOMERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `full_name` VARCHAR(150) NOT NULL,
  `mobile_number` VARCHAR(30) NOT NULL UNIQUE,
  `address` TEXT NULL,
  `avatar_url` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_customers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. SELLERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `sellers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `business_name` VARCHAR(191) NOT NULL,
  `owner_name` VARCHAR(150) NOT NULL,
  `mobile_number` VARCHAR(30) NOT NULL UNIQUE,
  `business_address` TEXT NOT NULL,
  `gst_number` VARCHAR(50) NULL,
  `approval_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
  `rejection_reason` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_sellers_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_sellers_status` (`approval_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. ADMINS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_admins_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. CATEGORIES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `description` TEXT NULL,
  `image_url` VARCHAR(255) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_categories_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. PRODUCTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `seller_id` INT NOT NULL,
  `category_id` INT NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NOT NULL,
  `price` DECIMAL(10, 2) NOT NULL,
  `discount_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `stock_quantity` INT NOT NULL DEFAULT 0,
  `sku` VARCHAR(100) NOT NULL UNIQUE,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `is_featured` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_approved` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_products_seller` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `chk_products_stock` CHECK (`stock_quantity` >= 0),
  INDEX `idx_products_seller` (`seller_id`),
  INDEX `idx_products_category` (`category_id`),
  INDEX `idx_products_active` (`is_active`),
  INDEX `idx_products_featured` (`is_featured`),
  INDEX `idx_products_price` (`price`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. PRODUCT IMAGES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `product_images` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `image_url` VARCHAR(255) NOT NULL,
  `is_primary` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_images_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  INDEX `idx_product_images_prod` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. ADDRESSES TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `addresses` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL,
  `recipient_name` VARCHAR(150) NOT NULL,
  `phone_number` VARCHAR(30) NOT NULL,
  `street_address` TEXT NOT NULL,
  `city` VARCHAR(100) NOT NULL,
  `state` VARCHAR(100) NOT NULL,
  `postal_code` VARCHAR(20) NOT NULL,
  `country` VARCHAR(100) NOT NULL DEFAULT 'India',
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_addresses_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  INDEX `idx_addresses_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. CARTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `carts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL UNIQUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_carts_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. CART ITEMS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `cart_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `cart_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_cart_items_cart` FOREIGN KEY (`cart_id`) REFERENCES `carts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cart_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `uq_cart_product` UNIQUE (`cart_id`, `product_id`),
  CONSTRAINT `chk_cart_qty_positive` CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. WISHLISTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `wishlists` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `customer_id` INT NOT NULL UNIQUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wishlists_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12. WISHLIST ITEMS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `wishlist_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `wishlist_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wishlist_items_wishlist` FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wishlist_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `uq_wishlist_product` UNIQUE (`wishlist_id`, `product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 13. ORDERS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(50) NOT NULL UNIQUE,
  `customer_id` INT NOT NULL,
  `shipping_address_id` INT NULL,
  `shipping_address_text` TEXT NOT NULL,
  `subtotal` DECIMAL(10, 2) NOT NULL,
  `tax` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `shipping_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_amount` DECIMAL(10, 2) NOT NULL,
  `order_status` ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `cancellation_reason` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_orders_address` FOREIGN KEY (`shipping_address_id`) REFERENCES `addresses` (`id`) ON DELETE SET NULL,
  INDEX `idx_orders_customer` (`customer_id`),
  INDEX `idx_orders_status` (`order_status`),
  INDEX `idx_orders_number` (`order_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 14. ORDER ITEMS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `seller_id` INT NOT NULL,
  `product_name` VARCHAR(200) NOT NULL,
  `unit_price` DECIMAL(10, 2) NOT NULL,
  `quantity` INT NOT NULL,
  `total_price` DECIMAL(10, 2) NOT NULL,
  `status` ENUM('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_order_items_seller` FOREIGN KEY (`seller_id`) REFERENCES `sellers` (`id`) ON DELETE RESTRICT,
  INDEX `idx_order_items_seller` (`seller_id`),
  INDEX `idx_order_items_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 15. PAYMENTS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `payments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `payment_method` ENUM('COD', 'SIMULATED_CARD', 'SIMULATED_UPI', 'SIMULATED_NETBANKING') NOT NULL,
  `payment_status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED') NOT NULL DEFAULT 'PENDING',
  `transaction_reference` VARCHAR(100) NULL,
  `amount` DECIMAL(10, 2) NOT NULL,
  `payment_details` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_payments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  INDEX `idx_payments_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 16. ORDER STATUS HISTORY TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `order_status_history` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `old_status` VARCHAR(50) NULL,
  `new_status` VARCHAR(50) NOT NULL,
  `changed_by_user_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_history_user` FOREIGN KEY (`changed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  INDEX `idx_order_history_order` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 17. INVENTORY TRANSACTIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `inventory_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `change_quantity` INT NOT NULL,
  `reason` ENUM('ORDER_RESERVED', 'ORDER_CANCELLED', 'RESTOCK', 'ADJUSTMENT', 'MANUAL_UPDATE') NOT NULL,
  `reference_order_id` INT NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_order` FOREIGN KEY (`reference_order_id`) REFERENCES `orders` (`id`) ON DELETE SET NULL,
  INDEX `idx_inv_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 18. REVIEWS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `reviews` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `product_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  `rating` INT NOT NULL,
  `comment` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_reviews_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_reviews_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chk_reviews_rating` CHECK (`rating` >= 1 AND `rating` <= 5),
  INDEX `idx_reviews_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 19. NOTIFICATIONS TABLE
-- ---------------------------------------------------------------------
CREATE TABLE `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `message` TEXT NOT NULL,
  `is_read` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  INDEX `idx_notifications_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- SEED SAMPLE DATA
-- Passwords:
-- Admin (admin@shoppingmall.com): Admin@123 -> $2b$10$8oLEjsqCy69hPlF5mvqox.4BiIxpw7iooccO9W9f82BEV3/NrelTS
-- Sellers / Customers: Password@123 -> $2b$10$MRcFDgfAUXCO/j9thCiO2eDfDODT5DtYryRvpiEBZJXtal7jV2yVC
-- =====================================================================

-- Insert Users
INSERT INTO `users` (`id`, `email`, `password_hash`, `role`, `is_active`) VALUES
(1, 'admin@shoppingmall.com', '$2b$10$8oLEjsqCy69hPlF5mvqox.4BiIxpw7iooccO9W9f82BEV3/NrelTS', 'ADMIN', TRUE),
(2, 'tech@seller.com', '$2b$10$MRcFDgfAUXCO/j9thCiO2eDfDODT5DtYryRvpiEBZJXtal7jV2yVC', 'SELLER', TRUE),
(3, 'fashion@seller.com', '$2b$10$MRcFDgfAUXCO/j9thCiO2eDfDODT5DtYryRvpiEBZJXtal7jV2yVC', 'SELLER', TRUE),
(4, 'fresh@seller.com', '$2b$10$MRcFDgfAUXCO/j9thCiO2eDfDODT5DtYryRvpiEBZJXtal7jV2yVC', 'SELLER', TRUE),
(5, 'customer@shoppingmall.com', '$2b$10$MRcFDgfAUXCO/j9thCiO2eDfDODT5DtYryRvpiEBZJXtal7jV2yVC', 'CUSTOMER', TRUE),
(6, 'john.doe@example.com', '$2b$10$MRcFDgfAUXCO/j9thCiO2eDfDODT5DtYryRvpiEBZJXtal7jV2yVC', 'CUSTOMER', TRUE);

-- Insert Admin Record
INSERT INTO `admins` (`id`, `user_id`, `name`) VALUES
(1, 1, 'Master Administrator');

-- Insert Sellers Records (2 Approved, 1 Pending)
INSERT INTO `sellers` (`id`, `user_id`, `business_name`, `owner_name`, `mobile_number`, `business_address`, `gst_number`, `approval_status`) VALUES
(1, 2, 'TechWorld Electronics', 'Vikram Sharma', '+91 98765 43210', 'Tower A, Electronic City Phase 1, Bangalore, Karnataka', '29ABCDE1234F1Z5', 'APPROVED'),
(2, 3, 'StyleHub Apparels', 'Pooja Mehta', '+91 98765 43211', '124 Commercial Street, Mumbai, Maharashtra', '27ABCDE5678F1Z2', 'APPROVED'),
(3, 4, 'FreshMart Organics', 'Anand Verma', '+91 98765 43212', '45 Green Park Avenue, New Delhi', '07ABCDE9012F1Z9', 'PENDING');

-- Insert Customers Records
INSERT INTO `customers` (`id`, `user_id`, `full_name`, `mobile_number`, `address`, `avatar_url`) VALUES
(1, 5, 'Rahul Deshmukh', '+91 99887 76655', 'B-402 Sunshine Towers, Andheri West, Mumbai', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'),
(2, 6, 'John Doe', '+91 99887 76656', 'Flat 12, Skyline Residency, Koramangala, Bangalore', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61');

-- Insert Categories
INSERT INTO `categories` (`id`, `name`, `description`, `image_url`, `is_active`) VALUES
(1, 'Electronics', 'Smartphones, laptops, audio gear, and cutting-edge tech gadgets.', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=600', TRUE),
(2, 'Fashion & Apparel', 'Trendy men and women clothing, shoes, watches, and accessories.', 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600', TRUE),
(3, 'Home & Kitchen', 'Modern home decor, cookware, dining, and smart appliances.', 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600', TRUE),
(4, 'Sports & Fitness', 'Fitness equipment, sportswear, gym accessories, and outdoor gear.', 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600', TRUE),
(5, 'Beauty & Personal Care', 'Skincare, perfumes, hair care, and luxury cosmetics.', 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600', TRUE),
(6, 'Books & Stationery', 'Bestsellers, academic books, notebooks, and office essentials.', 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600', TRUE);

-- Insert Products
INSERT INTO `products` (`id`, `seller_id`, `category_id`, `name`, `description`, `price`, `discount_percent`, `stock_quantity`, `sku`, `is_active`, `is_featured`, `is_approved`) VALUES
(1, 1, 1, 'Pro Wireless ANC Headphones', 'High fidelity wireless over-ear headphones with active noise cancellation, 40-hour battery life, and ultra-comfortable memory foam ear cushions.', 149.99, 15.00, 45, 'TECH-HP-001', TRUE, TRUE, TRUE),
(2, 1, 1, 'Ultra Slim 4K Smart Monitor 27"', 'Stunning 27-inch 4K IPS display with 99% sRGB color gamut, USB-C 65W power delivery, and ultra-thin bezels for creators and gamers.', 349.50, 10.00, 20, 'TECH-MON-002', TRUE, TRUE, TRUE),
(3, 1, 1, 'Mechanical Gaming Keyboard RGB', 'Compact tenkeyless mechanical keyboard featuring tactile brown switches, per-key RGB backlighting, and braided detachable cable.', 79.99, 20.00, 60, 'TECH-KB-003', TRUE, FALSE, TRUE),
(4, 1, 1, 'Fast Wireless Charging Pad 15W', 'Qi-certified fast wireless charging pad with intelligent heat management and non-slip silicone base. Compatible with all modern phones.', 29.99, 0.00, 110, 'TECH-WCP-004', TRUE, FALSE, TRUE),
(5, 2, 2, 'Classic Cotton Oxford Shirt', 'Tailored fit premium 100% breathable cotton oxford shirt. Perfect for business casual or weekend smart wear.', 39.99, 10.00, 85, 'FASH-SHT-101', TRUE, TRUE, TRUE),
(6, 2, 2, 'Urban Commuter Waterproof Backpack', 'Durable 25L water-resistant everyday backpack with padded laptop sleeve (up to 16 inch), hidden security pocket, and ergonomic airflow straps.', 59.99, 25.00, 30, 'FASH-BP-102', TRUE, TRUE, TRUE),
(7, 2, 2, 'Minimalist Chronograph Watch', 'Sleek matte black stainless steel watch with Japanese quartz movement, genuine leather strap, and 50m water resistance.', 89.00, 15.00, 40, 'FASH-WAT-103', TRUE, TRUE, TRUE),
(8, 2, 2, 'Running Performance Sneakers', 'Lightweight responsive cushioning running shoes engineered with breathable engineered mesh and high-traction rubber outsole.', 74.50, 5.00, 50, 'FASH-SNK-104', TRUE, FALSE, TRUE),
(9, 1, 3, 'Smart Temperature Control Mug', 'Keep your favorite coffee or tea at the exact drinking temperature from the first sip to the last drop with smartphone app sync.', 99.00, 10.00, 25, 'HOME-MUG-201', TRUE, TRUE, TRUE),
(10, 2, 4, 'Adjustable Quick-Select Dumbbell', 'Compact space-saving dumbbell with quick twist adjustment from 5 lbs to 52.5 lbs. Ideal for home workouts.', 199.99, 12.00, 15, 'SPRT-DMB-301', TRUE, TRUE, TRUE),
(11, 2, 5, 'Organic Argan Oil Facial Serum', 'Cold-pressed 100% pure organic Moroccan argan oil rich in Vitamin E and antioxidants for deep hydration and radiant glow.', 24.99, 0.00, 75, 'BEAU-SRM-401', TRUE, FALSE, TRUE),
(12, 1, 1, 'Pocket Bluetooth Speaker IPX7', 'Crisp loud 360-degree audio with punchy bass, IPX7 waterproof rating, and 12-hour playtime on a single charge.', 44.99, 18.00, 90, 'TECH-SPK-005', TRUE, FALSE, TRUE);

-- Insert Product Images
INSERT INTO `product_images` (`product_id`, `image_url`, `is_primary`) VALUES
(1, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', TRUE),
(2, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800', TRUE),
(3, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800', TRUE),
(4, 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=800', TRUE),
(5, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800', TRUE),
(6, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800', TRUE),
(7, 'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800', TRUE),
(8, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800', TRUE),
(9, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800', TRUE),
(10, 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800', TRUE),
(11, 'https://images.unsplash.com/photo-1608248597359-5735b5a452bf?w=800', TRUE),
(12, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800', TRUE);

-- Insert Customer Delivery Addresses
INSERT INTO `addresses` (`id`, `customer_id`, `recipient_name`, `phone_number`, `street_address`, `city`, `state`, `postal_code`, `country`, `is_default`) VALUES
(1, 1, 'Rahul Deshmukh', '+91 99887 76655', 'Flat 402, Sunshine Towers, Link Road, Andheri West', 'Mumbai', 'Maharashtra', '400053', 'India', TRUE),
(2, 1, 'Rahul (Office)', '+91 99887 76655', 'Mindspace Tech Park, Building 5, Level 3, Malad West', 'Mumbai', 'Maharashtra', '400064', 'India', FALSE),
(3, 2, 'John Doe', '+91 99887 76656', 'Villa 22, Green Valley, Indiranagar', 'Bangalore', 'Karnataka', '560038', 'India', TRUE);

-- Create Initial Carts & Wishlists
INSERT INTO `carts` (`id`, `customer_id`) VALUES
(1, 1),
(2, 2);

INSERT INTO `wishlists` (`id`, `customer_id`) VALUES
(1, 1),
(2, 2);

-- Cart Items for customer 1
INSERT INTO `cart_items` (`cart_id`, `product_id`, `quantity`) VALUES
(1, 1, 1),
(1, 6, 2);

-- Wishlist Items for customer 1
INSERT INTO `wishlist_items` (`wishlist_id`, `product_id`) VALUES
(1, 2),
(1, 7);

-- Seed Past Order
INSERT INTO `orders` (`id`, `order_number`, `customer_id`, `shipping_address_id`, `shipping_address_text`, `subtotal`, `tax`, `shipping_fee`, `total_amount`, `order_status`) VALUES
(1, 'ORD-20261028-1001', 1, 1, 'Rahul Deshmukh, Flat 402 Sunshine Towers, Andheri West, Mumbai, Maharashtra 400053 (Ph: +91 99887 76655)', 127.49, 10.20, 0.00, 137.69, 'DELIVERED'),
(2, 'ORD-20261029-1002', 1, 1, 'Rahul Deshmukh, Flat 402 Sunshine Towers, Andheri West, Mumbai, Maharashtra 400053 (Ph: +91 99887 76655)', 79.99, 6.40, 5.00, 91.39, 'CONFIRMED');

-- Order Items
INSERT INTO `order_items` (`order_id`, `product_id`, `seller_id`, `product_name`, `unit_price`, `quantity`, `total_price`, `status`) VALUES
(1, 1, 1, 'Pro Wireless ANC Headphones', 127.49, 1, 127.49, 'DELIVERED'),
(2, 3, 1, 'Mechanical Gaming Keyboard RGB', 79.99, 1, 79.99, 'CONFIRMED');

-- Order Payments
INSERT INTO `payments` (`order_id`, `payment_method`, `payment_status`, `transaction_reference`, `amount`, `payment_details`) VALUES
(1, 'SIMULATED_CARD', 'COMPLETED', 'SIM-TXN-98471234', 137.69, 'Simulated Card Payment: Visa ending in 4242'),
(2, 'COD', 'PENDING', 'COD-TXN-56291048', 91.39, 'Cash on Delivery selected');

-- Order Status History
INSERT INTO `order_status_history` (`order_id`, `old_status`, `new_status`, `changed_by_user_id`, `notes`) VALUES
(1, NULL, 'PENDING', 5, 'Order placed by customer'),
(1, 'PENDING', 'CONFIRMED', 2, 'Seller confirmed the order'),
(1, 'CONFIRMED', 'PROCESSING', 2, 'Packaging in progress'),
(1, 'PROCESSING', 'SHIPPED', 2, 'Handed over to courier'),
(1, 'SHIPPED', 'DELIVERED', 2, 'Delivered to customer doorstep'),
(2, NULL, 'PENDING', 5, 'Order placed by customer'),
(2, 'PENDING', 'CONFIRMED', 2, 'Order confirmed by seller');

-- Inventory Transactions
INSERT INTO `inventory_transactions` (`product_id`, `change_quantity`, `reason`, `reference_order_id`, `notes`) VALUES
(1, -1, 'ORDER_RESERVED', 1, 'Stock reserved for order ORD-20261028-1001'),
(3, -1, 'ORDER_RESERVED', 2, 'Stock reserved for order ORD-20261029-1002'),
(1, 50, 'RESTOCK', NULL, 'Initial inventory batch loaded');

-- Reviews
INSERT INTO `reviews` (`product_id`, `customer_id`, `rating`, `comment`) VALUES
(1, 1, 5, 'Exceptional sound quality and ANC! The battery life easily matches the claim.'),
(5, 1, 4, 'Very comfortable fit and premium cotton feel. Highly recommended.');

-- Notifications
INSERT INTO `notifications` (`user_id`, `title`, `message`, `is_read`) VALUES
(5, 'Welcome to Shopping Mall!', 'Explore top deals and verified sellers today.', TRUE),
(5, 'Order Delivered', 'Your order ORD-20261028-1001 has been delivered successfully.', FALSE),
(2, 'New Order Received', 'Order ORD-20261029-1002 is awaiting fulfillment.', FALSE),
(1, 'Pending Seller Registrations', 'FreshMart Organics is waiting for verification and approval.', FALSE);
