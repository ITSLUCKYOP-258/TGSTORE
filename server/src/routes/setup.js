import { Router } from 'express';
import { readFileConfig, saveFileConfig } from '../config.js';

const router = Router();

function isPlaceholder(v) {
  if (!v) return true;
  const s = String(v);
  return s.includes('your-bot-token') || s === '-1001234567890' || s.includes('change-me');
}

const mtConfigured = () =>
  Boolean(process.env.MT_API_ID) &&
  Boolean(process.env.MT_API_HASH) &&
  !isPlaceholder(process.env.MT_API_ID);
const botConfigured = () =>
  !isPlaceholder(process.env.BOT_TOKEN) && !isPlaceholder(process.env.STORAGE_CHANNEL_ID);

function status() {
  const mt = mtConfigured();
  const bot = botConfigured();
  return {
    mtConfigured: mt,
    botConfigured: bot,
    needsSetup: !mt && !bot,
    botUsername: process.env.BOT_USERNAME || '',
    publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
    devLoginEnabled: process.env.DEV_LOGIN === 'true',
  };
}

router.get('/status', (_req, res) => res.json(status()));

router.post('/', (req, res) => {
  const s = status();
  // MT keys gate every login method — allow adding them on first run without auth.
  // (Once MT is configured, changing credentials requires being signed in.)
  if (s.mtConfigured && !req.userId) {
    return res.status(401).json({ error: 'Sign in first to change server settings' });
  }
  const { mtApiId, mtApiHash, botToken, storageChannelId, botUsername, publicBaseUrl } =
    req.body || {};
  const patch = {};

  if (mtApiId !== undefined && mtApiId !== '') {
    if (!/^\d{1,10}$/.test(String(mtApiId).trim()))
      return res.status(400).json({ error: 'api_id must be a number (from my.telegram.org)' });
    patch.MT_API_ID = String(mtApiId).trim();
  }
  if (mtApiHash !== undefined && mtApiHash !== '') {
    if (!/^[a-f0-9]{32}$/i.test(String(mtApiHash).trim()))
      return res.status(400).json({ error: 'api_hash must be 32 hex characters' });
    patch.MT_API_HASH = String(mtApiHash).trim();
  }
  if (botToken !== undefined && botToken !== '') patch.BOT_TOKEN = botToken;
  if (storageChannelId !== undefined && storageChannelId !== '')
    patch.STORAGE_CHANNEL_ID = storageChannelId;
  if (botUsername !== undefined) patch.BOT_USERNAME = botUsername;
  if (publicBaseUrl !== undefined) patch.PUBLIC_BASE_URL = publicBaseUrl;

  if (!Object.keys(patch).length)
    return res.status(400).json({ error: 'Nothing to save' });

  saveFileConfig(patch);
  res.json({ ok: true, ...status() });
});

/** Masked view of what is already configured (for the wizard). */
router.get('/current', (_req, res) => {
  const cfg = readFileConfig();
  res.json({
    mtApiId: cfg.MT_API_ID || '',
    mtApiHash: cfg.MT_API_HASH ? '•••••••• (saved)' : '',
    botToken: cfg.BOT_TOKEN ? '•••••••• (saved)' : '',
    storageChannelId: cfg.STORAGE_CHANNEL_ID || '',
  });
});

export default router;
