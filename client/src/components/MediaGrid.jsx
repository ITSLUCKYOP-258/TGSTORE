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
          {item.thumbnail ? (
            <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              {item.mime?.startsWith('video') ? '🎬' : item.mime?.startsWith('image') ? '🖼' : '📄'}
            </div>
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
          
          {/* Video indicator */}
          {item.mime?.startsWith('video') && (
            <div className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
              ▶ {item.duration || ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}