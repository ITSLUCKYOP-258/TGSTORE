import { Router } from 'express';
import {
  upsertTelegramUser,
  createDevUser,
  getUserById,
} from '../db.js';
import { verifyLoginWidget } from '../telegram.js';
import { signToken, setAuthCookie, clearAuthCookie } from '../auth.js';

const router = Router();

const publicUser = (u) => ({
  id: u.id,
  name: [u.first_name, u.last_name].filter(Boolean).join(' ') || 'User',
  username: u.username || null,
  photoUrl: u.photo_url || null,
  isDev: !!u.is_dev,
});

/** Telegram Login Widget callback. Accepts GET (widget redirect) or POST (fetch). */
router.get('/telegram', (req, res) => {
  if (!verifyLoginWidget(req.query)) {
    return res.status(401).json({ error: 'Telegram login verification failed' });
  }
  const user = upsertTelegramUser(req.query);
  const token = signToken(user.id);
  setAuthCookie(res, token);
  // Return token in body so Capacitor (native) apps can persist it in localStorage
  res.json({ user: publicUser(user), token });
});

router.post('/telegram', (req, res) => {
  if (!verifyLoginWidget(req.body || {})) {
    return res.status(401).json({ error: 'Telegram login verification failed' });
  }
  const user = upsertTelegramUser(req.body);
  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user), token });
});

/** Local development login (enabled with DEV_LOGIN=true in server/.env). */
router.post('/dev', (req, res) => {
  if (process.env.DEV_LOGIN !== 'true') {
    return res.status(403).json({ error: 'Dev login is disabled' });
  }
  const user = createDevUser(req.body?.name);
  const token = signToken(user.id);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user), token });
});

router.get('/me', (req, res) => {
  if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
  const user = getUserById(req.userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user: publicUser(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

/** Frontend asks for config needed to render the login widget. */
router.get('/config', (_req, res) => {
  const botUsername = process.env.BOT_USERNAME || '';
  res.json({
    telegramLoginEnabled: Boolean(botUsername) && Boolean(process.env.PUBLIC_BASE_URL),
    botUsername,
    devLoginEnabled: process.env.DEV_LOGIN === 'true',
  });
});

export default router;
