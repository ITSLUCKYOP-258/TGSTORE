import { Router } from 'express';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';
import { isConfigured as mtConfigured, createChannel, inviteBotToChannel } from '../mtproto.js';

const router = Router();

// All category routes require auth
router.use(requireAuth);

/** Never expose the channel access hash to the browser — it is a capability token. */
const shapeCategory = (row) => ({
  id: row.id,
  name: row.name,
  channelId: row.channel_id,
  channelActive: Boolean(row.channel_id && row.access_hash),
  createdAt: row.created_at,
});

/** GET / — list user's categories */
router.get('/', (req, res) => {
  const categories = db.listCategories(req.userId).map(shapeCategory);
  res.json({ categories });
});

/** POST / — create a new category with its own Telegram channel */
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  // Validate MTProto configuration
  if (!mtConfigured()) {
    return res.status(400).json({
      error: 'MTProto is not configured on this server. Cannot create channels.'
    });
  }

  // Check user has MTProto session
  const user = db.getUserById(req.userId);
  if (!user?.mt_session) {
    return res.status(401).json({
      error: 'MTProto session required. Please login via phone number first.'
    });
  }
  console.log(
    `[categories] creating category name="${name}" user=${req.userId} phone=${user.mt_phone || 'n/a'}`
  );

  // Prevent duplicate categories (case-insensitive)
  const existing = db.getCategoryByName(req.userId, name);
  if (existing) {
    return res.status(409).json({
      error: `Category "${name}" already exists`,
      category: shapeCategory(existing)
    });
  }

  let channel = null;
  let channelId = null;
  let botInvited = false;

  try {
    // Create the Telegram channel via the USER's MTProto session
    channel = await createChannel(req.userId, `TGStore: ${name}`);

    if (!channel?.channelId) {
      throw new Error('No channel ID returned from Telegram');
    }

    // createChannel now returns the Bot API chat ID format (-100<id>) + accessHash
    channelId = channel.channelId;

    // Invite bot to the newly created channel (uses accessHash to address it).
    // Best-effort only — the app streams via the user's own session, so the bot
    // is only needed for the legacy Bot-API fallback.
    const botUsername = process.env.BOT_USERNAME;
    if (botUsername) {
      botInvited = true;
      try {
        await inviteBotToChannel(
          req.userId,
          channel.rawChannelId,
          channel.accessHash,
          botUsername.replace('@', '')
        );
      } catch (inviteErr) {
        botInvited = false;
        const isBotPolicy = /USER_BOT|BOT_METHOD_INVALID|USER_NOT_PARTICIPANT/i.test(
          String(inviteErr?.message)
        );
        if (isBotPolicy) {
          console.log(
            `⚠ [categories] bot @${botUsername} can't be auto-added to user channels ` +
            `(${inviteErr.message}) — continuing, bot is optional.`
          );
        } else {
          console.error(
            `[categories] failed to invite bot to channel ${channelId} (user ${req.userId}):`,
            inviteErr?.message
          );
        }
        // Don't fail category creation — bot can be added manually
      }
    }
  } catch (err) {
    console.error(
      `[categories] failed to create Telegram channel (user ${req.userId}):`,
      err.message
    );
    return res.status(err.status || 502).json({
      error: `Failed to create Telegram channel: ${err.message}`
    });
  }

  // Save category with the real Telegram channel ID + accessHash (required for
  // every later MTProto operation on that channel).
  const id = db.insertCategory(req.userId, name, channelId, channel.accessHash);
  const category = db.getCategory(id, req.userId);
  console.log(
    `[categories] created category id=${id} user=${req.userId} channel=${channelId} accessHash=${channel.accessHash}`
  );

  res.status(201).json({
    category: shapeCategory(category),
    channel: channel
      ? {
          channelId: channel.channelId,
          botApiId: channelId,
          title: channel.title,
          botInvited
        }
      : null
  });
});

/** PATCH /:id — rename a category */
router.patch('/:id', (req, res) => {
  const category = db.getCategory(Number(req.params.id), req.userId);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });

  db.renameCategory(category.id, req.userId, name);
  res.json({ category: shapeCategory(db.getCategory(category.id, req.userId)) });
});

/** DELETE /:id — delete a category and all its contents */
router.delete('/:id', async (req, res) => {
  const category = db.getCategory(Number(req.params.id), req.userId);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  // Delete all files in this category (purge from Telegram)
  const files = db.listFilesByCategory(req.userId, category.id);
  for (const f of files) {
    const { purgeFile } = await import('./drive.js');
    await purgeFile(f, req.userId);
  }

  // Delete all folders in this category
  const folders = db.listFoldersByCategory(req.userId, category.id);
  for (const f of folders) {
    db.deleteFolderRow(f.id, req.userId);
  }

  db.deleteCategoryRow(category.id, req.userId);
  res.json({ ok: true, removedFiles: files.length, removedFolders: folders.length });
});

export default router;