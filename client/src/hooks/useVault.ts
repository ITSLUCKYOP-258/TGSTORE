/**
 * TGStore - Vault session management (useVault.ts)
 *
 * React context + hook that tracks vault STATE (locked / unlocking /
 * unlocked / error) while the AES key itself lives in a module-level
 * closure: NOT in React state (invisible to devtools re-render frames)
 * and NEVER in localStorage / cookies / sessionStorage. The CryptoKey
 * returned by crypto.subtle is non-exportable, so it cannot be copied
 * or serialized out of the session either.
 *
 * What we DO persist (public, safe):
 *   - the vault salt          -> localStorage  "tgstore_vault_salt"
 *   - PBKDF2 iteration count  -> localStorage  "tgstore_vault_iterations"
 *   - an encrypted self-check -> localStorage  "tgstore_vault_check"
 *         (lets unlock() detect a WRONG PASSPHRASE immediately,
 *          instead of failing only on first file decrypt)
 *
 * The passphrase is never stored anywhere.
 */
import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import {
  deriveKey,
  encryptString,
  decryptString,
  generateSalt,
  isVaultError,
  PBKDF2_ITERATIONS,
  MIN_PBKDF2_ITERATIONS,
  SALT_SIZE,
} from '../lib/crypto';

export type VaultStatus = 'locked' | 'unlocking' | 'unlocked' | 'error';

/* - module-level, memory-only key holder ------------------------------ */
// Deliberately NOT in state: keeps the key out of serialization paths.
let sessionKey: CryptoKey | null = null;

/* - storage keys (public values only) --------------------------------- */
const SALT_KEY = 'tgstore_vault_salt';
const ITER_KEY = 'tgstore_vault_iterations';
const CHECK_KEY = 'tgstore_vault_check';
const CHECK_PLAINTEXT = 'tgstore-vault-check-v1';

function base64UrlEncode(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.slice(i, i + CHUNK));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(encoded: string): Uint8Array<ArrayBuffer> {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** localStorage can throw in private/incognito modes - fail soft. */
function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable - vault still works for this session */
  }
}
/* - public API ---------------------------------------------------------- */

export interface VaultApi {
  /** Current vault state. */
  status: VaultStatus;
  /** Human-readable error when status === 'error', else null. */
  error: string | null;
  /**
   * Unlock (or create+unlock) the vault.
   * Returns true on success, false + status 'error' on wrong passphrase.
   */
  unlock: (passphrase: string) => Promise<boolean>;
  /** Lock the vault - drops the in-memory key reference. */
  lock: () => void;
  /** The live AES key, or null while locked. */
  getKey: () => CryptoKey | null;
  /** True when a vault (salt + self-check) already exists in storage. */
  hasStoredVault: () => boolean;
}

const DEFAULT_API: VaultApi = {
  status: 'locked',
  error: null,
  unlock: async () => false,
  lock: () => {},
  getKey: () => null,
  hasStoredVault: () => false,
};

const VaultContext = createContext<VaultApi>(DEFAULT_API);

/** Access the vault from any component under <VaultProvider>. */
export function useVault(): VaultApi {
  return useContext(VaultContext);
}

/* - provider ------------------------------------------------------------ */

/**
 * Mount once in App.jsx around the routes. All children can then call
 * useVault() to check status / unlock / lock / fetch the live key.
 */
export function VaultProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VaultStatus>('locked');
  const [error, setError] = useState<string | null>(null);

  const unlock = async (passphrase: string): Promise<boolean> => {
    setStatus('unlocking');
    setError(null);
    try {
      const storedSalt = lsGet(SALT_KEY);
      const salt = storedSalt ? base64UrlDecode(storedSalt) : generateSalt();

      const storedIters = lsGet(ITER_KEY);
      const iterations = storedIters ? Number(storedIters) : PBKDF2_ITERATIONS;
      if (Number.isNaN(iterations) || iterations < MIN_PBKDF2_ITERATIONS) {
        throw new Error(`Stored iteration count ${iterations} is unusable.`);
      }

      const key = await deriveKey(passphrase, salt, iterations);

      // First unlock: persist salt + iterations, write an encrypted
      // self-check. Later unlocks verify the passphrase via the check.
      const existingCheck = lsGet(CHECK_KEY);
      if (existingCheck) {
        let plaintext = '';
        try {
          plaintext = await decryptString(existingCheck, key);
        } catch (e) {
          if (isVaultError(e)) throw e;
          throw new Error('Failed to verify vault passphrase.');
        }
        if (plaintext !== CHECK_PLAINTEXT) {
          throw new Error('Vault self-check failed');
        }
      } else {
        if (salt.length !== SALT_SIZE) {
          throw new Error(`Salt must be ${SALT_SIZE} bytes.`);
        }
        lsSet(SALT_KEY, base64UrlEncode(salt));
        lsSet(ITER_KEY, String(iterations));
        lsSet(CHECK_KEY, await encryptString(CHECK_PLAINTEXT, key));
      }

      sessionKey = key;
      setStatus('unlocked');
      return true;
    } catch (e) {
      sessionKey = null;
      setStatus('error');
      if (isVaultError(e) && e.code === 'WRONG_PASSPHRASE') {
        setError('Incorrect vault passphrase.');
      } else {
        setError(e instanceof Error ? e.message : 'Vault unlock failed.');
      }
      return false;
    }
  };

  const lock = (): void => {
    sessionKey = null;
    setStatus('locked');
    setError(null);
  };

  const value: VaultApi = {
    status,
    error,
    unlock,
    lock,
    getKey: () => sessionKey,
    hasStoredVault: () => lsGet(SALT_KEY) !== null,
  };

  return createElement(VaultContext.Provider, { value }, children);
}
