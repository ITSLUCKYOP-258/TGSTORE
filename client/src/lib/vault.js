/**
 * Client-side helpers that bridge the raw API + the vault crypto layer.
 * Handles: opaque (armored) metadata decryption for listings and
 * decrypt-then-download / decrypt-then-preview for stored files.
 */
import { rawUrl } from '../api.js';
import { decryptMetadata, decryptFile, isVaultError } from './crypto';

/** True when a name/metadata string is an armored ciphertext ("TGS1:…"). */
export const isArmored = (s) => typeof s === 'string' && s.startsWith('TGS1:');

/**
 * Decrypt server-side metadata in-place for every file in a listing.
 * - Encrypted rows: `name`/`mime`/`size` become the REAL values and the row
 *   is flagged `encrypted: true` so preview/download know to decrypt bytes.
 * - Legacy/plaintext rows (or rows that fail auth) pass through unchanged.
 */
export async function withDecryptedMeta(files, key) {
  if (!key || !Array.isArray(files)) return files;
  const out = [];
  for (const f of files) {
    if (isArmored(f?.name)) {
      try {
        const m = await decryptMetadata(f.name, key);
        out.push({ ...f, name: m.name, mime: m.mime, size: m.size, encrypted: true });
        continue;
      } catch {
        // Wrong key / corrupt entry — show the row as-is (armored name).
      }
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
  const res = await fetch(rawUrl(file.id), { credentials: 'include' });
  if (!res.ok) return null;
  const cipher = await res.blob();
  const plain = await decryptFile(cipher, key);
  const url = URL.createObjectURL(new Blob([plain], { type: file.mime || 'application/octet-stream' }));
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

/** Decrypt + download a stored file with the real filename. */
export async function downloadDecrypted(file, key) {
  const handle = await decryptToObjectUrl(file, key);
  if (!handle) return false;
  const a = document.createElement('a');
  a.href = handle.url;
  a.download = file.name || 'download';
  a.click();
  setTimeout(handle.revoke, 60_000); // allow the browser time to start the save
  return true;
}

export { isVaultError };