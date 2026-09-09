import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';
import { sendChunkToChannel, getChunkSize } from '../telegram.js';
import { purgeFile } from './drive.js';
import { uploadMediaToChannel, copySavedMediaToChannel } from '../mtproto.js';

const router = Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tgstore-'));
      cb(null, dir);
    },
    filename: (_req, file, cb) => cb(null, 'upload.bin'),
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB per file
});

/** POST /upload  (multipart: file, categoryId, folderId, name, mime) */
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const filePath = req.file.path;
  const dir = path.dirname(filePath);
  try {
    const name = String(req.body?.name || req.file.originalname || 'untitled');
    const mime = String(req.body?.mime || req.file.mimetype || 'application/octet-stream');
    const categoryId =
      req.body?.categoryId && req.body.categoryId !== 'null'
        ? Number(req.body.categoryId)
        : null;
    const folderId =
      req.body?.folderId && req.body.folderId !== 'null' ? Number(req.body.folderId) : null;

    // Validate category exists
    if (categoryId != null && !db.getCategory(categoryId, req.userId)) {
      return res.status(404).json({ error: 'Target category not found' });
    }

    // Validate folder exists and belongs to same category
    if (folderId != null) {
      const folder = db.getFolder(folderId, req.userId);
      if (!folder) return res.status(404).json({ error: 'Target folder not found' });
      if (categoryId != null && folder.category_id !== categoryId) {
        return res.status(400).json({ error: 'Folder must belong to the selected category' });
      }
    }

    const size = req.file.size;
    const chunkSize = getChunkSize();
    const total = Math.max(1, Math.ceil(size / chunkSize));

    // Determine which channel to upload to
    // If categoryId is provided, use the category's channel; otherwise use default
    let targetChannelId = process.env.STORAGE_CHANNEL_ID;
    if (categoryId != null) {
      const category = db.getCategory(categoryId, req.userId);
      if (category && category.channel_id) {
        targetChannelId = category.channel_id;
      }
    }

    const fd = await fs.promises.open(filePath, 'r');
    const chunks = [];
    let channelMessageId = 0;
    try {
      for (let idx = 0; idx < total; idx++) {
        const start = idx * chunkSize;
        const length = Math.min(chunkSize, size - start);
        const buf = Buffer.alloc(length);
        await fd.read(buf, 0, length, start);
        const stored = await sendChunkToChannel(buf, idx, total, name, targetChannelId);
        chunks.push(stored);
        if (idx === 0) channelMessageId = stored.messageId;
      }
    } finally {
      await fd.close();
    }

    const id = db.insertFile(req.userId, categoryId, folderId, name, mime, size, chunks, channelMessageId);
    res.status(201).json({ file: db.getFile(id, req.userId) });
  } catch (err) {
    console.error('Upload failed:', err.message);
    res.status(502).json({ error: `Upload to Telegram failed: ${err.message}` });
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
});

/** POST /upload-from-saved — copy media from Saved Messages to a folder */
router.post('/upload-from-saved', requireAuth, async (req, res) => {
  try {
    const { savedMessageId, categoryId: catId, folderId: folId, name, mime, size } = req.body || {};
    if (!savedMessageId) return res.status(400).json({ error: 'savedMessageId is required' });
    
    const categoryId = catId && catId !== 'null' ? Number(catId) : null;
    const folderId = folId && folId !== 'null' ? Number(folId) : null;

    // Validate category exists
    if (categoryId != null && !db.getCategory(categoryId, req.userId)) {
      return res.status(404).json({ error: 'Target category not found' });
    }

    // Validate folder exists and belongs to same category
    if (folderId != null) {
      const folder = db.getFolder(folderId, req.userId);
      if (!folder) return res.status(404).json({ error: 'Target folder not found' });
      if (categoryId != null && folder.category_id !== categoryId) {
        return res.status(400).json({ error: 'Folder must belong to the selected category' });
      }
    }

    // Determine which channel to upload to
    let targetChannelId = process.env.STORAGE_CHANNEL_ID;
    if (categoryId != null) {
      const category = db.getCategory(categoryId, req.userId);
      if (category && category.channel_id) {
        targetChannelId = category.channel_id;
      }
    }

    // Copy media from Saved Messages to the category channel
    const result = await copySavedMediaToChannel(
      req.userId,
      savedMessageId,
      targetChannelId,
      name || 'Saved Media'
    );

    const chunks = [{
      chatId: targetChannelId,
      messageId: result.messageId,
      tgFileId: result.fileId,
      size: Number(size || 0),
    }];

    const id = db.insertFile(
      req.userId,
      categoryId,
      folderId,
      name || 'Saved Media',
      mime || 'application/octet-stream',
      Number(size || 0),
      chunks,
      result.messageId
    );
    
    res.status(201).json({ file: db.getFile(id, req.userId) });
  } catch (err) {
    console.error('Upload from saved failed:', err.message);
    res.status(502).json({ error: `Upload from Saved Messages failed: ${err.message}` });
  }
});

router.patch('/:id', requireAuth, (req, res) => {
  const file = db.getFile(Number(req.params.id), req.userId);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const { name, starred, trashed, folderId } = req.body || {};
  const fields = {};
  if (typeof name === 'string' && name.trim()) fields.name = name.trim();
  if (starred !== undefined) fields.starred = starred ? 1 : 0;
  if (trashed !== undefined) fields.trashed = trashed ? 1 : 0;
  if (folderId !== undefined) {
    const target = folderId == null ? null : Number(folderId);
    if (target != null && !db.getFolder(target, req.userId))
      return res.status(404).json({ error: 'Target folder not found' });
    fields.folder_id = target;
  }
  db.updateFile(file.id, req.userId, fields);
  res.json({ file: db.getFile(file.id, req.userId) });
});

/** DELETE /api/files/:id — permanent delete (removes stored Telegram messages). */
router.delete('/:id', requireAuth, async (req, res) => {
  const file = db.getFile(Number(req.params.id), req.userId);
  if (!file) return res.status(404).json({ error: 'File not found' });
  await purgeFile(file, req.userId);
  res.json({ ok: true });
});

import { serveFileStream } from '../stream.js';

function handleStream(req, res, asAttachment) {
  const file = db.getFile(Number(req.params.id), req.userId);
  if (!file) return res.status(404).json({ error: 'File not found' });
  const chunks = db.getChunks(file.id);
  if (!chunks.length) return res.status(404).json({ error: 'File has no stored data' });
  serveFileStream(chunks, file, req, res, { asAttachment });
}

router.get('/:id/download', requireAuth, (req, res) => handleStream(req, res, true));
router.get('/:id/raw', requireAuth, (req, res) => handleStream(req, res, false));



export default router;
