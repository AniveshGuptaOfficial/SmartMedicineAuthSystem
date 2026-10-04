const express = require('express');
const cors = require('cors');
const path = require('path');

// Initialize database (creates tables and seeds data)
const db = require('./database');

// Import routes
const authRoutes = require('./routes/auth');
const medicineRoutes = require('./routes/medicines');
const orderRoutes = require('./routes/orders');
const qrRoutes = require('./routes/qr');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/medicines', medicineRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log('  Smart Medicine Authentication System');
  console.log('========================================');
  console.log(`  Server running at http://localhost:${PORT}`);
  console.log(`  API available at http://localhost:${PORT}/api`);
  console.log('========================================');
  console.log('  Default login credentials:');
  console.log('    Admin:       admin@smartmed.com / admin123');
  console.log('    Manufacturer: manufacturer@smartmed.com / mfr123');
  console.log('    Pharmacy:    pharmacy@smartmed.com / pharm123');
  console.log('    Customer:    anivesh@smartmed.com / cust123');
  console.log('========================================');
});
