const crypto = require('crypto');
const db = require('../database');

/**
 * Simple blockchain implementation for medicine authentication.
 * Each batch record contains a hash linking it to the previous record,
 * creating an immutable chain of authentication data.
 */

function calculateHash(previousHash, data) {
  return crypto.createHash('sha256').update(previousHash + JSON.stringify(data)).digest('hex');
}

function verifyBlockchainIntegrity(batchId) {
  const records = db.prepare(`
    SELECT * FROM blockchain_records WHERE batch_id = ? ORDER BY id ASC
  `).all(batchId);

  if (records.length === 0) return { valid: false, reason: 'No blockchain records found' };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const expectedPrevHash = i === 0 ? '0'.repeat(64) : records[i - 1].current_hash;

    if (record.previous_hash !== expectedPrevHash) {
      return { valid: false, reason: `Chain broken at record ${i + 1}` };
    }

    const recalculatedHash = calculateHash(record.previous_hash, JSON.parse(record.data));
    if (recalculatedHash !== record.current_hash) {
      return { valid: false, reason: `Hash mismatch at record ${i + 1}` };
    }
  }

  return { valid: true, recordsCount: records.length };
}

function addBlockchainRecord(batchId, data) {
  const lastRecord = db.prepare(`
    SELECT current_hash FROM blockchain_records WHERE batch_id = ? ORDER BY id DESC LIMIT 1
  `).get(batchId);

  const previousHash = lastRecord ? lastRecord.current_hash : '0'.repeat(64);
  const currentHash = calculateHash(previousHash, data);

  const result = db.prepare(`
    INSERT INTO blockchain_records (batch_id, previous_hash, current_hash, data)
    VALUES (?, ?, ?, ?)
  `).run(batchId, previousHash, currentHash, JSON.stringify(data));

  return { id: result.lastInsertRowid, previousHash, currentHash };
}

function getBlockchainHistory(batchId) {
  return db.prepare(`
    SELECT * FROM blockchain_records WHERE batch_id = ? ORDER BY id ASC
  `).all(batchId);
}

module.exports = {
  calculateHash,
  verifyBlockchainIntegrity,
  addBlockchainRecord,
  getBlockchainHistory
};
