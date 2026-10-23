/**
 * Client-side helpers that bridge the raw API + the vault crypto layer.
 * Handles: opaque (armored) metadata decryption for listings and
 * decrypt-then-download / decrypt-then-preview for stored files.
 */
import { rawUrl } from '../api.js';
import { decryptMetadata, decryptFile, isVaultError } from './crypto';

const EXT_MIME = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  aac: 'audio/aac',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
  txt: 'text/plain',
  json: 'application/json',
};

export function resolveMime(name, mime) {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = String(name || '').split('.').pop().toLowerCase();
  return EXT_MIME[ext] || mime || 'application/octet-stream';
}

/** True when a name/metadata string is an armored ciphertext ("TGS1:…"). */
export const isArmored = (s) => typeof s === 'string' && s.startsWith('TGS1:');

/**
 * Decrypt server-side metadata in-place for every file in a listing.
 * - Encrypted rows: `name`/`mime`/`size` become the REAL values and the row
 *   is flagged `encrypted: true` so preview/download know to decrypt bytes.
 * - Legacy/plaintext rows (or rows that fail auth) pass through unchanged.
 */
export async function withDecryptedMeta(files, key) {
  if (!Array.isArray(files)) return [];
  const out = [];
  for (const f of files) {
    if (isArmored(f?.name)) {
      if (key) {
        try {
          const m = await decryptMetadata(f.name, key);
          out.push({ ...f, name: m.name, mime: m.mime, size: m.size, encrypted: true });
          continue;
        } catch {
          // Wrong key or corrupted metadata — flag as encrypted so raw ciphertext is never treated as plaintext
          out.push({ ...f, name: 'Encrypted File', encrypted: true });
          continue;
        }
      }
      out.push({ ...f, name: 'Encrypted File', encrypted: true });
      continue;
    }
    out.push({ ...f, encrypted: false });
  }
  return out;
}

/**
 * Decrypt a stored file to a temporary object URL (for <img>/<video>/<a>…).
 * Returns an ObjectUrlHandle; call revoke() when the element is released.
 */
export async function decryptToObjectUrl(file, key) {
  if (!file?.id || !key) return null;
  let name = file.name || 'file';
  let mime = file.mime || 'application/octet-stream';

  if (isArmored(name)) {
    try {
      const m = await decryptMetadata(name, key);
      name = m.name || name;
      mime = m.mime || mime;
    } catch {}
  }

  const res = await fetch(rawUrl(file.id), { credentials: 'include' });
  if (!res.ok) return null;
  const cipher = await res.blob();
  const plain = await decryptFile(cipher, key);
  const finalMime = resolveMime(name, mime);
  const url = URL.createObjectURL(new Blob([plain], { type: finalMime }));
  return { url, name, mime: finalMime, revoke: () => URL.revokeObjectURL(url) };
}

/** Decrypt + download a stored file with the real filename. */
export async function downloadDecrypted(file, key) {
  if (file?._localUrl) {
    const a = document.createElement('a');
    a.href = file._localUrl;
    a.download = file.name || 'download';
    a.click();
    return true;
  }
  const handle = await decryptToObjectUrl(file, key);
  if (!handle) return false;
  const a = document.createElement('a');
  a.href = handle.url;
  a.download = handle.name || file.name || 'download';
  a.click();
  setTimeout(handle.revoke, 60_000); // allow the browser time to start the save
  return true;
}

export { isVaultError };
export { encryptFile, encryptMetadata } from './crypto';
