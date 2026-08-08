import { get } from '../database.js';

function parseBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim();
}

export async function requireAuth(req, res, next) {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Missing authentication token' });
    }

    const session = await get(
      `SELECT
         s.token,
         s.expires_at,
         u.id,
         u.username,
         u.display_name,
         u.role,
         u.grade
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = ?`,
      [token]
    );

    if (!session) {
      return res.status(401).json({ error: 'Invalid authentication token' });
    }

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Session expired' });
    }

    req.authToken = token;
    req.user = {
      id: session.id,
      username: session.username,
      display_name: session.display_name,
      role: session.role,
      grade: session.grade
    };

    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
