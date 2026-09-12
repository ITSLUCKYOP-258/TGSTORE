import { useEffect, useState } from 'react';
import { api, saveToken } from '../api.js';

/**
 * Telegram phone-number login: phone -> OTP code (sent inside Telegram) ->
 * optional 2FA password. Calls onConnected(user) when done.
 */
export default function TelegramPhoneLogin({ onConnected }) {
  const [enabled, setEnabled] = useState(null);
  const [step, setStep] = useState('phone'); // phone | code | password
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [flowId, setFlowId] = useState(null);
  const [viaApp, setViaApp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/api/mt/config').then((c) => setEnabled(c.enabled)).catch(() => setEnabled(false));
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (enabled === false) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
        Phone login is disabled. Ask the server owner to set <b>MT_API_ID</b> &amp;{' '}
        <b>MT_API_HASH</b> environment variables on the server (from{' '}
        <b>my.telegram.org → API development tools</b>) — after that, logging in is just phone
        number + code.
      </div>
    );
  }
  if (enabled === null) return null;

  return (
    <div className="rounded-2xl border border-slate-200 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">✈️</span>
        <h3 className="font-bold text-slate-800">Log in with your Telegram account</h3>
      </div>

      {step === 'phone' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const d = await api.post('/api/mt/send-code', { phone });
              setFlowId(d.flowId);
              setViaApp(!!d.isCodeViaApp);
              setStep('code');
            });
          }}
        >
          <label className="mb-1 block text-xs font-medium text-slate-500">
            Phone number (international format)
          </label>
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+911234567890"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? 'Sending code…' : 'Send code via Telegram'}
          </button>
        </form>
      )}

      {step === 'code' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const d = await api.post('/api/mt/verify-code', { flowId, code });
              if (d.needPassword) {
                setStep('password');
              } else {
                saveToken(d.token);
                onConnected(d.user);
              }
            });
          }}
        >
          <p className="mb-2 text-xs text-slate-500">
            We sent you a 5-digit code {viaApp ? 'in your Telegram app' : 'via Telegram'}. Enter it below.
          </p>
          <input
            required
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="12345"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-center text-lg tracking-[0.4em] outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? 'Verifying…' : 'Verify code'}
          </button>
        </form>
      )}

      {step === 'password' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const d = await api.post('/api/mt/verify-password', { flowId, password });
              saveToken(d.token);
              onConnected(d.user);
            });
          }}
        >
          <p className="mb-2 text-xs text-slate-500">
            Your account has two-step verification. Enter your Telegram cloud password.
          </p>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Cloud password"
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-base outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <button
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      )}

      {step !== 'phone' && (
        <button
          onClick={() => {
            setStep('phone');
            setCode('');
            setPassword('');
          }}
          className="mt-3 text-xs text-slate-400 hover:text-slate-600"
        >
          ← Use a different number
        </button>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
