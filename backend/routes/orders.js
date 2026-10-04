const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Create order (customer)
router.post('/', authenticateToken, requireRole('customer'), (req, res) => {
  try {
    const { items, pharmacy_id } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Order items are required' });
    }

    if (!pharmacy_id) {
      return res.status(400).json({ error: 'Pharmacy ID is required' });
    }

    // Verify pharmacy exists
    const pharmacy = db.prepare('SELECT * FROM users WHERE uuid = ? AND role = ? AND is_active = 1').get(pharmacy_id, 'pharmacy');
    if (!pharmacy) {
      return res.status(404).json({ error: 'Pharmacy not found' });
    }

    // Validate stock and calculate total
    let totalAmount = 0;
    const orderItems = [];

    for (const item of items) {
      const batch = db.prepare(`
        SELECT b.*, m.name as medicine_name, m.price 
        FROM medicine_batches b 
        JOIN medicines m ON b.medicine_id = m.id 
        WHERE b.id = ? AND b.is_active = 1 AND b.quantity >= ?
      `).get(item.batch_id, item.quantity);

      if (!batch) {
        return res.status(400).json({ error: `Insufficient stock for batch ${item.batch_id}` });
      }

      totalAmount += batch.price * item.quantity;
      orderItems.push({ batch_id: item.batch_id, quantity: item.quantity, price: batch.price });
    }

    const orderUuid = uuidv4();

    const createOrder = db.transaction(() => {
      const orderResult = db.prepare(`
        INSERT INTO orders (uuid, customer_id, pharmacy_id, total_amount, status, payment_status)
        VALUES (?, ?, ?, ?, 'pending', 'completed')
      `).run(orderUuid, req.user.uuid, pharmacy_id, totalAmount);

      const orderId = orderResult.lastInsertRowid;

      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, batch_id, quantity, price) VALUES (?, ?, ?, ?)
      `);
      const updateStock = db.prepare(`
        UPDATE medicine_batches SET quantity = quantity - ? WHERE id = ?
      `);

      for (const item of orderItems) {
        insertItem.run(orderId, item.batch_id, item.quantity, item.price);
        updateStock.run(item.quantity, item.batch_id);
      }

      // Create notification for pharmacy
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)
      `).run(pharmacy_id, 'New Order', `New order ${orderUuid.substring(0, 8)} received. Total: ₹${totalAmount.toFixed(2)}`, 'info');

      return orderId;
    });

    const orderId = createOrder();

    res.status(201).json({
      message: 'Order placed successfully',
      order: {
        id: orderId,
        uuid: orderUuid,
        total_amount: totalAmount,
        status: 'pending',
        item_count: orderItems.length
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// Get customer orders
router.get('/my-orders', authenticateToken, requireRole('customer'), (req, res) => {
  try {
    const orders = db.prepare(`
      SELECT o.*, p.name as pharmacy_name
      FROM orders o
      JOIN users p ON o.pharmacy_id = p.uuid
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC
    `).all(req.user.uuid);

    // Get items for each order
    const getItems = db.prepare(`
      SELECT oi.*, b.batch_number, m.name as medicine_name
      FROM order_items oi
      JOIN medicine_batches b ON oi.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE oi.order_id = ?
    `);

    const ordersWithItems = orders.map(order => ({
      ...order,
      items: getItems.all(order.id)
    }));

    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Get pharmacy orders
router.get('/pharmacy-orders', authenticateToken, requireRole('pharmacy'), (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address
      FROM orders o
      JOIN users c ON o.customer_id = c.uuid
      WHERE o.pharmacy_id = ?
    `;
    const params = [req.user.uuid];

    if (status) {
      query += ' AND o.status = ?';
      params.push(status);
    }

    query += ' ORDER BY o.created_at DESC';

    const orders = db.prepare(query).all(...params);

    const getItems = db.prepare(`
      SELECT oi.*, b.batch_number, m.name as medicine_name
      FROM order_items oi
      JOIN medicine_batches b ON oi.batch_id = b.id
      JOIN medicines m ON b.medicine_id = m.id
      WHERE oi.order_id = ?
    `);

    const ordersWithItems = orders.map(order => ({
      ...order,
      items: getItems.all(order.id)
    }));

    res.json(ordersWithItems);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Update order status (pharmacy)
router.patch('/:id/status', authenticateToken, requireRole('pharmacy'), (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'processing', 'dispatched', 'in_transit', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND pharmacy_id = ?').get(req.params.id, req.user.uuid);
    if (!order) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);

    // Notify customer
    const statusMessages = {
      confirmed: 'Your order has been confirmed',
      processing: 'Your order is being processed',
      dispatched: 'Your order has been dispatched',
      in_transit: 'Your order is on the way',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled'
    };

    db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
      order.customer_id,
      'Order Update',
      statusMessages[status],
      status === 'cancelled' ? 'error' : 'info'
    );

    res.json({ message: 'Order status updated', status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Cancel order (customer - only if pending or confirmed)
router.post('/:id/cancel', authenticateToken, requireRole('customer'), (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.uuid);
    if (!order) {
      return res.status(404).json({ error: 'Order not found or unauthorized' });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be cancelled at this stage' });
    }

    const cancelOrder = db.transaction(() => {
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

      // Restore stock
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      const restoreStock = db.prepare('UPDATE medicine_batches SET quantity = quantity + ? WHERE id = ?');
      items.forEach(item => restoreStock.run(item.quantity, item.batch_id));

      // Notify pharmacy
      db.prepare('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)').run(
        order.pharmacy_id,
        'Order Cancelled',
        `Order ${order.uuid.substring(0, 8)} has been cancelled by customer`,
        'warning'
      );
    });

    cancelOrder();
    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

module.exports = router;
