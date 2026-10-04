const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authenticateToken } = require('../middleware/auth');
const { verifyBlockchainIntegrity, getBlockchainHistory } = require('../utils/blockchain');

const router = express.Router();

// Verify QR code
router.post('/verify', authenticateToken, (req, res) => {
  try {
    const { qr_code, location } = req.body;

    if (!qr_code) {
      return res.status(400).json({ error: 'QR code is required' });
    }

    // Find batch by QR code
    const batch = db.prepare(`
      SELECT b.*, m.name as medicine_name, m.category, m.dosage_info, m.usage_instructions, m.safety_warnings,
             u.name as manufacturer_name
      FROM medicine_batches b
      JOIN medicines m ON b.medicine_id = m.id
      JOIN users u ON m.manufacturer_id = u.uuid
      WHERE b.qr_code = ? AND b.is_active = 1
    `).get(qr_code);

    if (!batch) {
      // Log failed verification
      db.prepare(`
        INSERT INTO qr_verifications (uuid, batch_id, scanned_by, verification_status, scan_location)
        VALUES (?, NULL, ?, 'not_found', ?)
      `).run(uuidv4(), req.user.uuid, location || null);

      return res.json({
        status: 'not_found',
        message: 'BATCH NOT FOUND',
        details: 'This medicine could not be verified. Report to authorities.'
      });
    }

    // Check expiry
    const now = new Date();
    const expiryDate = new Date(batch.expiry_date);
    const isExpired = expiryDate < now;

    // Check for duplicate scans
    const previousScans = db.prepare(`
      SELECT * FROM qr_verifications WHERE batch_id = ? AND verification_status = 'authentic' ORDER BY created_at DESC
    `).all(batch.id);

    const isDuplicate = previousScans.length > 0;

    // Verify blockchain integrity
    const blockchainCheck = verifyBlockchainIntegrity(batch.id);

    // Determine verification status
    let verificationStatus;
    if (!blockchainCheck.valid) {
      verificationStatus = 'fake';
    } else if (isExpired) {
      verificationStatus = 'expired';
    } else if (isDuplicate) {
      verificationStatus = 'duplicate';
    } else {
      verificationStatus = 'authentic';
    }

    // Log verification
    db.prepare(`
      INSERT INTO qr_verifications (uuid, batch_id, scanned_by, verification_status, scan_location)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), batch.id, req.user.uuid, verificationStatus, location || null);

    // Create notification for critical findings
    if (verificationStatus === 'fake' || verificationStatus === 'expired' || verificationStatus === 'duplicate') {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)
      `).run(
        req.user.uuid,
        'Medicine Verification Alert',
        `Verification result: ${verificationStatus.toUpperCase()} for ${batch.medicine_name}`,
        'warning'
      );
    }

    // Prepare response
    const response = {
      status: verificationStatus,
      message: getVerificationMessage(verificationStatus),
      medicine: {
        name: batch.medicine_name,
        category: batch.category,
        batch_number: batch.batch_number,
        manufacturing_date: batch.manufacturing_date,
        expiry_date: batch.expiry_date,
        manufacturer: batch.manufacturer_name
      },
      blockchain: {
        valid: blockchainCheck.valid,
        hash: batch.blockchain_hash,
        records: blockchainCheck.recordsCount || 0
      }
    };

    // Include dosage info only for authentic medicines
    if (verificationStatus === 'authentic') {
      response.dosage = {
        info: batch.dosage_info,
        instructions: batch.usage_instructions,
        warnings: batch.safety_warnings
      };
    }

    // Include duplicate scan details
    if (verificationStatus === 'duplicate' && previousScans.length > 0) {
      response.duplicate_info = {
        first_scanned: previousScans[0].created_at,
        total_scans: previousScans.length + 1
      };
    }

    res.json(response);
  } catch (error) {
    console.error('QR verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get verification history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT v.*, b.batch_number, m.name as medicine_name, b.qr_code
      FROM qr_verifications v
      LEFT JOIN medicine_batches b ON v.batch_id = b.id
      LEFT JOIN medicines m ON b.medicine_id = m.id
      WHERE v.scanned_by = ?
      ORDER BY v.created_at DESC
      LIMIT 50
    `).all(req.user.uuid);

    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verification history' });
  }
});

// Get blockchain history for a batch
router.get('/blockchain/:batchId', authenticateToken, (req, res) => {
  try {
    const history = getBlockchainHistory(req.params.batchId);
    const integrity = verifyBlockchainIntegrity(req.params.batchId);

    res.json({ history, integrity });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch blockchain history' });
  }
});

function getVerificationMessage(status) {
  const messages = {
    authentic: 'AUTHENTIC ✓ - This is a genuine product',
    fake: 'COUNTERFEIT DETECTED ⚠ - This product appears to be fake',
    duplicate: 'SUSPICIOUS DUPLICATE ⚠ - This QR code has been scanned before',
    expired: 'EXPIRED ⚠ - This medicine has expired. Do not consume.',
    not_found: 'BATCH NOT FOUND - This medicine could not be verified.'
  };
  return messages[status] || 'Unknown status';
}

module.exports = router;
