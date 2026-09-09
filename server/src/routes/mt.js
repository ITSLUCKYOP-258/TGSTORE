import { Router } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import db, { upsertTelegramUser, getUserById } from '../db.js';
import { requireAuth, signToken, setAuthCookie } from '../auth.js';
import {
  isConfigured,
  startLoginFlow,
  verifyLoginCode,
  verifyLoginPassword,
  saveUserSession,
  disconnectUser,
  listDialogs,
  listMedia,
  getMessage,
  downloadBytes,
} from '../mtproto.js';

const router = Router();

function errorStatus(err) {
  return err.status || 502;
}

/** Complete MT login: link the Telegram user to a local account + issue session. */
async function completeLogin(res, me, session, phone) {
  const user = upsertTelegramUser({
    id: me.id,
    first_name: me.firstName,
    last_name: me.lastName,
    username: me.username,
    photo_url: '',
  });
  await saveUserSession(user.id, session, phone);
  setAuthCookie(res, signToken(user.id));
  return {
    user: {
      id: user.id,
      name: [me.firstName, me.lastName].filter(Boolean).join(' ') || 'Telegram User',
      username: me.username || null,
      photoUrl: '',
      phone: me.phone,
    },
  };
}

// Debug: test route
router.get('/test', (_req, res) => {
  console.log('[MT] /test hit');
  res.json({ ok: true, message: 'MT routes are working' });
});

/* ---------- login flow (no auth) ---------- */
router.get('/config', (_req, res) => {
  console.log('[MT] /config hit, isConfigured:', isConfigured());
  res.json({ enabled: isConfigured() });
});

router.post('/send-code', async (req, res) => {
  try {
    const phone = String(req.body?.phone || '').trim();
    if (!/^\+?\d{8,15}$/.test(phone)) {
      return res.status(400).json({ error: 'Enter phone in international format, e.g. +911234567890' });
    }
    const result = await startLoginFlow(phone.startsWith('+') ? phone : `+${phone}`);
    res.json(result);
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post('/verify-code', async (req, res) => {
  try {
    const result = await verifyLoginCode(String(req.body?.flowId), String(req.body?.code || '').trim());
    if (result.needPassword) return res.json({ needPassword: true });
    res.json(await completeLogin(res, result.me, result.session, ''));
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.post('/verify-password', async (req, res) => {
  try {
    const result = await verifyLoginPassword(String(req.body?.flowId), String(req.body?.password || ''));
    res.json(await completeLogin(res, result.me, result.session, ''));
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

/* ---------- authenticated: browse own Telegram ---------- */
router.get('/status', requireAuth, async (req, res) => {
  const user = getUserById(req.userId);
  res.json({ connected: Boolean(user?.mt_session), phone: user?.mt_phone || null });
});

router.post('/disconnect', requireAuth, async (req, res) => {
  await disconnectUser(req.userId);
  res.json({ ok: true });
});

router.get('/dialogs', requireAuth, async (req, res) => {
  try {
    res.json({ dialogs: await listDialogs(req.userId) });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

router.get('/media', requireAuth, async (req, res) => {
  try {
    const chatId = String(req.query.chat || '');
    const filter = String(req.query.filter || 'all');
    if (!chatId) return res.status(400).json({ error: 'chat is required' });
    res.json({ media: await listMedia(req.userId, chatId, filter) });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

/* ---------- streaming download of a media message ---------- */
async function serve(req, res, asAttachment) {
  try {
    const { client, info, loc } = (await getMessage(req.userId, req.params.chat, req.params.msg)) || {};
    if (!client) return res.status(404).json({ error: 'Media not found' });
    const size = loc.size;
    const baseHeaders = {
      'Content-Type': info.mime || 'application/octet-stream',
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `${asAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(info.name)}`,
    };
    const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
    if (m && size > 0) {
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      if (start == null) {
        start = Math.max(0, size - (end ?? 0));
        end = size - 1;
      } else if (end == null || end >= size) end = size - 1;
      if (start > end || start >= size) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` });
        return res.end();
      }
      res.writeHead(206, {
        ...baseHeaders,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': end - start + 1,
      });
      return pipeline(
        Readable.from(downloadBytes(client, loc.location, { start, end })),
        res
      ).catch(() => res.end());
    }
    if (size > 0) res.writeHead(200, { ...baseHeaders, 'Content-Length': size });
    else res.writeHead(200, baseHeaders);
    return pipeline(Readable.from(downloadBytes(client, loc.location)), res).catch(() => res.end());
  } catch (err) {
    if (!res.headersSent) res.status(errorStatus(err)).json({ error: err.message });
  }
}

router.get('/media/:chat/:msg/download', requireAuth, (req, res) => serve(req, res, true));
router.get('/media/:chat/:msg/raw', requireAuth, (req, res) => serve(req, res, false));

/* ---------- Saved Messages ---------- */
router.get('/saved-messages', requireAuth, async (req, res) => {
  try {
    const filter = String(req.query.filter || 'all');
    const savedId = await getSavedMessagesId(req.userId);
    const media = await listMedia(req.userId, savedId, filter);
    res.json({ media });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

/** Copy media from Saved Messages to a category channel */
router.post('/saved-messages/copy', requireAuth, async (req, res) => {
  try {
    const { savedMessageId, channelId, caption } = req.body || {};
    if (!savedMessageId) return res.status(400).json({ error: 'savedMessageId is required' });
    if (!channelId) return res.status(400).json({ error: 'channelId is required' });
    
    const result = await copySavedMediaToChannel(req.userId, savedMessageId, channelId, caption || '');
    res.json({ messageId: result.messageId, fileId: result.fileId });
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message });
  }
});

export default router;
