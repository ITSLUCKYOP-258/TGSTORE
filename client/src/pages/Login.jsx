import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, saveToken } from '../api.js';
import { useAuth } from '../App.jsx';
import TelegramPhoneLogin from '../components/TelegramPhoneLogin.jsx';

export default function Login() {
  const { setUser } = useAuth();
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/auth/config').then(setConfig).catch(() => setConfig({}));
  }, []);

  // Global callback for the Telegram Login Widget
  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      try {
        setBusy(true);
        const data = await api.post('/api/auth/telegram', user);
        saveToken(data.token);
        setUser(data.user);
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    };
  }, [setUser]);

  const devLogin = async () => {
    try {
      setBusy(true);
      const data = await api.post('/api/auth/dev', { name: 'Dev User' });
      saveToken(data.token);
      setUser(data.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const telegramWidget = config?.telegramLoginEnabled && (
    <div className="flex justify-center">
      <script
        src="https://telegram.org/js/telegram-widget.js?22"
        data-telegram-login={config.botUsername}
        data-size="large"
        data-userpic="true"
        data-radius="12"
        data-onauth="onTelegramAuth(user)"
        data-request-access="write"
        async
      />
    </div>
  );

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Left hero — shorter on mobile so the login card stays on screen */}
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 px-8 py-8 text-white sm:py-12 lg:px-16 lg:py-16">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="relative mx-auto w-full max-w-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
              ☁️
            </div>
            <span className="text-2xl font-bold tracking-tight">TGStore</span>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            Unlimited cloud storage, powered by Telegram.
          </h1>
          <p className="mt-4 text-base text-indigo-100 sm:mt-5 sm:text-lg">
            Your files are chunked and stored safely on Telegram's infrastructure — no storage
            caps, no metering. A clean drive interface on top: folders, previews, sharing and
            search.
          </p>
          {/* Feature chips — hidden on xs so they don't push the login card off screen */}
          <ul className="mt-8 hidden gap-4 text-sm text-indigo-100 sm:grid sm:grid-cols-2">
            {[
              ['♾️', 'Unlimited storage'],
              ['⚡', 'Fast chunked uploads'],
              ['🔒', 'Private by default'],
              ['🔗', 'One-click share links'],
              ['👁️', 'Instant media previews'],
              ['🗑️', 'Trash & restore'],
            ].map(([emoji, label]) => (
              <li key={label} className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
                <span className="text-lg">{emoji}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right: login card */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 lg:py-16">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
          <p className="mt-2 text-sm text-slate-500">
            Use your Telegram account to access your drive.
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <TelegramPhoneLogin onConnected={(u) => setUser(u)} />

            {telegramWidget}
            {config?.telegramLoginEnabled === false && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
                Telegram login isn't configured on this server. Set <code>BOT_TOKEN</code>,{' '}
                <code>BOT_USERNAME</code> and <code>PUBLIC_BASE_URL</code> in{' '}
                <code>server/.env</code> to enable the Telegram Login Widget — or use dev login
                below for local development.
              </div>
            )}

            <Link
              to="/setup"
              className="text-center text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              ⚙ Server owner? Run the one-time Setup Wizard
            </Link>

            {config?.devLoginEnabled && (
              <button
                onClick={devLogin}
                disabled={busy}
                className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {busy ? 'Signing in…' : 'Continue with Dev Login (local)'}
              </button>
            )}

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <p className="mt-8 text-xs leading-relaxed text-slate-400">
            By continuing you agree that files you upload are stored in the bot's private Telegram
            storage channel associated with this deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
