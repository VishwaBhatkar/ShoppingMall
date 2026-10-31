# Shopping Mall – Complete Production-Oriented E-Commerce Mobile Application

Shopping Mall is a full-stack, multi-vendor e-commerce mobile application engineered with **React Native (JavaScript)**, **Node.js**, **Express.js**, **MySQL 8**, **Redux Toolkit**, **React Navigation**, and **JWT Authentication**.

The system provides three completely isolated roles with separate navigation stacks, dashboards, and role-based access control:
1. **Customer**: Marketplace browsing, real-time search, filters, category exploration, cart calculation, wishlist, simulated/COD checkout, order history, and shipment tracking.
2. **Seller**: Store performance dashboard, product catalog management (CRUD, image upload, SKU, stock quantity), order fulfillment workflow, sales analytics, and business profile.
3. **Admin**: Platform oversight, seller verification & approval pipeline, customer account management, product catalog moderation, mall-wide order tracking, category management, financial reports, and administrative security.

---

## 📁 Project Architecture

```
ShoppingMall/
├── backend/                        # Node.js & Express.js REST API Server
│   ├── src/
│   │   ├── config/                 # Database pool connection & transaction helpers
│   │   │   └── database.js
│   │   ├── controllers/            # Business logic controllers
│   │   │   ├── authController.js
│   │   │   ├── customerController.js
│   │   │   ├── productController.js
│   │   │   ├── cartController.js
│   │   │   ├── wishlistController.js
│   │   │   ├── orderController.js
│   │   │   ├── sellerController.js
│   │   │   └── adminController.js
│   │   ├── middleware/             # Role verification, JWT auth, uploads, error handling
│   │   │   ├── authMiddleware.js
│   │   │   ├── roleMiddleware.js
│   │   │   ├── uploadMiddleware.js
│   │   │   └── errorHandler.js
│   │   ├── routes/                 # REST API route declarations
│   │   │   ├── authRoutes.js
│   │   │   ├── customerRoutes.js
│   │   │   ├── productRoutes.js
│   │   │   ├── cartRoutes.js
│   │   │   ├── wishlistRoutes.js
│   │   │   ├── orderRoutes.js
│   │   │   ├── sellerRoutes.js
│   │   │   └── adminRoutes.js
│   │   ├── utils/                  # JWT tokens & standardized response helpers
│   │   │   ├── jwtUtils.js
│   │   │   └── responseUtils.js
│   │   ├── validators/             # Request payloads validation
│   │   │   └── authValidators.js
│   │   └── app.js                  # Express application setup & middleware
│   ├── uploads/                    # Local storage directory for uploaded product media
│   ├── .env                        # Server environment configuration
│   ├── .env.example
│   ├── package.json
│   └── server.js                   # Server entry point & database connectivity
│
├── database/                       # Normalized MySQL 8 schema & sample seed data
│   └── shopping_mall.sql           # Complete executable SQL file
│
├── frontend/                       # React Native Mobile Application
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   │   ├── Button.js
│   │   │   ├── Input.js
│   │   │   ├── ProductCard.js
│   │   │   ├── StatusBadge.js
│   │   │   ├── EmptyState.js
│   │   │   └── LoadingOverlay.js
│   │   ├── constants/              # Theme palette & API networking config
│   │   │   ├── colors.js
│   │   │   └── config.js
│   │   ├── navigation/             # Role-based React Navigation stacks
│   │   │   ├── AppNavigator.js
│   │   │   ├── AuthNavigator.js
│   │   │   ├── CustomerNavigator.js
│   │   │   ├── SellerNavigator.js
│   │   │   └── AdminNavigator.js
│   │   ├── redux/                  # Redux Toolkit store & slices
│   │   │   ├── store.js
│   │   │   └── slices/
│   │   │       ├── authSlice.js
│   │   │       └── cartSlice.js
│   │   ├── screens/                # UI screens organized by role
│   │   │   ├── auth/
│   │   │   │   ├── WelcomeScreen.js
│   │   │   │   ├── CustomerLoginScreen.js
│   │   │   │   ├── CustomerRegisterScreen.js
│   │   │   │   ├── SellerLoginScreen.js
│   │   │   │   ├── SellerRegisterScreen.js
│   │   │   │   ├── AdminLoginScreen.js
│   │   │   │   └── ForgotPasswordScreen.js
│   │   │   ├── customer/
│   │   │   │   ├── HomeScreen.js
│   │   │   │   ├── CategoriesScreen.js
│   │   │   │   ├── ProductDetailScreen.js
│   │   │   │   ├── SearchScreen.js
│   │   │   │   ├── CartScreen.js
│   │   │   │   ├── WishlistScreen.js
│   │   │   │   ├── CheckoutScreen.js
│   │   │   │   ├── OrdersScreen.js
│   │   │   │   ├── OrderDetailScreen.js
│   │   │   │   ├── ProfileScreen.js
│   │   │   │   └── AddressesScreen.js
│   │   │   ├── seller/
│   │   │   │   ├── SellerDashboardScreen.js
│   │   │   │   ├── SellerProductsScreen.js
│   │   │   │   ├── SellerProductFormScreen.js
│   │   │   │   ├── SellerOrdersScreen.js
│   │   │   │   ├── SellerSalesScreen.js
│   │   │   │   └── SellerProfileScreen.js
│   │   │   └── admin/
│   │   │       ├── AdminDashboardScreen.js
│   │   │       ├── AdminSellersScreen.js
│   │   │       ├── AdminCustomersScreen.js
│   │   │       ├── AdminProductsScreen.js
│   │   │       ├── AdminOrdersScreen.js
│   │   │       ├── AdminCategoriesScreen.js
│   │   │       ├── AdminReportsScreen.js
│   │   │       └── AdminProfileScreen.js
│   │   ├── services/               # Centralized Axios instance & REST service methods
│   │   │   ├── api.js
│   │   │   ├── authService.js
│   │   │   ├── productService.js
│   │   │   ├── cartService.js
│   │   │   ├── orderService.js
│   │   │   └── sellerService.js
│   │   └── utils/                  # Async storage session persistence
│   │       └── storage.js
│   ├── App.js                      # React Native root component & Redux provider
│   ├── index.js                    # Mobile application registry entry
│   └── package.json
│
└── README.md                       # Comprehensive documentation
```

---

## 🔐 Credentials & Authentication

### 1. Administrator (Hardcoded Server-Side Protection)
- **Email:** `admin@shoppingmall.com`
- **Password:** `Admin@123`
- *Note:* Admin registration is strictly prohibited. Master access is validated through backend server configuration.

### 2. Verified Approved Seller (TechWorld Electronics)
- **Email:** `tech@seller.com`
- **Password:** `Password@123`
- *Status:* `APPROVED` (Instant dashboard and product management access)

### 3. Pending Approval Seller (FreshMart Organics)
- **Email:** `fresh@seller.com`
- **Password:** `Password@123`
- *Status:* `PENDING` (Demonstrates approval restriction guard)

### 4. Registered Customer
- **Email:** `customer@shoppingmall.com`
- **Password:** `Password@123`

---

## 🗄️ MySQL Database Setup (`database/shopping_mall.sql`)

The database is normalized to 3NF, implements referential integrity, check constraints (preventing negative inventory), cascading deletes, and foreign keys across 19 relational tables:
1. `users`
2. `customers`
3. `sellers`
4. `admins`
5. `categories`
6. `products`
7. `product_images`
8. `addresses`
9. `carts`
10. `cart_items`
11. `wishlists`
12. `wishlist_items`
13. `orders`
14. `order_items`
15. `payments`
16. `order_status_history`
17. `inventory_transactions`
18. `reviews`
19. `notifications`

### How to Import Database:
```bash
# Log into MySQL CLI
mysql -u root -p

# Import the database schema & seed data
source D:/New folder/E-commerce_Application/ShoppingMall/database/shopping_mall.sql;
```

---

## 🚀 Step-by-Step Installation & Execution

### 1. Start MySQL 8
Ensure MySQL service is active and listening on `localhost:3306`.
Verify that database credentials in `ShoppingMall/backend/.env` match your local environment:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=manager
DB_NAME=shopping_mall_db
JWT_SECRET=shopping_mall_jwt_super_secure_secret_key_2026_xyz
```

### 2. Start Express Backend
```bash
cd ShoppingMall/backend
npm install
npm start
```
The server will output:
```
----------------------------------------------------
  SHOPPING MALL - BACKEND REST API SERVER
----------------------------------------------------
[Database] Connected successfully to MySQL (localhost:3306/shopping_mall_db)
[Server] Shopping Mall REST API is running on port 5000
[Server] Local URL:   http://localhost:5000
[Server] Healthcheck: http://localhost:5000/
----------------------------------------------------
```

### 3. Start React Native Mobile Frontend
```bash
cd ShoppingMall/frontend
npm start
```
You can run the app in:
- **Android Emulator / Device:** Press `a` in Expo CLI or run `npm run android`
- **Web Browser:** Press `w` in Expo CLI or run `npm run web`
- **Expo Go App:** Scan the terminal QR code on physical iOS / Android devices.

*Tip for Physical Devices:* In `ShoppingMall/frontend/src/constants/config.js`, update `API_BASE_URL` with your development workstation LAN IP (e.g., `http://192.168.1.100:5000/api`).

---

## 📡 REST API Modules Reference

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/customer/register` | Customer registration (creates cart & wishlist) |
| `POST` | `/api/auth/customer/login` | Customer JWT authentication |
| `POST` | `/api/auth/seller/register` | Seller registration (creates `PENDING` approval record) |
| `POST` | `/api/auth/seller/login` | Seller login (validates `APPROVED` status) |
| `POST` | `/api/auth/admin/login` | Hardcoded Administrator login |
| `GET` | `/api/auth/me` | Fetch currently authenticated user session |
| `POST` | `/api/auth/logout` | Client token revocation |
| `POST` | `/api/auth/forgot-password` | Request password reset code |
| `POST` | `/api/auth/reset-password` | Reset password using verification code |

### 2. Products & Categories (`/api/products`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products` | Browse products (with search, category, sort, price filters) |
| `GET` | `/api/products/search` | Search product catalog |
| `GET` | `/api/products/featured` | Fetch curated featured products |
| `GET` | `/api/products/categories` | List active departments & product counts |
| `GET` | `/api/products/category/:id`| Products filtered by category |
| `GET` | `/api/products/:id` | Full details, image gallery, seller info, reviews |

### 3. Shopping Cart (`/api/cart`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/cart` | Get cart with calculated subtotal, tax (8%), shipping, total |
| `POST` | `/api/cart` | Add product (validates and respects stock limits) |
| `PUT` | `/api/cart/items/:itemId` | Update quantity (+/- stepper, stock check) |
| `DELETE` | `/api/cart/items/:itemId` | Remove single item |
| `DELETE` | `/api/cart` | Clear entire cart |

### 4. Wishlist (`/api/wishlist`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/wishlist` | Fetch saved wishlist items |
| `POST` | `/api/wishlist` | Save product to wishlist |
| `DELETE` | `/api/wishlist/:productId` | Remove product from wishlist |

### 5. Orders & Checkout (`/api/orders`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/orders` | Place order (Atomic DB transaction: inventory deduction, payments, history, notification) |
| `GET` | `/api/orders` | Customer order history with items and statuses |
| `GET` | `/api/orders/:id` | Order tracking stepper, items breakdown, shipping details |
| `PUT` | `/api/orders/:id/cancel` | Cancel order (restores inventory, logs status change) |

### 6. Seller Portal (`/api/seller`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/seller/dashboard` | KPI stats (sales, orders, inventory, low stock alert) |
| `GET` | `/api/seller/products` | View seller's own products |
| `POST` | `/api/seller/products` | Create product (with image upload, SKU, stock) |
| `PUT` | `/api/seller/products/:id`| Update seller product |
| `DELETE` | `/api/seller/products/:id`| Delete seller product |
| `GET` | `/api/seller/orders` | Received orders with customer delivery address |
| `PUT` | `/api/seller/orders/:id/status`| Accept (`CONFIRMED`), Reject (`CANCELLED`), or advance fulfillment |
| `GET` | `/api/seller/sales` | Daily and monthly sales analytics |
| `GET` | `/api/seller/profile` | Seller business profile |
| `PUT` | `/api/seller/profile` | Update business profile details |

### 7. Administrator Portal (`/api/admin`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Global statistics (customers, sellers, orders, revenue) |
| `GET` | `/api/admin/customers` | Customer list & search |
| `PUT` | `/api/admin/customers/:id/status` | Activate / deactivate customer account |
| `DELETE` | `/api/admin/customers/:id` | Delete customer account |
| `GET` | `/api/admin/sellers` | All sellers (filter by `PENDING`, `APPROVED`, etc.) |
| `PUT` | `/api/admin/sellers/:id/approve` | Approve seller registration |
| `PUT` | `/api/admin/sellers/:id/reject` | Reject seller registration with explanation |
| `PUT` | `/api/admin/sellers/:id/status` | Suspend or reactivate seller |
| `GET` | `/api/admin/products` | Global product catalog moderation |
| `PUT` | `/api/admin/products/:id`| Moderate / toggle active product |
| `DELETE` | `/api/admin/products/:id`| Remove product from mall |
| `GET` | `/api/admin/orders` | View all platform orders |
| `GET` | `/api/admin/categories` | Department list |
| `POST` | `/api/admin/categories` | Add department |
| `PUT` | `/api/admin/categories/:id`| Edit department |
| `DELETE` | `/api/admin/categories/:id`| Delete department |
| `GET` | `/api/admin/reports` | Comprehensive financial, user growth & top product reports |
| `PUT` | `/api/admin/change-password` | Update administrator master password |

---

## 🛡️ Security Architecture
1. **Server-Side Token Verification**: The frontend role is never trusted. Every request verifies the user identity and role from the signed JWT against the MySQL database.
2. **Transaction Isolation**: Order creation and order cancellations execute inside ACID database transactions (`withTransaction`), preventing stock race conditions and negative inventory.
3. **Data Isolation**: Sellers can only view and mutate their own products and order items (`WHERE seller_id = ?`). Customers can only view and cancel their own orders.
4. **Seller Moderation**: Sellers with `PENDING` or `REJECTED` status are blocked by `requireApprovedSeller` middleware from listing products or accessing merchant operations.
5. **SQL Injection Defense**: Every database interaction uses parameterized SQL queries (`?` placeholders).
