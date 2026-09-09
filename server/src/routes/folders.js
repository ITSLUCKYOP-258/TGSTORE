import { Router } from 'express';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';
import { postTextMessage } from '../mtproto.js';

const router = Router();

router.use(requireAuth);

const shapeFolder = (f) => ({
  id: f.id,
  name: f.name,
  categoryId: f.category_id,
  parentId: f.parent_id,
  starred: !!f.starred,
  trashed: !!f.trashed,
  createdAt: f.created_at,
  type: 'folder',
  channelMessageId: f.channel_message_id,
});

/** GET /?categoryId=<id>&parentId=<id|null> */
router.get('/', (req, res) => {
  const userId = req.userId;
  const categoryId =
    req.query.categoryId && req.query.categoryId !== 'null'
      ? Number(req.query.categoryId)
      : null;
  const parentId =
        req.query.parentId && req.query.parentId !== 'null'
          ? Number(req.query.parentId)
          : null;
  const folders = db.listFolders(userId, categoryId, parentId).map(shapeFolder);
  res.json({ folders });
});

/** GET /tree?categoryId=<id> — folder tree for "Move to" dialog */
router.get('/tree', (req, res) => {
  const userId = req.userId;
  const categoryId =
    req.query.categoryId && req.query.categoryId !== 'null'
      ? Number(req.query.categoryId)
      : null;
  const all = db
    .prepare(
      'SELECT id, parent_id, name FROM folders WHERE user_id=? AND trashed=0 AND category_id IS ? ORDER BY name COLLATE NOCASE'
    )
    .all(userId, categoryId ?? null);
  res.json({ folders: all.map((f) => ({ id: f.id, parentId: f.parent_id, name: f.name })) });
});

/** POST / — create a new folder (posts message in category channel) */
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const categoryId =
    req.body?.categoryId && req.body.categoryId !== 'null'
      ? Number(req.body.categoryId)
      : null;
  const parentId =
    req.body?.parentId && req.body.parentId !== 'null'
      ? Number(req.body.parentId)
      : null;

  // Validate category exists
  if (categoryId != null && !db.getCategory(categoryId, req.userId)) {
    return res.status(404).json({ error: 'Category not found' });
  }

  // Validate parent folder exists and belongs to same category
  if (parentId != null) {
    const parent = db.getFolder(parentId, req.userId);
    if (!parent) return res.status(404).json({ error: 'Parent folder not found' });
    if (categoryId != null && parent.category_id !== categoryId) {
      return res.status(400).json({ error: 'Parent folder must be in the same category' });
    }
  }

  let channelMessageId = 0;
  
  // Post folder message in category channel
  if (categoryId != null) {
    const category = db.getCategory(categoryId, req.userId);
    if (category && category.channel_id) {
      try {
        const result = await postTextMessage(
          req.userId,
          category.channel_id,
          `📁 Folder: ${name}`
        );
        channelMessageId = result.messageId;
      } catch (err) {
        console.error('Failed to post folder message in channel:', err.message);
        // Continue anyway - folder is still created
      }
    }
  }

  const id = db.insertFolder(req.userId, categoryId, parentId, name, channelMessageId);
  res.status(201).json({ folder: shapeFolder(db.getFolder(id, req.userId)) });
});

/** PATCH /:id — rename, star, trash, move */
router.patch('/:id', (req, res) => {
  const folder = db.getFolder(Number(req.params.id), req.userId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const { name, starred, trashed, parentId, categoryId } = req.body || {};
  if (typeof name === 'string' && name.trim()) db.renameFolder(folder.id, req.userId, name.trim());
  if (starred !== undefined) db.setFolderStar(folder.id, req.userId, !!starred);
  if (trashed !== undefined) db.setFolderTrash(folder.id, req.userId, !!trashed);
  if (parentId !== undefined) {
    const target = parentId == null ? null : Number(parentId);
    if (target != null) {
      if (!db.getFolder(target, req.userId)) return res.status(404).json({ error: 'Target folder not found' });
      if (db.isDescendant(target, folder.id, req.userId))
        return res.status(400).json({ error: 'Cannot move a folder into itself' });
    }
    db.moveFolder(folder.id, req.userId, target);
  }
  res.json({ folder: shapeFolder(db.getFolder(folder.id, req.userId)) });
});

/** DELETE /:id — permanent delete (purges contained files from Telegram) */
router.delete('/:id', async (req, res) => {
  const userId = req.userId;
  const folder = db.getFolder(Number(req.params.id), userId);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const { purgeFile } = await import('./drive.js');
  const ids = db.collectFolderIds(folder.id, userId);
  const placeholders = ids.map(() => '?').join(',');
  const doomed = db
    .prepare(`SELECT * FROM files WHERE folder_id IN (${placeholders}) AND user_id=?`)
    .all(...ids, userId);
  for (const f of doomed) await purgeFile(f, userId);
  for (const id of ids) db.deleteFolderRow(id, userId);
  res.json({ ok: true, removedFiles: doomed.length });
});

export default router;