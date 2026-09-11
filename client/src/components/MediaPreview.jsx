import { useState, useEffect } from 'react';
import { rawUrl } from '../api.js';

function previewExt(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

/** Classify what kind of preview to show */
function previewKind(item) {
  const mime = item.mime || '';
  const ext = previewExt(item.name);

  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';

  const textExts = [
    'txt','md','markdown','csv','log','ini','cfg','conf','env','toml','yaml','yml',
    'xml','html','htm','css','json','js','mjs','cjs','ts','tsx','jsx',
    'py','rb','php','java','c','cpp','h','hpp','cs','go','rs',
    'sh','bash','zsh','sql','graphql','vue','svelte','dart','swift','kt','r','lua',
  ];
  if (mime.startsWith('text/') || textExts.includes(ext)) return 'text';

  if (['mp4','m4v','webm','mov','mkv','avi'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','oga','m4a','flac','aac','opus'].includes(ext)) return 'audio';
  if (['jpg','jpeg','png','gif','webp','bmp','svg','heic','heif'].includes(ext)) return 'image';
  return 'other';
}

function previewSrc(item) {
  if (item.url) return item.url;
  if (item.id != null) return rawUrl(item.id);
  return '';
}

const EXT_MIME = {
  mp4:'video/mp4', m4v:'video/mp4', webm:'video/webm', mov:'video/quicktime',
  mkv:'video/x-matroska', avi:'video/x-msvideo',
  mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', oga:'audio/ogg',
  opus:'audio/opus', m4a:'audio/mp4', flac:'audio/flac', aac:'audio/aac',
  jpg:'image/jpeg', jpeg:'image/jpeg', png:'image/png', gif:'image/gif',
  webp:'image/webp', bmp:'image/bmp', svg:'image/svg+xml',
};
function resolveMime(name, mime) {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = String(name || '').split('.').pop().toLowerCase();
  return EXT_MIME[ext] || mime || 'application/octet-stream';
}

function fileIcon(item) {
  const ext = previewExt(item.name);
  if (ext === 'pdf') return '📕';
  if (['doc','docx'].includes(ext)) return '📝';
  if (['xls','xlsx'].includes(ext)) return '📊';
  if (['ppt','pptx'].includes(ext)) return '📊';
  if (['zip','rar','7z','tar','gz','bz2'].includes(ext)) return '🗜️';
  if (['exe','dmg','apk','msi'].includes(ext)) return '⚙️';
  if (['ttf','otf','woff','woff2'].includes(ext)) return '🔤';
  return '📄';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B','KB','MB','GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}


/** Text / code viewer with line numbers + copy */
function TextViewer({ src, name }) {
  const [content, setContent] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setContent(null); setError(null);
    fetch(src, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(`${r.status} ${r.statusText}`); return r.text(); })
      .then(setContent)
      .catch((e) => setError(e.message));
  }, [src]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center py-16 text-white/70">
      <div className="text-4xl mb-3">⚠️</div>
      <p className="text-sm">Could not load: {error}</p>
    </div>
  );
  if (content === null) return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white/80" />
    </div>
  );

  const lines = content.split('\n');
  return (
    <div className="flex flex-col" style={{ maxHeight: '68dvh' }}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-white/10 rounded-t-xl">
        <span className="text-xs font-mono text-slate-400">
          {name} · {lines.length} lines · {(content.length / 1024).toFixed(1)} KB
        </span>
        <button
          onClick={handleCopy}
          className="text-xs px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition"
        >{copied ? '✓ Copied' : '⎘ Copy'}</button>
      </div>
      <div className="overflow-auto flex-1 bg-slate-900 rounded-b-xl">
        <table className="w-full text-xs font-mono leading-5 border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-white/5">
                <td className="select-none text-right text-slate-600 pl-3 pr-2 py-0 w-10 sticky left-0 bg-slate-900 border-r border-white/5">{i + 1}</td>
                <td className="px-4 py-0 text-slate-200 whitespace-pre">{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** PDF viewer — native browser rendering via iframe */
function PdfViewer({ src }) {
  return (
    <div className="w-full rounded-xl overflow-hidden bg-slate-800" style={{ height: '70dvh' }}>
      <iframe
        src={`${src}#toolbar=1&navpanes=0`}
        title="PDF Preview"
        className="w-full h-full border-0"
        allow="fullscreen"
      />
    </div>
  );
}

export default function MediaPreview({ item, onClose }) {
  if (!item) return null;
  const kind = previewKind(item);
  const src = previewSrc(item);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 sm:items-center" onClick={onClose}>
      <div
        className="relative w-full max-w-4xl mx-2 sm:mx-4 flex flex-col"
        style={{ maxHeight: '95dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-11 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 hover:text-white z-10"
          aria-label="Close preview"
        >✕</button>

        <div className="rounded-2xl overflow-hidden bg-slate-900 shadow-2xl">
          {kind === 'video' && (
            <video key={src} controls preload="metadata" playsInline
              className="w-full object-contain bg-black" style={{ maxHeight: '70dvh' }}>
              <source src={src} type={resolveMime(item.name, item.mime)} />
            </video>
          )}
          {kind === 'audio' && (
            <div className="flex flex-col items-center justify-center px-8 py-12">
              <div className="mb-4 text-6xl">🎵</div>
              <p className="mb-5 px-4 text-center text-base font-medium text-white">{item.name}</p>
              <audio key={src} controls preload="metadata" className="w-full max-w-md">
                <source src={src} type={resolveMime(item.name, item.mime)} />
              </audio>
            </div>
          )}
          {kind === 'image' && (
            <img src={item.url || item.thumbnail || src} alt={item.name}
              className="w-full object-contain bg-black" style={{ maxHeight: '70dvh' }} />
          )}
          {kind === 'pdf' && <PdfViewer src={src} />}
          {kind === 'text' && <TextViewer src={src} name={item.name} />}
          {kind === 'other' && (
            <div className="flex flex-col items-center justify-center py-16 text-white">
              <div className="mb-4 text-7xl">{fileIcon(item)}</div>
              <p className="text-lg font-medium">{item.name}</p>
              {item.mime && <p className="mt-1 text-sm text-white/50">{item.mime}</p>}
              {item.size && <p className="mt-1 text-xs text-white/40">{formatBytes(item.size)}</p>}
              <p className="mt-4 text-sm text-white/40">No preview available — download to open</p>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1 pb-safe">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">{item.name}</p>
            {item.size && <p className="text-xs text-white/60">{formatBytes(item.size)}</p>}
            {(kind === 'video' || kind === 'audio') && (
              <p className="mt-0.5 text-xs text-white/50">🔊 Use the player's volume slider</p>
            )}
          </div>
          <a
            href={item.downloadUrl || `/api/files/${item.id}/download`}
            download={item.name}
            className="min-h-11 flex-shrink-0 rounded-lg bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20 transition"
          >⬇ Download</a>
        </div>
      </div>
    </div>
  );
}
