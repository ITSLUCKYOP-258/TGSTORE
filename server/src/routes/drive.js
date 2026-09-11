import { Router } from 'express';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();

/** Media files get a thumbnail endpoint so grids can show real previews. */
const shapeFile = (f) => ({
  ...f,
  type: 'file',
  thumbnail:
    f.mime && (String(f.mime).startsWith('image/') || String(f.mime).startsWith('video/'))
      ? `/api/files/${f.id}/thumb`
      : undefined,
});

const shapeFolder = (f) => ({
  id: f.id,
  name: f.name,
  parentId: f.parent_id,
  starred: !!f.starred,
  trashed: !!f.trashed,
  createdAt: f.created_at,
  type: 'folder',
  itemCount: f.itemCount ?? 0,
  totalSize: f.totalSize ?? 0,
});

/** GET /?categoryId=<id>&folder=<id|null>&view=drive|starred|trash|search&q=... */
router.get('/', requireAuth, (req, res) => {
  const userId = req.userId;
  const view = req.query.view || 'drive';
  const q = String(req.query.q || '').trim();
  const categoryId =
    req.query.categoryId && req.query.categoryId !== 'null'
      ? Number(req.query.categoryId)
      : null;

  let folders = [];
  let files = [];
  let breadcrumbs = [];

  if (view === 'search' && q) {
    folders = db.searchFolders(userId, q).map(shapeFolder);
    files = db.searchFiles(userId, q).map(shapeFile);
  } else if (view === 'starred') {
    folders = db.listStarredFolders(userId).map(shapeFolder);
    files = db.listStarredFiles(userId).map(shapeFile);
  } else if (view === 'trash') {
    folders = db.listTrashedFolders(userId).map(shapeFolder);
    files = db.listTrashedFiles(userId).map(shapeFile);
  } else {
    const folderId = req.query.folder && req.query.folder !== 'null' ? Number(req.query.folder) : null;
    if (folderId != null) {
      const folder = db.getFolder(folderId, userId);
      if (!folder) return res.status(404).json({ error: 'Folder not found' });
      // build breadcrumb trail
      let cur = folder;
      while (cur) {
        breadcrumbs.unshift({ id: cur.id, name: cur.name });
        cur = cur.parent_id ? db.getFolder(cur.parent_id, userId) : null;
      }
    }
    folders = db.listFolders(userId, categoryId, folderId).map(shapeFolder);
    files = db.listFiles(userId, categoryId, folderId).map(shapeFile);
  }

  breadcrumbs.unshift({ id: null, name: categoryId ? `Category` : 'My Drive' });
  res.json({ folders, files, breadcrumbs, categoryId });
});

export async function purgeFile(file, userId) {
  const chunks = db.getChunks(file.id);
  const { deleteStoredMessage } = await import('../telegram.js');
  const { deleteMessages } = await import('../mtproto.js');
  const accessHash = file.category_id
    ? db.getCategory(file.category_id, userId)?.access_hash || null
    : null;
  await Promise.allSettled(chunks.map((c) => {
    // Chunks with a numeric tg_file_id were stored via the USER's MTProto
    // session → they live in the USER's channel and must be deleted with the
    // user's session (the bot is not a member there). Legacy bot-API chunks
    // keep using the bot path.
    if (/^\d+$/.test(String(c.tg_file_id || ''))) {
      return deleteMessages(userId, c.chat_id, [c.message_id], accessHash).catch((err) =>
        console.error(`[purge] failed to delete msg ${c.message_id} from user channel: ${err?.message || err}`)
      );
    }
    return deleteStoredMessage(c.chat_id, c.message_id);
  }));
  db.deleteFileRow(file.id, userId);
}

/** POST /trash/empty — permanently remove everything in trash. */
router.post('/trash/empty', requireAuth, async (req, res) => {
  const userId = req.userId;
  const files = db.listTrashedFiles(userId);
  for (const f of files) await purgeFile(f, userId);
  const folderIds = db.listTrashedFolders(userId).map((f) => f.id);
  for (const id of folderIds) {
    const ids = db.collectFolderIds(id, userId);
    for (const fid of ids) db.deleteFolderRow(fid, userId);
  }
  res.json({ ok: true });
});

router.get('/storage', requireAuth, (req, res) => {
  const stats = db.storageStats(req.userId);
  res.json({ used: stats.used, files: stats.count, quota: null /* unlimited */ });
});

export default router;
