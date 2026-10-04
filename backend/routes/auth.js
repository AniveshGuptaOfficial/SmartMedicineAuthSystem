const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, role, phone, address, license_number } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }

    const validRoles = ['customer', 'pharmacy', 'manufacturer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be customer, pharmacy, or manufacturer' });
    }

    const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const userUuid = uuidv4();

    const result = db.prepare(`
      INSERT INTO users (uuid, name, email, password, role, phone, address, license_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userUuid, name, email, hashedPassword, role, phone || null, address || null, license_number || null);

    const token = generateToken({ uuid: userUuid, email, role, name });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { uuid: userUuid, name, email, role, phone, address }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account has been deactivated' });
    }

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        uuid: user.uuid,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, (req, res) => {
  const user = req.user;
  res.json({
    uuid: user.uuid,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    address: user.address,
    license_number: user.license_number,
    created_at: user.created_at
  });
});

// Update profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const user = req.user;

    db.prepare(`
      UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address)
      WHERE uuid = ?
    `).run(name, phone, address, user.uuid);

    const updatedUser = db.prepare('SELECT * FROM users WHERE uuid = ?').get(user.uuid);
    res.json({ message: 'Profile updated', user: updatedUser });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

module.exports = router;
