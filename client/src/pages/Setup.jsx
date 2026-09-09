import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const inputCls =
  'w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

export default function Setup() {
  const [status, setStatus] = useState(null);
  const [mtApiId, setMtApiId] = useState('');
  const [mtApiHash, setMtApiHash] = useState('');
  const [botToken, setBotToken] = useState('');
  const [storageChannelId, setStorageChannelId] = useState('');
  const [botUsername, setBotUsername] = useState('');
  const [publicBaseUrl, setPublicBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api
      .get('/api/setup/status')
      .then((s) => {
        setStatus(s);
        setBotUsername(s.botUsername);
        setPublicBaseUrl(s.publicBaseUrl);
      })
      .catch(() => setStatus({ needsSetup: true }));
  }, []);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const d = await api.post('/api/setup', {
        mtApiId,
        mtApiHash,
        botToken,
        storageChannelId,
        botUsername,
        publicBaseUrl,
      });
      setStatus(d);
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-100 py-10 px-4">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl text-white">
            ☁️
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">TGStore Setup</h1>
          <p className="mt-1 text-sm text-slate-500">
            One-time configuration. Fill this once — afterwards you (and anyone using your site)
            just log in with phone + Telegram code.
          </p>
        </div>

        {saved && (
          <div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-center">
            <p className="font-semibold text-emerald-700">✅ Saved — applied instantly, no restart needed</p>
            <Link
              to="/login"
              className="mt-2 inline-block rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Go to login →
            </Link>
          </div>
        )}

        {/* --- Telegram phone login --- */}
        <div className="mb-5 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xl">✈️</span>
            <h2 className="font-bold text-slate-900">Phone login (MTProto)</h2>
            {status?.mtConfigured && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                configured ✓
              </span>
            )}
          </div>
          <p className="mb-4 text-xs leading-relaxed text-slate-500">
            Every Telegram client needs its own <b>api_id</b> & <b>api_hash</b> — storage sites
            like the one you saw have them hidden inside their servers. You do this once:
          </p>
          <ol className="mb-4 list-decimal space-y-1 rounded-xl bg-slate-50 p-4 pl-9 text-xs text-slate-600">
            <li>
              Open{' '}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">
                my.telegram.org
              </a>{' '}
              and log in with your phone
            </li>
            <li>Telegram sends a confirmation code in your app — enter it on the site</li>
            <li>
              Click <b>API development tools</b>
            </li>
            <li>
              Fill <i>App title</i> (e.g. <code>mydrive</code>) and <i>Short name</i>, hit{' '}
              <b>Create</b>
            </li>
            <li>
              Copy the shown <b>app api_id</b> and <b>api_hash</b> below
            </li>
          </ol>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">App api_id</label>
              <input value={mtApiId} onChange={(e) => setMtApiId(e.target.value)} placeholder="1234567" className={inputCls} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">App api_hash</label>
              <input
                value={mtApiHash}
                onChange={(e) => setMtApiHash(e.target.value)}
                placeholder="0123456789abcdef0123456789abcdef"
                className={inputCls}
              />
            </div>
          </div>
        </div>

        {/* --- Optional bot storage --- */}
        <div className="mb-5 rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xl">🤖</span>
            <h2 className="font-bold text-slate-900">
              Bot storage <span className="text-xs font-normal text-slate-400">(optional — for the upload drive)</span>
            </h2>
            {status?.botConfigured && (
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                configured ✓
              </span>
            )}
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Skip this if you only want to browse files already in your Telegram. To upload new
            files into your own private channel: create a bot with <b>@BotFather</b>, add it as
            admin of a private channel, and fill in the details below.
          </p>
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Bot token (from @BotFather)</label>
              <input value={botToken} onChange={(e) => setBotToken(e.target.value)} placeholder="123456:ABC-..." className={inputCls} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Storage channel id</label>
                <input
                  value={storageChannelId}
                  onChange={(e) => setStorageChannelId(e.target.value)}
                  placeholder="-1001234567890"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Bot username (no @)</label>
                <input value={botUsername} onChange={(e) => setBotUsername(e.target.value)} placeholder="mydrive_bot" className={inputCls} />
              </div>
            </div>
          </div>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between">
          <Link to="/login" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to login
          </Link>
          <button
            onClick={save}
            disabled={busy || (!mtApiId && !botToken)}
            className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save configuration'}
          </button>
        </div>

      </div>
    </div>
  );
}
