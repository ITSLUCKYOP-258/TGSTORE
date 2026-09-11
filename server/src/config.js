/**
 * First-run configuration store.
 * Lets the owner set Telegram credentials from the web Setup Wizard
 * (server/config.json) instead of editing .env by hand.
 * config.json overrides .env values.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'config.json')
  : path.join(__dirname, '..', 'config.json');

const ALLOWED_KEYS = [
  'MT_API_ID',
  'MT_API_HASH',
  'BOT_TOKEN',
  'STORAGE_CHANNEL_ID',
  'BOT_USERNAME',
  'PUBLIC_BASE_URL',
];

/** Apply config.json on top of .env (called once at startup). */
export function loadFileConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    for (const k of ALLOWED_KEYS) {
      if (raw[k] != null && raw[k] !== '') process.env[k] = String(raw[k]);
    }
  } catch {
    /* no config file yet â€” .env only */
  }
}

export function readFileConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

/** Merge new values into config.json and apply them to process.env live (no restart needed). */
export function saveFileConfig(partial) {
  const next = { ...readFileConfig() };
  for (const k of ALLOWED_KEYS) {
    if (partial[k] !== undefined) next[k] = String(partial[k]).trim();
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2));
  for (const k of ALLOWED_KEYS) {
    if (next[k]) process.env[k] = next[k];
  }
  return next;
}
