import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { attachUser } from './auth.js';
import { loadFileConfig } from './config.js';
import authRoutes from './routes/auth.js';
import setupRoutes from './routes/setup.js';
import categoriesRoutes from './routes/categories.js';
import foldersRoutes from './routes/folders.js';
import driveRoutes from './routes/drive.js';
import filesRoutes from './routes/files.js';
import sharesRoutes from './routes/shares.js';
import mtRoutes from './routes/mt.js';
import { healthCheck, getChunkSize } from './telegram.js';
import { isConfigured as mtConfigured } from './mtproto.js';

// config.json (Setup Wizard) overrides .env — apply before anything reads env
loadFileConfig();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(attachUser);

// Debug: log all requests
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  next();
});

app.get('/api/health', async (_req, res) => {
  const configured =
    Boolean(process.env.BOT_TOKEN) && Boolean(process.env.STORAGE_CHANNEL_ID);
  if (!configured) {
    return res.json({
      ok: false,
      configured,
      chunkSize: getChunkSize(),
      message: 'Set BOT_TOKEN and STORAGE_CHANNEL_ID in server/.env',
    });
  }
  try {
    const info = await healthCheck();
    res.json({ ok: info.ok, configured, chunkSize: getChunkSize(), ...info });
  } catch (err) {
    res.json({ ok: false, configured, error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/drive', driveRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/shares', sharesRoutes);
app.use('/api/mt', mtRoutes);

// Debug: test route directly on app
app.get('/api/mt/direct-test', (_req, res) => {
  console.log('[DEBUG] /api/mt/direct-test hit');
  res.json({ ok: true, message: 'Direct test works' });
});

// Serve the built frontend in production
const distDir = path.join(__dirname, '..', '..', 'client', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const port = Number(process.env.PORT || 8787);

// A stray async error should never take the whole server down.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason?.stack || reason);
});

app.listen(port, () => {
  console.log(`\n  TGStore server running  ->  http://localhost:${port}`);
  console.log(`  Chunk size: ${(getChunkSize() / 1024 / 1024).toFixed(0)} MB (Bot API limits)`);
  console.log(
    `  Telegram storage: ${process.env.BOT_TOKEN ? 'bot token set' : 'BOT_TOKEN MISSING'} | ${
      process.env.STORAGE_CHANNEL_ID ? 'channel set' : 'STORAGE_CHANNEL_ID MISSING'
    }`
  );
  console.log(
    `  Dev login: ${process.env.DEV_LOGIN === 'true' ? 'enabled (http://localhost:8787/api/auth/dev)' : 'disabled'}\n`
  );
});
