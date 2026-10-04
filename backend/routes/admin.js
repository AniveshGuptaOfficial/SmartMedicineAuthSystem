const express = require('express');
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/users', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { role, search } = req.query;
    let query = 'SELECT uuid, name, email, role, phone, address, license_number, is_active, created_at FROM users WHERE 1=1';
    const params = [];

    if (role) {
      query += ' AND role = ?';
      params.push(role);
    }

    if (search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY created_at DESC';

    const users = db.prepare(query).all(...params);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user status (admin only)
router.patch('/users/:uuid/status', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { is_active } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE uuid = ?').get(req.params.uuid);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot modify admin account' });
    }

    db.prepare('UPDATE users SET is_active = ? WHERE uuid = ?').run(is_active ? 1 : 0, req.params.uuid);

    res.json({ message: `User ${is_active ? 'activated' : 'deactivated'} successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Get dashboard stats (admin only)
router.get('/stats', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const stats = {
      users: {
        total: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
        customers: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get().count,
        pharmacies: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'pharmacy'").get().count,
        manufacturers: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'manufacturer'").get().count
      },
      medicines: {
        total: db.prepare('SELECT COUNT(*) as count FROM medicines WHERE is_active = 1').get().count,
        categories: db.prepare('SELECT COUNT(DISTINCT category) as count FROM medicines WHERE is_active = 1').get().count
      },
      orders: {
        total: db.prepare('SELECT COUNT(*) as count FROM orders').get().count,
        pending: db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get().count,
        delivered: db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'delivered'").get().count,
        revenue: db.prepare("SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status != 'cancelled'").get().total
      },
      verifications: {
        total: db.prepare('SELECT COUNT(*) as count FROM qr_verifications').get().count,
        authentic: db.prepare("SELECT COUNT(*) as count FROM qr_verifications WHERE verification_status = 'authentic'").get().count,
        fake: db.prepare("SELECT COUNT(*) as count FROM qr_verifications WHERE verification_status = 'fake'").get().count,
        expired: db.prepare("SELECT COUNT(*) as count FROM qr_verifications WHERE verification_status = 'expired'").get().count,
        duplicate: db.prepare("SELECT COUNT(*) as count FROM qr_verifications WHERE verification_status = 'duplicate'").get().count
      }
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get verification analytics (admin only)
router.get('/analytics/verifications', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [];

    if (start_date && end_date) {
      dateFilter = 'WHERE DATE(created_at) BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    const byStatus = db.prepare(`
      SELECT verification_status, COUNT(*) as count 
      FROM qr_verifications 
      ${dateFilter}
      GROUP BY verification_status
    `).all(...params);

    const byDate = db.prepare(`
      SELECT DATE(created_at) as date, verification_status, COUNT(*) as count 
      FROM qr_verifications 
      ${dateFilter}
      GROUP BY DATE(created_at), verification_status
      ORDER BY date DESC
      LIMIT 30
    `).all(...params);

    res.json({ byStatus, byDate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get all orders (admin only)
router.get('/orders', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, c.name as customer_name, p.name as pharmacy_name
      FROM orders o
      JOIN users c ON o.customer_id = c.uuid
      JOIN users p ON o.pharmacy_id = p.uuid
      ORDER BY o.created_at DESC
    `).all();

    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get notifications for logged-in user
router.get('/notifications', authenticateToken, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(req.user.uuid);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.uuid);
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;
