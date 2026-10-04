const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'database.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'pharmacy', 'manufacturer', 'admin')),
      phone TEXT,
      address TEXT,
      license_number TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      manufacturer_id INTEGER NOT NULL,
      dosage_info TEXT,
      usage_instructions TEXT,
      safety_warnings TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (manufacturer_id) REFERENCES users(uuid)
    );

    CREATE TABLE IF NOT EXISTS medicine_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      medicine_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      manufacturing_date TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      qr_code TEXT UNIQUE NOT NULL,
      blockchain_hash TEXT UNIQUE NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      pharmacy_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'processing', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'returned')),
      total_amount REAL NOT NULL,
      payment_status TEXT DEFAULT 'pending' CHECK(payment_status IN ('pending', 'completed', 'failed', 'refunded')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(uuid),
      FOREIGN KEY (pharmacy_id) REFERENCES users(uuid)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (batch_id) REFERENCES medicine_batches(id)
    );

    CREATE TABLE IF NOT EXISTS qr_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      batch_id INTEGER,
      scanned_by TEXT NOT NULL,
      verification_status TEXT NOT NULL CHECK(verification_status IN ('authentic', 'fake', 'duplicate', 'expired', 'not_found')),
      scan_location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES medicine_batches(id),
      FOREIGN KEY (scanned_by) REFERENCES users(uuid)
    );

    CREATE TABLE IF NOT EXISTS blockchain_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      previous_hash TEXT NOT NULL,
      current_hash TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT NOT NULL,
      FOREIGN KEY (batch_id) REFERENCES medicine_batches(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info' CHECK(type IN ('info', 'warning', 'success', 'error')),
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(uuid)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(uuid)
    );
  `);

  console.log('Database initialized successfully');
}

// Seed default data
function seedDatabase() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (userCount.count > 0) {
    console.log('Database already seeded');
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (uuid, name, email, password, role, phone, address, license_number)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Seed admin
  const adminUuid = uuidv4();
  insertUser.run(adminUuid, 'Admin User', 'admin@smartmed.com', bcrypt.hashSync('admin123', 10), 'admin', '9876543210', 'VIT Vellore', null);

  // Seed manufacturer
  const mfrUuid = uuidv4();
  insertUser.run(mfrUuid, 'PharmaCorp Ltd', 'manufacturer@smartmed.com', bcrypt.hashSync('mfr123', 10), 'manufacturer', '9876543211', 'Mumbai, India', 'MFR-2024-001');

  // Seed pharmacy
  const pharmacyUuid = uuidv4();
  insertUser.run(pharmacyUuid, 'Sunrise Pharmacy', 'pharmacy@smartmed.com', bcrypt.hashSync('pharm123', 10), 'pharmacy', '9876543212', 'Vellore, Tamil Nadu', 'PH-2024-001');

  // Seed customer
  const customerUuid = uuidv4();
  insertUser.run(customerUuid, 'Anivesh Gupta', 'anivesh@smartmed.com', bcrypt.hashSync('cust123', 10), 'customer', '9876543213', 'VIT Vellore, Tamil Nadu', null);

  // Seed medicines
  const insertMedicine = db.prepare(`
    INSERT INTO medicines (uuid, name, category, description, price, manufacturer_id, dosage_info, usage_instructions, safety_warnings)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const medicines = [
    [uuidv4(), 'Paracetamol 500mg', 'Pain Relief', 'Effective pain reliever and fever reducer', 3.50, mfrUuid, '1-2 tablets every 4-6 hours', 'Take with water after food', 'Do not exceed 4g per day. Liver damage risk with overdose.'],
    [uuidv4(), 'Ibuprofen 400mg', 'Anti-Inflammatory', 'Reduces inflammation and pain', 5.00, mfrUuid, '1 tablet every 6-8 hours', 'Take with food to avoid stomach upset', 'Not recommended for pregnant women. May cause stomach bleeding.'],
    [uuidv4(), 'Amoxicillin 250mg', 'Antibiotic', 'Broad-spectrum antibiotic for bacterial infections', 12.00, mfrUuid, '1 capsule every 8 hours', 'Complete the full course as prescribed', 'May cause allergic reactions. Consult doctor if rash appears.'],
    [uuidv4(), 'Cetirizine 10mg', 'Antihistamine', 'Relieves allergy symptoms', 4.00, mfrUuid, '1 tablet once daily', 'Take with or without water', 'May cause drowsiness. Avoid driving after consumption.'],
    [uuidv4(), 'Omeprazole 20mg', 'Antacid', 'Reduces stomach acid production', 8.00, mfrUuid, '1 capsule before breakfast', 'Swallow whole, do not crush', 'Long use may cause vitamin B12 deficiency.'],
    [uuidv4(), 'Vitamin D3 60K', 'Supplement', 'Bone health and immunity support', 15.00, mfrUuid, '1 capsule weekly', 'Take with fatty meal for absorption', 'Do not exceed recommended dose. May cause hypercalcemia.'],
    [uuidv4(), 'Cough Syrup 100ml', 'Cough & Cold', 'Relieves dry cough and throat irritation', 6.50, mfrUuid, '2 spoonfuls three times daily', 'Shake well before use', 'Not for children under 6 years. May cause drowsiness.'],
    [uuidv4(), 'ORS Electrolyte', 'Hydration', 'Oral rehydration salts for dehydration', 2.00, mfrUuid, '1 sachet in 1L water', 'Sip throughout the day', 'Use prepared solution within 24 hours.']
  ];

  const medicineIds = [];
  medicines.forEach(med => {
    const result = insertMedicine.run(...med);
    medicineIds.push(result.lastInsertRowid);
  });

  // Seed batches with QR codes and blockchain hashes
  const crypto = require('crypto');
  const insertBatch = db.prepare(`
    INSERT INTO medicine_batches (uuid, medicine_id, batch_number, manufacturing_date, expiry_date, quantity, qr_code, blockchain_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertBlockchain = db.prepare(`
    INSERT INTO blockchain_records (batch_id, previous_hash, current_hash, data)
    VALUES (?, ?, ?, ?)
  `);

  const batches = [];
  medicineIds.forEach((medId, idx) => {
    const batchUuid = uuidv4();
    const batchNumber = `BAT-2024-${String(idx + 1).padStart(3, '0')}`;
    const mfgDate = '2024-01-15';
    const expDate = '2026-01-15';
    const quantity = 100 + Math.floor(Math.random() * 400);
    const qrCode = `SMARTMED-${batchNumber}-${batchUuid.substring(0, 8)}`;
    const prevHash = idx === 0 ? '0'.repeat(64) : batches[idx - 1].hash;
    const data = JSON.stringify({ medicineId: medId, batchNumber, mfgDate, expDate, quantity, qrCode });
    const hash = crypto.createHash('sha256').update(prevHash + data).digest('hex');

    const result = insertBatch.run(batchUuid, medId, batchNumber, mfgDate, expDate, quantity, qrCode, hash);
    insertBlockchain.run(result.lastInsertRowid, prevHash, hash, data);
    batches.push({ id: result.lastInsertRowid, hash });
  });

  console.log('Database seeded successfully');
  console.log('Default accounts:');
  console.log('  Admin: admin@smartmed.com / admin123');
  console.log('  Manufacturer: manufacturer@smartmed.com / mfr123');
  console.log('  Pharmacy: pharmacy@smartmed.com / pharm123');
  console.log('  Customer: anivesh@smartmed.com / cust123');
}

initializeDatabase();
seedDatabase();

module.exports = db;
