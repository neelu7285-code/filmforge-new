import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { authenticate } from '../middleware/auth.js';

dotenv.config();

const router = Router();
const { JWT_SECRET, JWT_EXPIRES_IN = '7d' } = process.env;

/**
 * Helper: run a team-db SQL query and return parsed JSON result.
 * We exec team-db CLI since this is our shared database interface.
 */
function dbQuery(sql) {
  try {
    // Escape $ and " signs so bash doesn't interpret them
    const escaped = sql.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    const stdout = execSync(`team-db "${escaped}"`, {
      encoding: 'utf-8',
      timeout: 10000,
    });
    return JSON.parse(stdout.trim());
  } catch (err) {
    console.error('[DB Error]', err.message);
    throw new Error('Database query failed');
  }
}

/**
 * POST /api/auth/register
 * Creates a new user account.
 * Body: { email, password, name? }
 */
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if email already exists
    const existing = dbQuery(`SELECT id FROM users WHERE email = '${email}'`);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user
    const id = uuidv4();
    const escapedName = (name || '').replace(/'/g, "''");
    const escapedEmail = email.replace(/'/g, "''");

    dbQuery(
      `INSERT INTO users (id, email, password_hash, name) VALUES ('${id}', '${escapedEmail}', '${password_hash}', '${escapedName}')`
    );

    // Generate JWT
    const token = jwt.sign({ id, email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id, email, name: name || '' },
    });
  } catch (err) {
    console.error('[Register Error]', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates an existing user.
 * Body: { email, password }
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const escapedEmail = email.replace(/'/g, "''");
    const rows = dbQuery(`SELECT id, email, password_hash, name FROM users WHERE email = '${escapedEmail}'`);

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    // Compare password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email, name: user.name || '' },
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', authenticate, (req, res) => {
  const escapedId = req.user.id.replace(/'/g, "''");
  const rows = dbQuery(`SELECT id, email, name, created_at FROM users WHERE id = '${escapedId}'`);

  if (rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user: rows[0] });
});

export default router;