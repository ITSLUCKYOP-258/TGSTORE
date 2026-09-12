import { useEffect, useState } from 'react';
import { api, rawUrl } from '../api.js';
import { formatBytes, fileKind } from '../lib/format.js';
import { useVault } from '../hooks/useVault';
import { decryptToObjectUrl } from '../lib/vault.js';

export function ModalShell({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} rounded-2xl bg-white p-6 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NameForm({ label, initial, submitLabel, onSubmit, onClose }) {
  const [name, setName] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        try {
          await onSubmit(name.trim());
          onClose();
        } finally {
          setBusy(false);
        }
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={label}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          disabled={busy || !name.trim()}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

export const NewFolderModal = ({ parentId, categoryId, onClose, onCreated }) => (
  <ModalShell title="New folder" onClose={onClose}>
    <NameForm
      label="Folder name"
      submitLabel="Create"
      onClose={onClose}
      onSubmit={async (name) => {
        await api.post('/api/folders', { name, parentId, categoryId });
        onCreated();
      }}
    />
  </ModalShell>
);

export const RenameModal = ({ item, isFolder, onClose, onRenamed }) => (
  <ModalShell title={`Rename ${isFolder ? 'folder' : 'file'}`} onClose={onClose}>
    <NameForm
      label="New name"
      initial={item.name}
      submitLabel="Rename"
      onClose={onClose}
      onSubmit={async (name) => {
        if (isFolder) await api.patch(`/api/folders/${item.id}`, { name });
        else await api.patch(`/api/files/${item.id}`, { name });
        onRenamed();
      }}
    />
  </ModalShell>
);

export function MoveModal({ item, isFolder, onClose, onMoved }) {
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState(isFolder ? null : item.folder_id ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get('/api/folders/tree').then((d) => setFolders(d.folders)).catch(() => {});
  }, []);

  const inOwnSubtree = (f) => {
    if (!isFolder) return false;
    let cur = f.parentId;
    const seen = new Set();
    while (cur != null) {
      if (seen.has(cur)) return false;
      seen.add(cur);
      if (cur === item.id) return true;
      cur = folders.find((x) => x.id === cur)?.parentId ?? null;
    }
    return false;
  };

  const depthOf = (f) => {
    let depth = 0;
    let cur = f.parentId;
    const seen = new Set();
    while (cur != null && !seen.has(cur)) {
      seen.add(cur);
      depth++;
      cur = folders.find((x) => x.id === cur)?.parentId ?? null;
    }
    return depth;
  };

  return (
    <ModalShell title={`Move "${item.name}"`} onClose={onClose}>
      <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
        <button
          onClick={() => setSelected(null)}
          className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
            selected === null ? 'bg-indigo-50 font-semibold text-indigo-700' : 'hover:bg-slate-50'
          }`}
        >
          📁 My Drive (root)
        </button>
        {folders
          .filter((f) => !inOwnSubtree(f) && f.id !== item.id)
          .map((f) => (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                selected === f.id ? 'bg-indigo-50 font-semibold text-indigo-700' : 'hover:bg-slate-50'
              }`}
              style={{ paddingLeft: `${12 + depthOf(f) * 16}px` }}
            >
              📂 {f.name}
            </button>
          ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              if (isFolder) await api.patch(`/api/folders/${item.id}`, { parentId: selected });
              else await api.patch(`/api/files/${item.id}`, { folderId: selected });
              onMoved();
              onClose();
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? 'Moving…' : 'Move here'}
        </button>
      </div>
    </ModalShell>
  );
}

export function ShareModal({ file, onClose }) {
  const [share, setShare] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const d = await api.post('/api/shares', { fileId: file.id });
      setShare(d.share);
    } finally {
      setBusy(false);
    }
  };

  const link = share ? `${window.location.origin}/s/${share.token}` : '';

  return (
    <ModalShell title={`Share "${file.name}"`} onClose={onClose}>
      {share ? (
        <div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="w-full bg-transparent text-xs text-slate-600 outline-none"
            />
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Anyone with this link can view and download the file. Revoke it anytime from Shared
            links.
          </p>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500">
            Create a public link so anyone can view and download this file.
          </p>
          <button
            onClick={create}
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Creating link…' : 'Create public link'}
          </button>
        </div>
      )}
    </ModalShell>
  );
}

export function PreviewModal({ file, onClose }) {
  const kind = fileKind(file);
  const vault = useVault();
  const [decUrl, setDecUrl] = useState(null);

  // E2EE: resolve decrypted bytes for encrypted stored files
  useEffect(() => {
    setDecUrl(null);
    if (!file?.encrypted || !file?.id) return undefined;
    const key = vault.getKey();
    if (!key) return undefined;
    let active = true;
    decryptToObjectUrl(file, key)
      .then((h) => { if (active) setDecUrl(h); else h?.revoke?.(); })
      .catch(() => {});
    return () => { active = false; };
  }, [file?.id, file?.encrypted]);

  const src = decUrl?.url || rawUrl(file.id);
  const [text, setText] = useState(null);

  useEffect(() => {
    if (kind === 'text' || kind === 'code') {
      fetch(src, { credentials: 'include' })
        .then((r) => r.text())
        .then(setText)
        .catch(() => setText(null));
    }
  }, [src, kind]);

  return (
    <ModalShell title={file.name} onClose={onClose} wide>
      <div className="mb-3 flex items-center justify-between text-xs text-slate-400">
        <span>
          {file.mime} · {formatBytes(file.size)}
        </span>
        <a
          href={(file.encrypted && decUrl?.url) || `/api/files/${file.id}/download`}
          download={file.name}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          ⬇ Download
        </a>
      </div>
      <div className="flex max-h-[65vh] min-h-64 items-center justify-center overflow-hidden rounded-xl bg-slate-950/95">
        {kind === 'image' && (
          <img src={src} alt={file.name} className="max-h-[65vh] w-auto object-contain" />
        )}
        {kind === 'video' && <video src={src} controls className="max-h-[65vh] w-full" />}
        {kind === 'audio' && (
          <div className="w-full p-10">
            <div className="mb-6 text-center text-5xl">🎵</div>
            <audio src={src} controls className="w-full" />
          </div>
        )}
        {kind === 'pdf' && (
          <iframe src={src} title={file.name} className="h-[65vh] w-full rounded-xl bg-white" />
        )}
        {(kind === 'text' || kind === 'code') && (
          <pre className="max-h-[65vh] w-full overflow-auto p-6 text-left text-xs leading-relaxed text-emerald-200">
            {text ?? 'Loading…'}
          </pre>
        )}
        {!['image', 'video', 'audio', 'pdf', 'text', 'code'].includes(kind) && (
          <div className="p-16 text-center text-white">
            <div className="mb-3 text-5xl">📦</div>
            <p className="text-sm text-slate-300">No preview available for this file type.</p>
          </div>
        )}
      </div>
    </ModalShell>
  );
}



