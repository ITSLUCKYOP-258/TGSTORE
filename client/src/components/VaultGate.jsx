import { useState } from 'react';
import { useVault } from '../hooks/useVault';

/**
 * First gate inside /app: asks the user for their vault passphrase.
 * - First run (no stored vault): the passphrase becomes the encryption key.
 * - Later runs: verifies the passphrase against the stored self-check.
 * Only after status === 'unlocked' are the children (Dashboard) rendered,
 * so uploads/previews always have a live key available.
 */
export default function VaultGate({ children }) {
  const vault = useVault();
  const [pass, setPass] = useState('');
  const busy = vault.status === 'unlocking';
  const unlocked = vault.status === 'unlocked';

  if (unlocked) return children;

  return (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy && pass) void vault.unlock(pass);
        }}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
      >
        <div className="mb-1 text-center text-5xl">🔐</div>
        <h1 className="text-center text-xl font-bold text-slate-800">Vault passphrase</h1>
        <p className="mt-2 text-center text-sm text-slate-500">
          {vault.hasStoredVault()
            ? 'Enter your passphrase to unlock and decrypt your files.'
            : 'First time here — create a passphrase. Files are encrypted in your browser with it; it never leaves this device.'}
        </p>
        <input
          type="password"
          autoFocus
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Passphrase"
          className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        />
        {vault.error && <p className="mt-2 text-sm font-medium text-red-600">{vault.error}</p>}
        <button
          type="submit"
          disabled={busy || !pass}
          className="mt-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {vault.hasStoredVault() ? (busy ? 'Unlocking…' : 'Unlock vault') : (busy ? 'Creating…' : 'Create vault')}
        </button>
      </form>
    </div>
  );
}