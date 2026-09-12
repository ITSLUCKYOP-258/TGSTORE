import { Router } from 'express';
import { listUsers, getUserStats } from '../db.js';

const router = Router();

/**
 * Admin endpoints — protected by the ADMIN_KEY environment variable.
 * Every request must send header:  x-admin-key: <ADMIN_KEY>
 * If ADMIN_KEY is not set, all admin endpoints are disabled (404).
 */
function requireAdminKey(req, res, next) {
  const key = process.env.ADMIN_KEY;
  // No key configured -> admin API is completely disabled
  if (!key) return res.status(404).json({ error: 'Not found' });
  if (req.headers['x-admin-key'] !== key) {
    return res.status(401).json({ error: 'Invalid admin key' });
  }
  next();
}

router.use(requireAdminKey);

/** List every account that has ever logged in (sessions included status only). */
router.get('/users', (_req, res) => {
  res.json({ users: listUsers() });
});

/** Quick summary: total users, connected MTProto sessions, newest logins. */
router.get('/stats', (_req, res) => {
  res.json(getUserStats());
});

export default router;
