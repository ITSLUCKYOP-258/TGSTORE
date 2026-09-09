/**
 * MTProto (GramJS) client management — phone-number login + access to the
 * user's own Telegram account media (chats, Saved Messages, channels...).
 *
 * Requires MT_API_ID / MT_API_HASH from https://my.telegram.org
 */
import { TelegramClient, Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { computeCheck } from 'telegram/Password.js';
import bigInt from 'big-integer';
import db, { getUserById, setMtSession } from './db.js';

export const isConfigured = () =>
  Boolean(process.env.MT_API_ID) && Boolean(process.env.MT_API_HASH);

const creds = () => ({
  apiId: Number(process.env.MT_API_ID),
  apiHash: process.env.MT_API_HASH,
});

function makeClient(sessionString) {
  const client = new TelegramClient(
    new StringSession(sessionString || ''),
    creds().apiId,
    creds().apiHash,
    { connectionRetries: 3, requestRetries: 2 }
  );
  client.setLogLevel?.('error');
  return client;
}

/* ------------------------------------------------------------------ */
/* Login flows (phone -> code -> optional password), kept in memory    */
/* ------------------------------------------------------------------ */
const flows = new Map(); // flowId -> { client, phone, phoneCodeHash, createdAt }
const FLOW_TTL = 10 * 60 * 1000;

function sweepFlows() {
  const now = Date.now();
  for (const [id, f] of flows) {
    if (now - f.createdAt > FLOW_TTL) {
      f.client.disconnect?.().catch(() => {});
      flows.delete(id);
    }
  }
}

export async function startLoginFlow(phone) {
  if (!isConfigured()) throw new Error('MTProto login is not configured on this server');
  sweepFlows();
  const client = makeClient('');
  await client.connect();
  const { phoneCodeHash, isCodeViaApp } = await client.sendCode(creds(), phone);
  const flowId = bigInt(Date.now()).add(bigInt.randBetween(0, 1e9)).toString();
  flows.set(flowId, { client, phone, phoneCodeHash, createdAt: Date.now() });
  return { flowId, isCodeViaApp };
}

function finishLogin(client) {
  return client.getMe().then(async (me) => {
    const session = client.session.save();
    await client.disconnect?.();
    return {
      me: {
        id: String(me.id),
        firstName: me.firstName || '',
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || '',
      },
      session,
    };
  });
}

export async function verifyLoginCode(flowId, code) {
  const flow = flows.get(flowId);
  if (!flow) throw new Error('Login session expired — request a new code');
  try {
    await flow.client.invoke(
      new Api.auth.SignIn({
        phoneNumber: flow.phone,
        phoneCodeHash: flow.phoneCodeHash,
        phoneCode: code,
      })
    );
  } catch (err) {
    const msg = String(err.errorMessage || err.message || '');
    if (msg.includes('SESSION_PASSWORD_NEEDED')) return { needPassword: true };
    if (msg.includes('PHONE_CODE_INVALID')) throw new Error('Invalid code — check your Telegram and try again');
    if (msg.includes('PHONE_CODE_EXPIRED')) throw new Error('Code expired — request a new one');
    if (msg.startsWith('FLOOD_WAIT')) throw new Error('Too many attempts — wait a few minutes and retry');
    throw new Error(msg || 'Login failed');
  }
  const { me, session } = await finishLogin(flow.client);
  flows.delete(flowId);
  return { me, session };
}

export async function verifyLoginPassword(flowId, password) {
  const flow = flows.get(flowId);
  if (!flow) throw new Error('Login session expired — start again');
  try {
    const pwdInfo = await flow.client.invoke(new Api.account.GetPassword());
    const check = await computeCheck(pwdInfo, password);
    await flow.client.invoke(new Api.auth.CheckPassword({ password: check }));
  } catch (err) {
    const msg = String(err.errorMessage || err.message || '');
    if (msg.includes('PASSWORD_HASH_INVALID')) throw new Error('Wrong password');
    throw new Error(msg || 'Login failed');
  }
  const { me, session } = await finishLogin(flow.client);
  flows.delete(flowId);
  return { me, session };
}

/* ------------------------------------------------------------------ */
/* Authenticated user clients                                          */
/* ------------------------------------------------------------------ */
const clients = new Map(); // userId -> TelegramClient

export async function getUserClient(userId) {
  const cached = clients.get(userId);
  if (cached) {
    if (!cached.connected) await cached.connect().catch(() => {});
    return cached;
  }
  const user = getUserById(userId);
  if (!user?.mt_session) {
    const err = new Error('Telegram account not connected');
    err.status = 401;
    throw err;
  }
  const client = makeClient(user.mt_session);
  try {
    await client.connect();
  } catch (err) {
    throw new Error('Could not connect to Telegram: ' + err.message);
  }
  clients.set(userId, client);
  return client;
}

export async function saveUserSession(userId, session, phone) {
  setMtSession(userId, session, phone);
}

export async function disconnectUser(userId) {
  const client = clients.get(userId);
  if (client) {
    await client.disconnect?.().catch(() => {});
    clients.delete(userId);
  }
  setMtSession(userId, '', '');
}

/* ------------------------------------------------------------------ */
/* Browsing: dialogs (chats) and media messages                        */
/* ------------------------------------------------------------------ */
export async function listDialogs(userId, limit = 100) {
  const client = await getUserClient(userId);
  const dialogs = await client.getDialogs({ limit });
  return dialogs.map((d) => {
    const e = d.entity;
    return {
      id: String(e.id),
      type: e.className === 'User' ? 'user' : e.className === 'Channel' ? (e.megagroup ? 'group' : 'channel') : 'group',
      title: [e.firstName, e.lastName].filter(Boolean).join(' ') || e.title || e.username || 'Chat',
      username: e.username || null,
      lastMessage: d.message?.message?.slice(0, 80) || (d.message?.media ? '📎 Media' : ''),
    };
  });
}

const MEDIA_FILTERS = {
  photo: () => new Api.InputMessagesFilterPhotos(),
  video: () => new Api.InputMessagesFilterVideo(),
  doc: () => new Api.InputMessagesFilterDocument(),
  music: () => new Api.InputMessagesFilterMusic(),
};

function toNum(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v?.toNumber === 'function') return v.toNumber();
  if (typeof v?.value !== 'undefined') return Number(v.value);
  return 0;
}

function kindOf(mime, name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'music';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || ['txt', 'md', 'log', 'json', 'js', 'ts', 'py', 'csv'].includes(ext)) return 'text';
  return 'doc';
}

/** Extract display info from a message's media. Returns null for non-media. */
export function mediaInfo(msg) {
  const m = msg.media;
  if (!m) return null;
  if (m.className === 'MessageMediaDocument' && m.document?.className === 'Document') {
    const doc = m.document;
    let name = '';
    for (const a of doc.attributes || []) {
      if (a.className === 'DocumentAttributeFilename' && a.fileName) name = a.fileName;
    }
    if (!name) name = `file_${msg.id}`;
    return {
      msgId: msg.id,
      name,
      mime: doc.mimeType || 'application/octet-stream',
      size: toNum(doc.size),
      date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
      kind: kindOf(doc.mimeType || '', name),
    };
  }
  if (m.className === 'MessageMediaPhoto' && m.photo?.className === 'Photo') {
    const photo = m.photo;
    let size = 0;
    for (const s of photo.sizes || []) {
      if (s.className === 'PhotoSizeProgressive' && s.sizes?.length) {
        size = Math.max(size, s.sizes[s.sizes.length - 1]);
      } else if (s.className === 'PhotoSize' && s.size) {
        size = Math.max(size, s.size);
      }
    }
    return {
      msgId: msg.id,
      name: `photo_${photo.id}.jpg`,
      mime: 'image/jpeg',
      size,
      date: msg.date ? new Date(msg.date * 1000).toISOString() : null,
      kind: 'image',
    };
  }
  return null;
}

export async function listMedia(userId, chatId, filter = 'all', limit = 200) {
  const client = await getUserClient(userId);
  const out = [];
  const opts = { limit };
  if (MEDIA_FILTERS[filter]) opts.filter = MEDIA_FILTERS[filter]();
  for await (const msg of client.iterMessages(Number(chatId), opts)) {
    const info = mediaInfo(msg);
    if (info) out.push(info);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Media download streaming (with byte-range support)                  */
/* ------------------------------------------------------------------ */
function pickLargestPhotoSize(photo) {
  let best = null;
  for (const s of photo.sizes || []) {
    if (s.className === 'PhotoSizeProgressive' && s.sizes?.length) {
      if (!best || s.sizes[s.sizes.length - 1] > (best.bytes || 0)) {
        best = { type: s.type, bytes: s.sizes[s.sizes.length - 1], progressive: s.sizes };
      }
    } else if (s.className === 'PhotoSize' && s.size) {
      if (!best || s.size > (best.bytes || 0)) best = { type: s.type, bytes: s.size };
    }
  }
  return best;
}

/** Build the download location + exact total size for a message's media. */
export function fileLocation(msg) {
  const m = msg.media;
  if (!m) return null;
  if (m.className === 'MessageMediaDocument' && m.document?.className === 'Document') {
    const doc = m.document;
    return {
      location: new Api.InputDocumentFileLocation({
        id: doc.id,
        accessHash: doc.accessHash,
        fileReference: doc.fileReference,
      }),
      size: toNum(doc.size),
    };
  }
  if (m.className === 'MessageMediaPhoto' && m.photo?.className === 'Photo') {
    const photo = m.photo;
    const best = pickLargestPhotoSize(photo);
    if (!best) return null;
    const total = best.progressive ? best.progressive[best.progressive.length - 1] : best.bytes;
    return {
      location: new Api.InputPhotoFileLocation({
        id: photo.id,
        accessHash: photo.accessHash,
        fileReference: photo.fileReference,
        thumbSize: best.type,
      }),
      size: total || 0,
    };
  }
  return null;
}

const ALIGN = 4096;
const REQ_SIZE = 512 * 1024; // divisible by 4096, within Telegram limits

/**
 * Yield raw bytes for [start, end] of the given file location.
 * Telegram requires 4096-aligned offsets, so we align down and skip.
 */
export async function* downloadBytes(client, location, { start = 0, end = Infinity } = {}) {
  let alignedStart = Math.floor(start / ALIGN) * ALIGN;
  let skip = start - alignedStart;
  let remaining = end - start + 1;
  for await (const buf of client.iterDownload({
    file: location,
    offset: bigInt(alignedStart),
    requestSize: REQ_SIZE,
  })) {
    if (remaining <= 0) break;
    let b = buf;
    if (skip > 0) {
      if (skip >= b.length) {
        skip -= b.length;
        continue;
      }
      b = b.subarray(skip);
      skip = 0;
    }
    if (b.length > remaining) b = b.subarray(0, remaining);
    remaining -= b.length;
    yield Buffer.from(b);
  }
}

/** Fetch a single message (re-fetches to refresh fileReference). */
export async function getMessage(userId, chatId, msgId) {
  const client = await getUserClient(userId);
  const msgs = await client.getMessages(Number(chatId), { ids: [Number(msgId)] });
  const msg = msgs?.[0];
  if (!msg || !msg.media) return null;
  const info = mediaInfo(msg);
  const loc = fileLocation(msg);
  if (!info || !loc) return null;
  return { client, info, loc };
}

/**
 * Create a new private Telegram channel for a category.
 * Returns { channelId, accessHash, title }.
 */
export async function createChannel(userId, title) {
  const client = await getUserClient(userId);
  const result = await client.invoke(
    new Api.channels.CreateChannel({
      title,
      about: `TGStore category: ${title}`,
      broadcast: true, // true = channel (not supergroup)
    })
  );
  const channel = result.chats?.[0];
  if (!channel) throw new Error('Failed to create channel');
    // Bot API uses -100<id> for channel chat_ids; MTProto returns the raw positive id
  const botChatId = `-100${channel.id}`;
  return {
    channelId: botChatId,
    accessHash: channel.accessHash ? String(channel.accessHash) : null,
    title: channel.title || title,
  };
}

/**
 * Upload media bytes to a Telegram channel.
 * Returns { messageId, fileId }.
 */
export async function uploadMediaToChannel(userId, channelId, buffer, filename, mime) {
  const client = await getUserClient(userId);
  const inputFile = await client.uploadFile({
    file: buffer,
    workers: 1,
  });
  const result = await client.invoke(
    new Api.messages.SendMedia({
      peer: Number(channelId),
      media: new Api.InputMediaUploadedPhoto({
        file: inputFile,
      }),
      message: '',
      randomId: bigInt(Date.now()),
    })
  );
  return { messageId: result.id, fileId: result.photo?.id?.toString() || null };
}

/**
 * Post a text message in a Telegram channel.
 * Returns { messageId }.
 */
export async function postTextMessage(userId, channelId, text) {
  const client = await getUserClient(userId);
  const result = await client.invoke(
    new Api.messages.SendMessage({
      peer: Number(channelId),
      message: text,
      randomId: bigInt(Date.now()),
    })
  );
  return { messageId: result.id };
}

/**
 * Get Saved Messages chat ID (the user's own "Saved Messages" chat).
 */
export async function getSavedMessagesId(userId) {
  const client = await getUserClient(userId);
  const me = await client.getMe();
  return String(me.id);
}

/**
 * Copy media from Saved Messages to a category channel.
 * Returns { messageId, fileId }.
 */
export async function copySavedMediaToChannel(userId, savedMsgId, channelId, caption) {
  const client = await getUserClient(userId);
  const me = await client.getMe();
  const result = await client.invoke(
    new Api.messages.ForwardMessages({
      fromPeer: me.id,
      id: [Number(savedMsgId)],
      toPeer: Number(channelId),
      randomId: [bigInt(Date.now())],
    })
  );
  const msg = Array.isArray(result) ? result[0] : result;
  return { messageId: msg?.id || 0, fileId: msg?.photo?.id?.toString() || msg?.document?.id?.toString() || null };
}
export async function inviteBotToChannel(userId, channelId, botUsername) {
  const client = await getUserClient(userId);
  const bot = await client.getEntity(botUsername);
  if (!bot) throw new Error(`Bot @${botUsername} not found`);
  await client.invoke(
    new Api.channels.InviteToChannel({
      channel: Number(channelId),
      users: [bot],
    })
  );
  // Promote bot to admin so it can post
  await client.invoke(
    new Api.channels.EditAdmin({
      channel: Number(channelId),
      userId: bot,
      adminRights: new Api.ChatAdminRights({
        postMessages: true,
        editMessages: true,
        deleteMessages: true,
        changeInfo: true,
      }),
      rank: 'bot',
    })
  );
  return true;
}


