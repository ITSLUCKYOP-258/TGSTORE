export default function MediaGrid({ media, onPreview, onDownload, onDelete, showSavedBadge }) {
  if (!media || media.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-5xl mb-3">📭</div>
        <p className="text-sm text-slate-500">No media found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {media.map((item, idx) => (
        <div
          key={item.id || idx}
          className="group relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer transition hover:border-indigo-300 hover:shadow-md"
          onClick={() => onPreview?.(item)}
        >
          {/* Icon fallback (always rendered underneath) */}
          <div className="w-full h-full flex items-center justify-center text-4xl">
            {gridIcon(item)}
          </div>
          {/* Real thumbnail on top — removes itself on load error to reveal the icon */}
          {item.thumbnail && (
            <img
              src={item.thumbnail}
              alt={item.name}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => e.currentTarget.remove()}
            />
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition">
            <div className="absolute bottom-0 left-0 right-0 p-2">
              <p className="text-xs text-white truncate">{item.name || 'Untitled'}</p>
              {item.size && <p className="text-[10px] text-white/70">{formatBytes(item.size)}</p>}
            </div>
          </div>
          
          {/* Actions */}
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
            {onDownload && (
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(item); }}
                className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-slate-700 hover:bg-white text-sm"
              >
                ⬇
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                className="h-7 w-7 rounded-full bg-white/90 flex items-center justify-center text-red-600 hover:bg-white text-sm"
              >
                🗑
              </button>
            )}
          </div>
          
          {/* Saved badge */}
          {showSavedBadge && (
            <div className="absolute top-2 left-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium text-white">
              Saved
            </div>
          )}
          
          {/* Video / audio indicator */}
          {(gridKind(item) === 'video' || gridKind(item) === 'audio') && (
            <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
              ▶ {gridKind(item) === 'audio' ? 'audio' : (item.duration || 'video')}
            </div>
          )}
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
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = gridExt(item.name);
  if (['mp4', 'm4v', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'].includes(ext)) return 'image';
  return 'other';
}

function gridIcon(item) {
  const k = gridKind(item);
  if (k === 'video') return '🎬';
  if (k === 'image') return '🖼';
  if (k === 'audio') return '🎵';
  return '📄';
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}