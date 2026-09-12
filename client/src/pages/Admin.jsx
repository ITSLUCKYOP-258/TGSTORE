import { useEffect, useState } from 'react';
import { adminStats, adminUsers } from '../api.js';
import { formatBytes, formatDate } from '../lib/format.js';

const SESSION_KEY = 'tgstore_admin_key';

/**
 * Hidden admin dashboard — reachable ONLY by typing /admin in the URL.
 * No link or button anywhere in the app points here.
 * Access = the server's ADMIN_KEY (sent as x-admin-key on every call).
 * The key is kept in sessionStorage only (cleared when the browser closes).
 */
export default function Admin() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(SESSION_KEY) || '');
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem(SESSION_KEY));
  const [input, setInput] = useState('');
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async (key) => {
    setLoading(true);
    setError(null);
    try {
      const [s, u] = await Promise.all([adminStats(key), adminUsers(key)]);
      setStats(s);
      setUsers(u.users || []);
      setAuthed(true);
      setAdminKey(key);
      sessionStorage.setItem(SESSION_KEY, key);
    } catch (e) {
      setAuthed(false);
      sessionStorage.removeItem(SESSION_KEY);
      setError(
        /404/.test(e.message)
          ? 'Admin API is disabled on this server (ADMIN_KEY not set).'
          : 'Invalid admin key.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Auto-load on refresh when a session key exists
  useEffect(() => {
    const k = sessionStorage.getItem(SESSION_KEY);
    if (k) load(k);
  }, []);

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY);
    setAdminKey('');
    setInput('');
    setAuthed(false);
    setStats(null);
    setUsers([]);
  };

  /* ── login screen ── */
  if (!authed) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!loading && input) load(input.trim());
          }}
          className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl"
        >
          <div className="mb-1 text-center text-5xl">🛡️</div>
          <h1 className="text-center text-xl font-bold text-slate-800">Admin access</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            Enter the server admin key to view users and storage usage.
          </p>
          <input
            type="password"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Admin key"
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !input}
            className="mt-4 w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Sign in'}
          </button>
        </form>
      </div>
    );
  }

  /* ── dashboard ── */
  return (
    <div className="min-h-full bg-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">🛡️ Admin — Users &amp; Storage</h1>
            <p className="text-sm text-slate-500">Hidden dashboard — not linked anywhere in the app.</p>
          </div>
          <button
            onClick={logout}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>

        {loading && !stats ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
          </div>
        ) : stats ? (
          <>
            {/* stat cards */}
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {[
                { label: 'Users', value: stats.total_users ?? 0, icon: '👥' },
                { label: 'Telegram connected', value: stats.telegram_connected ?? 0, icon: '📨' },
                { label: 'Active 24h', value: stats.active_last_24h ?? 0, icon: '🟢' },
                { label: 'Files', value: stats.total_files ?? 0, icon: '🗂️' },
                { label: 'Storage used', value: formatBytes(stats.total_bytes ?? 0), icon: '💾' },
              ].map((c) => (
                <div key={c.label} className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{c.label}</p>
                  <p className="mt-1 truncate text-2xl font-bold text-slate-800">
                    <span className="mr-1 text-lg">{c.icon}</span>
                    {c.value}
                  </p>
                </div>
              ))}
            </div>

            {/* users table */}
            <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Telegram</th>
                    <th className="px-4 py-3 text-right">Files</th>
                    <th className="px-4 py-3 text-right">Storage</th>
                    <th className="px-4 py-3">Last login</th>
                    <th className="px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-400">#{u.id}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">
                        {[u.first_name, u.last_name].filter(Boolean).join(' ') || '—'}
                        {u.is_dev ? <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">DEV</span> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{u.username ? `@${u.username}` : '—'}</td>
                      <td className="px-4 py-3">
                        {u.telegram_connected ? (
                          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Connected</span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">{u.file_count ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">{formatBytes(u.storage_bytes ?? 0)}</td>
                      <td className="px-4 py-3 text-slate-500">{u.last_login ? formatDate(u.last_login) : 'never'}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-slate-400">No users yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
