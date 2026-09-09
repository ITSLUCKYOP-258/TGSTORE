import { Router } from 'express';
import crypto from 'node:crypto';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';
import { serveFileStream } from '../stream.js';

const router = Router();


/** Public share endpoints (no auth) */
router.get('/public/:token', (req, res) => {
  const share = db.getShareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'Link not found or revoked' });
  res.json({
    name: share.name,
    size: share.size,
    mime: share.mime,
    createdAt: share.created_at,
    rawUrl: `/api/public/${share.token}/raw`,
    downloadUrl: `/api/public/${share.token}/download`,
  });
});

router.get('/public/:token/download', async (req, res) => {
  const share = db.getShareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'Link not found or revoked' });
  const chunks = db.getChunks(share.file_id);
  if (!chunks.length) return res.status(404).json({ error: 'File has no stored data' });
  serveFileStream(chunks, share, req, res, { asAttachment: true });
});

router.get('/public/:token/raw', async (req, res) => {
  const share = db.getShareByToken(req.params.token);
  if (!share) return res.status(404).json({ error: 'Link not found or revoked' });
  const chunks = db.getChunks(share.file_id);
  if (!chunks.length) return res.status(404).json({ error: 'File has no stored data' });
  serveFileStream(chunks, share, req, res, { asAttachment: false });
});

/* ---- authenticated management ---- */
router.get('/', requireAuth, (req, res) => {
  res.json({ shares: db.listShares(req.userId) });
});

router.post('/', requireAuth, (req, res) => {
  const fileId = Number(req.body?.fileId);
  const file = db.getFile(fileId, req.userId);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const token = crypto.randomBytes(16).toString('hex');
  const id = db.createShare(req.userId, fileId, token);
  const share = db.listShares(req.userId).find((s) => s.id === id);
  res.status(201).json({ share });
});

router.delete('/:id', requireAuth, (req, res) => {
  const share = db.getShareForUser(Number(req.params.id), req.userId);
  if (!share) return res.status(404).json({ error: 'Share not found' });
  db.deleteShare(share.id, req.userId);
  res.json({ ok: true });
});

export default router;
