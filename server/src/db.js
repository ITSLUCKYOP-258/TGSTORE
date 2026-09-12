import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR || path.join(__dirname, '..');
const db = new Database(path.join(dataDir, 'tgstore.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_id TEXT UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  is_dev INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  channel_id TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  parent_id INTEGER REFERENCES folders(id),
  name TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  trashed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, category_id, parent_id);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  category_id INTEGER REFERENCES categories(id),
  folder_id INTEGER REFERENCES folders(id),
  name TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT 'application/octet-stream',
  size INTEGER NOT NULL DEFAULT 0,
  starred INTEGER NOT NULL DEFAULT 0,
  trashed INTEGER NOT NULL DEFAULT 0,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_user ON files(user_id, category_id, folder_id);
CREATE INDEX IF NOT EXISTS idx_files_name ON files(user_id, name);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  idx INTEGER NOT NULL,
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  tg_file_id TEXT NOT NULL,
  size INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_id, idx);

CREATE TABLE IF NOT EXISTS shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ---------- migrations (add columns to pre-existing databases) ---------- */
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}
ensureColumn('users', 'mt_session', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'mt_phone', "TEXT NOT NULL DEFAULT ''");
ensureColumn('users', 'last_login', 'TEXT');
ensureColumn('folders', 'category_id', 'INTEGER REFERENCES categories(id)');
ensureColumn('files', 'category_id', 'INTEGER REFERENCES categories(id)');
ensureColumn('folders', 'channel_message_id', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('files', 'channel_message_id', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('categories', 'access_hash', "TEXT NOT NULL DEFAULT ''");

export default db;

/* ---------- users ---------- */
export const upsertTelegramUser = db.transaction((u) => {
  const existing = db
    .prepare('SELECT * FROM users WHERE tg_id = ?')
    .get(String(u.id));
  if (existing) {
    db.prepare(
      `UPDATE users SET first_name=?, last_name=?, username=?, photo_url=?, last_login=datetime('now') WHERE id=?`
    ).run(u.first_name || '', u.last_name || '', u.username || '', u.photo_url || '', existing.id);
    return db.prepare('SELECT * FROM users WHERE id=?').get(existing.id);
  }
  const info = db
    .prepare(
      `INSERT INTO users (tg_id, first_name, last_name, username, photo_url, last_login) VALUES (?,?,?,?,?,datetime('now'))`
    )
    .run(String(u.id), u.first_name || '', u.last_name || '', u.username || '', u.photo_url || '');
  return db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
});

export const createDevUser = db.transaction((name) => {
  // Reuse the same dev account across logins so uploads persist between sessions
  const existing = db
    .prepare('SELECT * FROM users WHERE is_dev=1 ORDER BY id LIMIT 1')
    .get();
  if (existing) {
    db.prepare(`UPDATE users SET last_login=datetime('now') WHERE id=?`).run(existing.id);
    return existing;
  }
  const info = db
    .prepare(`INSERT INTO users (first_name, is_dev, last_login) VALUES (?, 1, datetime('now'))`)
    .run(name || 'Dev User');
  return db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
});

export const getUserById = (id) =>
  db.prepare('SELECT * FROM users WHERE id=?').get(id);

/** Every account that has ever logged in — for the admin API (no secrets).
 *  Includes per-user file count + storage used (ciphertext bytes). */
export const listUsers = () =>
  db
    .prepare(
      `SELECT u.id, u.tg_id, u.first_name, u.last_name, u.username, u.photo_url, u.is_dev,
              (u.mt_session != '') AS telegram_connected, u.mt_phone, u.last_login, u.created_at,
              COALESCE(f.file_count, 0)    AS file_count,
              COALESCE(f.storage_bytes, 0) AS storage_bytes
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS file_count, COALESCE(SUM(size), 0) AS storage_bytes
         FROM files WHERE trashed = 0 GROUP BY user_id
       ) f ON f.user_id = u.id
       ORDER BY u.last_login DESC`
    )
    .all();

/** Aggregate stats for the admin API. */
export const getUserStats = () => {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total_users,
              SUM(CASE WHEN mt_session != '' THEN 1 ELSE 0 END) AS telegram_connected,
              SUM(CASE WHEN last_login >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS active_last_24h
       FROM users`
    )
    .get();
  const files = db
    .prepare(`SELECT COUNT(*) AS total_files, COALESCE(SUM(size),0) AS total_bytes FROM files WHERE trashed=0`)
    .get();
  return { ...totals, ...files };
};

export const setMtSession = (userId, session, phone) =>
  db
    .prepare(`UPDATE users SET mt_session=?, mt_phone=COALESCE(NULLIF(?, ''), mt_phone) WHERE id=?`)
    .run(session, phone || '', userId);

/* ---------- categories ---------- */
export const insertCategory = (userId, name, channelId, accessHash = '') =>
  db
    .prepare(
      'INSERT INTO categories (user_id, name, channel_id, access_hash) VALUES (?,?,?,?)'
    )
    .run(userId, name, channelId || '', String(accessHash || '')).lastInsertRowid;

export const listCategories = (userId) =>
  db.prepare('SELECT * FROM categories WHERE user_id=? ORDER BY name COLLATE NOCASE').all(userId);

export const getCategory = (id, userId) =>
  db.prepare('SELECT * FROM categories WHERE id=? AND user_id=?').get(id, userId);

/** Get category by name (case-insensitive) for duplicate prevention */
export const getCategoryByName = (userId, name) =>
  db.prepare('SELECT * FROM categories WHERE user_id=? AND name COLLATE NOCASE = ?').get(userId, name);


export const deleteCategoryRow = (id, userId) =>
  db.prepare('DELETE FROM categories WHERE id=? AND user_id=?').run(id, userId);

export const renameCategory = (id, userId, name) =>
  db.prepare('UPDATE categories SET name=? WHERE id=? AND user_id=?').run(name, id, userId);

export const listFilesByCategory = (userId, categoryId) =>
  db.prepare('SELECT * FROM files WHERE user_id=? AND category_id=?').all(userId, categoryId);

export const listFoldersByCategory = (userId, categoryId) =>
  db.prepare('SELECT * FROM folders WHERE user_id=? AND category_id=?').all(userId, categoryId);

/* ---------- folders ---------- */
export const insertFolder = (userId, categoryId, parentId, name, channelMessageId = 0) =>
  db
    .prepare('INSERT INTO folders (user_id, category_id, parent_id, name, channel_message_id) VALUES (?,?,?,?,?)')
    .run(userId, categoryId, parentId, name, channelMessageId).lastInsertRowid;

export const getFolder = (id, userId) =>
  db.prepare('SELECT * FROM folders WHERE id=? AND user_id=?').get(id, userId);

export const listFolders = (userId, categoryId, parentId) =>
  db
    .prepare(
      `SELECT f.*,
         (SELECT COUNT(*) FROM files fi WHERE fi.folder_id=f.id AND fi.user_id=f.user_id AND fi.trashed=0) AS itemCount,
         (SELECT COALESCE(SUM(fi.size),0) FROM files fi WHERE fi.folder_id=f.id AND fi.user_id=f.user_id AND fi.trashed=0) AS totalSize
       FROM folders f
       WHERE f.user_id=? AND f.trashed=0 AND f.category_id IS ? AND f.parent_id IS ?
       ORDER BY f.name COLLATE NOCASE`
    )
    .all(userId, categoryId ?? null, parentId ?? null);

export const listTrashedFolders = (userId) =>
  db.prepare('SELECT * FROM folders WHERE user_id=? AND trashed=1 ORDER BY name').all(userId);

export const listStarredFolders = (userId) =>
  db.prepare('SELECT * FROM folders WHERE user_id=? AND trashed=0 AND starred=1 ORDER BY name').all(userId);

export const searchFolders = (userId, q) =>
  db
    .prepare(`SELECT * FROM folders WHERE user_id=? AND trashed=0 AND name LIKE ? ORDER BY name LIMIT 100`)
    .all(userId, `%${q}%`);

export const renameFolder = (id, userId, name) =>
  db.prepare('UPDATE folders SET name=? WHERE id=? AND user_id=?').run(name, id, userId);

export const setFolderStar = (id, userId, v) =>
  db.prepare('UPDATE folders SET starred=? WHERE id=? AND user_id=?').run(v ? 1 : 0, id, userId);

export const setFolderTrash = (id, userId, v) =>
  db.prepare('UPDATE folders SET trashed=? WHERE id=? AND user_id=?').run(v ? 1 : 0, id, userId);

/** Count all non-trashed files that live directly inside a folder (non-recursive). */
export const countFolderItems = (folderId, userId) =>
  db
    .prepare(
      'SELECT COUNT(*) AS count FROM files WHERE user_id=? AND folder_id=? AND trashed=0'
    )
    .get(folderId, userId).count;

/** Recursively collect all descendant folder ids (including the folder itself). */
export function collectFolderIds(id, userId) {
  const ids = [id];
  const walk = (pid) => {
    for (const row of db.prepare('SELECT id FROM folders WHERE parent_id=? AND user_id=?').all(pid, userId)) {
      ids.push(row.id);
      walk(row.id);
    }
  };
  walk(id);
  return ids;
}

/** True if candidateId is inside the subtree rooted at ancestorId. */
export function isDescendant(candidateId, ancestorId, userId) {
  let cur = candidateId;
  const seen = new Set();
  while (cur != null) {
    if (seen.has(cur)) return false;
    seen.add(cur);
    if (cur === ancestorId) return true;
    const row = db.prepare('SELECT parent_id FROM folders WHERE id=? AND user_id=?').get(cur, userId);
    if (!row) return false;
    cur = row.parent_id;
  }
  return false;
}

export const moveFolder = (id, userId, parentId) =>
  db.prepare('UPDATE folders SET parent_id=? WHERE id=? AND user_id=?').run(parentId, id, userId);

export const deleteFolderRow = (id, userId) =>
  db.prepare('DELETE FROM folders WHERE id=? AND user_id=?').run(id, userId);

/* ---------- files ---------- */
export const insertFile = db.transaction((userId, categoryId, folderId, name, mime, size, chunks, channelMessageId = 0) => {
  const info = db
    .prepare(
      `INSERT INTO files (user_id, category_id, folder_id, name, mime, size, chunk_count, channel_message_id) VALUES (?,?,?,?,?,?,?,?)`
    )
    .run(userId, categoryId, folderId, name, mime, size, chunks.length, channelMessageId);
  const fileId = info.lastInsertRowid;
  const stmt = db.prepare(
    `INSERT INTO chunks (file_id, idx, chat_id, message_id, tg_file_id, size) VALUES (?,?,?,?,?,?)`
  );
  chunks.forEach((c, i) => stmt.run(fileId, i, c.chatId, c.messageId, c.tgFileId, c.size));
  return fileId;
});

export const getFile = (id, userId) =>
  db.prepare('SELECT * FROM files WHERE id=? AND user_id=?').get(id, userId);

export const getChunks = (fileId) =>
  db.prepare('SELECT * FROM chunks WHERE file_id=? ORDER BY idx').all(fileId);

export const listFiles = (userId, categoryId, folderId) =>
  db
    .prepare(
      `SELECT * FROM files WHERE user_id=? AND trashed=0 AND category_id IS ? AND folder_id IS ? ORDER BY name COLLATE NOCASE`
    )
    .all(userId, categoryId ?? null, folderId ?? null);

export const listTrashedFiles = (userId) =>
  db.prepare('SELECT * FROM files WHERE user_id=? AND trashed=1 ORDER BY name').all(userId);

export const listStarredFiles = (userId) =>
  db.prepare('SELECT * FROM files WHERE user_id=? AND trashed=0 AND starred=1 ORDER BY name').all(userId);

export const searchFiles = (userId, q) =>
  db
    .prepare(`SELECT * FROM files WHERE user_id=? AND trashed=0 AND name LIKE ? ORDER BY created_at DESC LIMIT 200`)
    .all(userId, `%${q}%`);

export const updateFile = (id, userId, fields) => {
  const allowed = ['name', 'starred', 'trashed', 'folder_id', 'category_id'];
  const sets = [];
  const vals = [];
  for (const k of allowed) {
    if (k in fields) {
      sets.push(`${k}=?`);
      vals.push(fields[k]);
    }
  }
  if (!sets.length) return;
  vals.push(id, userId);
  db.prepare(`UPDATE files SET ${sets.join(', ')} WHERE id=? AND user_id=?`).run(...vals);
};

export const deleteFileRow = (id, userId) =>
  db.prepare('DELETE FROM files WHERE id=? AND user_id=?').run(id, userId);

export const storageStats = (userId) =>
  db
    .prepare(`SELECT COALESCE(SUM(size),0) AS used, COUNT(*) AS count FROM files WHERE user_id=? AND trashed=0`)
    .get(userId);

/* ---------- shares ---------- */
export const createShare = (userId, fileId, token) =>
  db
    .prepare('INSERT INTO shares (user_id, file_id, token) VALUES (?,?,?)')
    .run(userId, fileId, token).lastInsertRowid;

export const listShares = (userId) =>
  db
    .prepare(
      `SELECT s.id, s.token, s.created_at, s.file_id, f.name, f.size, f.mime
       FROM shares s JOIN files f ON f.id = s.file_id WHERE s.user_id=? ORDER BY s.created_at DESC`
    )
    .all(userId);

export const getShareByToken = (token) =>
  db
    .prepare(
      `SELECT s.token, s.created_at, f.id AS file_id, f.name, f.size, f.mime
       FROM shares s JOIN files f ON f.id = s.file_id WHERE s.token=?`
    )
    .get(token);

export const deleteShare = (id, userId) =>
  db.prepare('DELETE FROM shares WHERE id=? AND user_id=?').run(id, userId);


