# Smart Medicine Authentication System

A full-stack web application for online medicine shopping with QR-based medicine authentication using blockchain technology to prevent counterfeit medicines.

## Features

- **User Management** — Role-based authentication (Customer, Pharmacy, Manufacturer, Admin)
- **Online Medicine Shopping** — Browse, search, and order medicines
- **QR-Based Verification** — Scan QR codes to verify medicine authenticity
- **Blockchain Integration** — Immutable ledger for medicine authentication records
- **Order Management** — Full order lifecycle with status tracking
- **Dosage & Safety Information** — Displayed only after successful verification
- **Admin Dashboard** — User management, analytics, and reporting
- **Notifications** — Real-time alerts for orders and verification results

## Tech Stack

- **Backend:** Node.js, Express.js, SQLite (better-sqlite3)
- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **UI Design:** Glassmorphism with animated background
- **Authentication:** JWT (JSON Web Tokens)
- **Security:** bcrypt password hashing, blockchain hash verification

## Project Structure

```
SmartMedicineAuthSystem/
├── backend/
│   ├── server.js              # Express server entry point
│   ├── database.js            # SQLite database setup & seeding
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js            # Authentication routes
│   │   ├── medicines.js       # Medicine management routes
│   │   ├── orders.js          # Order management routes
│   │   ├── qr.js              # QR verification routes
│   │   └── admin.js           # Admin panel routes
│   └── utils/
│       └── blockchain.js      # Blockchain hash verification
├── frontend/
│   ├── index.html             # Main application page
│   ├── css/
│   │   └── glassmorphism.css  # Glassmorphism UI styles
│   └── js/
│       └── app.js             # Frontend application logic
├── package.json               # Node.js dependencies
└── README.md                  # This file
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm (comes with Node.js)

### Installation

1. Navigate to the project directory:
   ```bash
   cd "SmartMedicineAuthSystem"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and visit:
   ```
   http://localhost:3000
   ```

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartmed.com | admin123 |
| Manufacturer | manufacturer@smartmed.com | mfr123 |
| Pharmacy | pharmacy@smartmed.com | pharm123 |
| Customer | anivesh@smartmed.com | cust123 |

## API Endpoints

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — User login
- `GET /api/auth/profile` — Get current user profile
- `PUT /api/auth/profile` — Update user profile

### Medicines
- `GET /api/medicines` — Get all medicines
- `GET /api/medicines/categories` — Get medicine categories
- `GET /api/medicines/:id` — Get medicine details
- `POST /api/medicines` — Register new medicine (manufacturer)
- `POST /api/medicines/:id/batches` — Create batch with QR code (manufacturer)
- `GET /api/medicines/manufacturer/my-medicines` — Get manufacturer's medicines

### Orders
- `POST /api/orders` — Place new order (customer)
- `GET /api/orders/my-orders` — Get customer orders
- `GET /api/orders/pharmacy-orders` — Get pharmacy orders
- `PATCH /api/orders/:id/status` — Update order status (pharmacy)
- `POST /api/orders/:id/cancel` — Cancel order (customer)

### QR Verification
- `POST /api/qr/verify` — Verify QR code
- `GET /api/qr/history` — Get verification history
- `GET /api/qr/blockchain/:batchId` — Get blockchain history

### Admin
- `GET /api/admin/users` — Get all users
- `PATCH /api/admin/users/:uuid/status` — Activate/deactivate user
- `GET /api/admin/stats` — Get dashboard statistics
- `GET /api/admin/analytics/verifications` — Get verification analytics
- `GET /api/admin/orders` — Get all orders
- `GET /api/admin/notifications` — Get notifications
- `PATCH /api/admin/notifications/:id/read` — Mark notification as read
