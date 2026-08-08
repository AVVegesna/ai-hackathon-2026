import express from 'express';
import crypto from 'crypto';
import { get, run } from '../database.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await get(
      `SELECT id, username, password, display_name, role, grade
       FROM users
       WHERE lower(username) = lower(?)`,
      [username]
    );

    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = crypto.randomBytes(24).toString('hex');
    await run(
      `INSERT INTO user_sessions (user_id, token, expires_at)
       VALUES (?, ?, datetime('now', '+30 days'))`,
      [user.id, token]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        grade: user.grade
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    await run('DELETE FROM user_sessions WHERE token = ?', [req.authToken]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

export default router;
