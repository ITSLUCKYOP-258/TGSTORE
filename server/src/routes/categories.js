import { Router } from 'express';
import * as db from '../db.js';
import { requireAuth } from '../auth.js';
import { isConfigured as mtConfigured, createChannel, inviteBotToChannel } from '../mtproto.js';

const router = Router();

// All category routes require auth
router.use(requireAuth);

/** GET / — list user's categories */
router.get('/', (req, res) => {
  const categories = db.listCategories(req.userId);
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

  // Prevent duplicate categories (case-insensitive)
  const existing = db.getCategoryByName(req.userId, name);
  if (existing) {
    return res.status(409).json({ 
      error: `Category "${name}" already exists`, 
      category: existing 
    });
  }

  let channel = null;
  let channelId = null;

  try {
    // Create the Telegram channel via user's MTProto session
    channel = await createChannel(req.userId, `TGStore: ${name}`);
    
    if (!channel?.channelId) {
      throw new Error('No channel ID returned from Telegram');
    }

    // createChannel now returns the Bot API chat ID format (-100<id>) directly
    channelId = channel.channelId;  

    // Invite bot to the newly created channel
    const botUsername = process.env.BOT_USERNAME;
    if (botUsername) {
      try {
        // For gramJS APIs we need the raw channel ID (strip -100 prefix)
        const rawChannelId = channelId.startsWith('-100') ? channelId.slice(4) : channelId;
        await inviteBotToChannel(req.userId, rawChannelId, botUsername.replace('@', ''));
      } catch (inviteErr) {
        console.error(`Failed to invite bot to channel ${channelId}:`, inviteErr.message);
        // Don't fail category creation — bot can be added manually
        // But mark this in the response
      }
    }
  } catch (err) {
    console.error('Failed to create Telegram channel:', err.message);
    return res.status(502).json({ 
      error: `Failed to create Telegram channel: ${err.message}` 
    });
  }

  // Save category with the real Telegram channel ID
  const id = db.insertCategory(req.userId, name, channelId);
  const category = db.getCategory(id, req.userId);
  
  res.status(201).json({ 
    category,
    channel: channel ? {
      channelId: channel.channelId,
      botApiId: channelId,
      title: channel.title,
      botInvited: !!botUsername
    } : null
  });
});

/** PATCH /:id — rename a category */
router.patch('/:id', (req, res) => {
  const category = db.getCategory(Number(req.params.id), req.userId);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });

  db.renameCategory(category.id, req.userId, name);
  res.json({ category: db.getCategory(category.id, req.userId) });
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