export default function MediaGrid({ media, onPreview, onDownload, onDelete, showSavedBadge }) {
  if (!media || media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-3 text-5xl">📭</div>
        <p className="text-sm text-slate-500">No media found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {media.map((item, idx) => (
        <div
          key={item.id || idx}
          className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 transition hover:border-indigo-300 hover:shadow-md"
          onClick={() => onPreview?.(item)}
        >
          {/* Icon fallback (always rendered underneath) */}
          <div className="flex h-full w-full items-center justify-center text-4xl">
            {gridIcon(item)}
          </div>

          {/* Real thumbnail on top — removes itself on load error to reveal the icon */}
          {item.thumbnail && (
            <img
              src={item.thumbnail}
              alt={item.name}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => e.currentTarget.remove()}
            />
          )}

          {/* Overlay: always visible on mobile, hover-reveal on md+ */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition md:opacity-0 md:group-hover:opacity-100">
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="truncate text-xs text-white">{item.name || 'Untitled'}</p>
              {item.size && <p className="text-[10px] text-white/70">{formatBytes(item.size)}</p>}
            </div>
          </div>

          {/* Actions: always visible on mobile, hover-reveal on md+ */}
          <div className="absolute right-2 top-2 flex gap-1 transition md:opacity-0 md:group-hover:opacity-100">
            {onDownload && (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 hover:bg-white"
                aria-label="Download"
              >
                ⬇
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-red-600 hover:bg-white"
                aria-label="Delete"
              >
                🗑
              </button>
            )}
          </div>

          {/* Saved badge */}
          {showSavedBadge && (
            <div className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
              Saved
            </div>
          )}

          {/* File type badge */}
          {(() => {
            const k = gridKind(item);
            if (k === 'video') return <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">▶ {item.duration || 'video'}</div>;
            if (k === 'audio') return <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">▶ audio</div>;
            if (k === 'pdf') return <div className="absolute bottom-2 left-2 rounded bg-red-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white">PDF</div>;
            if (k === 'code') return <div className="absolute bottom-2 left-2 rounded bg-indigo-600/80 px-1.5 py-0.5 text-[10px] font-mono text-white">{gridExt(item.name).toUpperCase()}</div>;
            if (k === 'text') return <div className="absolute bottom-2 left-2 rounded bg-slate-600/80 px-1.5 py-0.5 text-[10px] text-white">TXT</div>;
            if (k === 'archive') return <div className="absolute bottom-2 left-2 rounded bg-amber-600/80 px-1.5 py-0.5 text-[10px] text-white">ZIP</div>;
            if (k === 'doc') return <div className="absolute bottom-2 left-2 rounded bg-blue-600/80 px-1.5 py-0.5 text-[10px] text-white">DOC</div>;
            if (k === 'sheet') return <div className="absolute bottom-2 left-2 rounded bg-green-600/80 px-1.5 py-0.5 text-[10px] text-white">XLS</div>;
            return null;
          })()}
        </div>
      ))}
    </div>
  );
}

function gridExt(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

/** Tile type by MIME first, extension fallback (some uploads are stored as application/octet-stream). */
function gridKind(item) {
  const mime = item.mime || '';
  const ext = gridExt(item.name);

  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (['doc','docx'].includes(ext)) return 'doc';
  if (['xls','xlsx'].includes(ext)) return 'sheet';
  if (['ppt','pptx'].includes(ext)) return 'sheet';
  if (['zip','rar','7z','tar','gz','bz2'].includes(ext)) return 'archive';

  const codeExts = ['js','mjs','cjs','ts','tsx','jsx','py','rb','php','java','c','cpp','h','hpp','cs','go','rs','sh','bash','zsh','sql','graphql','vue','svelte','dart','swift','kt','r','lua','json','xml','html','htm','css','yaml','yml','toml'];
  if (codeExts.includes(ext)) return 'code';

  const textExts = ['txt','md','markdown','csv','log','ini','cfg','conf','env'];
  if (mime.startsWith('text/') || textExts.includes(ext)) return 'text';

  if (['mp4','m4v','webm','mov','mkv','avi'].includes(ext)) return 'video';
  if (['mp3','wav','ogg','oga','m4a','flac','aac','opus'].includes(ext)) return 'audio';
  if (['jpg','jpeg','png','gif','webp','bmp','svg','heic','heif'].includes(ext)) return 'image';
  return 'other';
}

function gridIcon(item) {
  const k = gridKind(item);
  if (k === 'video') return '🎬';
  if (k === 'image') return '🖼';
  if (k === 'audio') return '🎵';
  if (k === 'pdf') return '📕';
  if (k === 'text') return '📄';
  if (k === 'code') return '💻';
  if (k === 'archive') return '🗜️';
  if (k === 'doc') return '📝';
  if (k === 'sheet') return '📊';
  return '📄';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}