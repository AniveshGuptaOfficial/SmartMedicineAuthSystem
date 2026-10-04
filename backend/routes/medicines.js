const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const QRCode = require('qrcode');
const db = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { addBlockchainRecord } = require('../utils/blockchain');

const router = express.Router();

// Get all medicines (public - for browsing)
router.get('/', authenticateToken, (req, res) => {
  try {
    const { category, search } = req.query;
    let query = `
      SELECT m.*, u.name as manufacturer_name 
      FROM medicines m 
      JOIN users u ON m.manufacturer_id = u.uuid 
      WHERE m.is_active = 1
    `;
    const params = [];

    if (category) {
      query += ' AND m.category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (m.name LIKE ? OR m.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    const medicines = db.prepare(query).all(...params);
    res.json(medicines);
  } catch (error) {
    console.error('Get medicines error:', error);
    res.status(500).json({ error: 'Failed to fetch medicines' });
  }
});

// Get medicine categories
router.get('/categories', authenticateToken, (req, res) => {
  try {
    const categories = db.prepare('SELECT DISTINCT category FROM medicines WHERE is_active = 1').all();
    res.json(categories.map(c => c.category));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Get single medicine with batches
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const medicine = db.prepare(`
      SELECT m.*, u.name as manufacturer_name 
      FROM medicines m 
      JOIN users u ON m.manufacturer_id = u.uuid 
      WHERE m.id = ? AND m.is_active = 1
    `).get(req.params.id);

    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found' });
    }

    const batches = db.prepare(`
      SELECT * FROM medicine_batches 
      WHERE medicine_id = ? AND is_active = 1 AND quantity > 0
    `).all(req.params.id);

    res.json({ ...medicine, batches });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch medicine' });
  }
});

// Register new medicine (manufacturer only)
router.post('/', authenticateToken, requireRole('manufacturer'), (req, res) => {
  try {
    const { name, category, description, price, dosage_info, usage_instructions, safety_warnings } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({ error: 'Name, category, and price are required' });
    }

    const medicineUuid = uuidv4();
    const result = db.prepare(`
      INSERT INTO medicines (uuid, name, category, description, price, manufacturer_id, dosage_info, usage_instructions, safety_warnings)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(medicineUuid, name, category, description || '', price, req.user.uuid, dosage_info || '', usage_instructions || '', safety_warnings || '');

    res.status(201).json({ message: 'Medicine registered successfully', id: result.lastInsertRowid, uuid: medicineUuid });
  } catch (error) {
    console.error('Register medicine error:', error);
    res.status(500).json({ error: 'Failed to register medicine' });
  }
});

// Create medicine batch with QR code and blockchain record (manufacturer only)
router.post('/:id/batches', authenticateToken, requireRole('manufacturer'), async (req, res) => {
  try {
    const { batch_number, manufacturing_date, expiry_date, quantity } = req.body;
    const medicineId = req.params.id;

    if (!batch_number || !manufacturing_date || !expiry_date || !quantity) {
      return res.status(400).json({ error: 'Batch number, manufacturing date, expiry date, and quantity are required' });
    }

    // Verify medicine belongs to manufacturer
    const medicine = db.prepare('SELECT * FROM medicines WHERE id = ? AND manufacturer_id = ?').get(medicineId, req.user.uuid);
    if (!medicine) {
      return res.status(404).json({ error: 'Medicine not found or unauthorized' });
    }

    const batchUuid = uuidv4();
    const qrCode = `SMARTMED-${batch_number}-${batchUuid.substring(0, 8)}`;

    // Generate QR code data URL
    const qrDataUrl = await QRCode.toDataURL(qrCode, { width: 300, margin: 2 });

    // Create blockchain hash
    const prevRecord = db.prepare('SELECT current_hash FROM blockchain_records ORDER BY id DESC LIMIT 1').get();
    const previousHash = prevRecord ? prevRecord.current_hash : '0'.repeat(64);
    const batchData = { medicineId, batch_number, manufacturing_date, expiry_date, quantity, qrCode, manufacturer: req.user.name };
    const currentHash = crypto.createHash('sha256').update(previousHash + JSON.stringify(batchData)).digest('hex');

    const result = db.prepare(`
      INSERT INTO medicine_batches (uuid, medicine_id, batch_number, manufacturing_date, expiry_date, quantity, qr_code, blockchain_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(batchUuid, medicineId, batch_number, manufacturing_date, expiry_date, quantity, qrCode, currentHash);

    // Add to blockchain
    addBlockchainRecord(result.lastInsertRowid, batchData);

    res.status(201).json({
      message: 'Batch created successfully',
      batch: {
        id: result.lastInsertRowid,
        uuid: batchUuid,
        batch_number,
        qr_code: qrCode,
        qr_code_image: qrDataUrl,
        blockchain_hash: currentHash
      }
    });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Get manufacturer's medicines
router.get('/manufacturer/my-medicines', authenticateToken, requireRole('manufacturer'), (req, res) => {
  try {
    const medicines = db.prepare(`
      SELECT m.*, COUNT(b.id) as batch_count, COALESCE(SUM(b.quantity), 0) as total_stock
      FROM medicines m
      LEFT JOIN medicine_batches b ON m.id = b.medicine_id AND b.is_active = 1
      WHERE m.manufacturer_id = ? AND m.is_active = 1
      GROUP BY m.id
    `).all(req.user.uuid);

    res.json(medicines);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch medicines' });
  }
});

module.exports = router;
