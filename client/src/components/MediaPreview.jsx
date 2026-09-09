export default function MediaPreview({ item, onClose }) {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] w-full mx-4" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm"
        >
          ✕ Close
        </button>
        
        {/* Media content */}
        <div className="bg-black rounded-2xl overflow-hidden">
          {item.mime?.startsWith('video') ? (
            <video
              src={item.url || `/api/files/${item.id}/raw`}
              controls
              autoPlay
              className="w-full max-h-[80vh] object-contain"
            />
          ) : item.mime?.startsWith('image') ? (
            <img
              src={item.url || item.thumbnail || `/api/files/${item.id}/raw`}
              alt={item.name}
              className="w-full max-h-[80vh] object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-white">
              <div className="text-6xl mb-4">📄</div>
              <p className="text-lg">{item.name}</p>
              <p className="text-sm text-white/60 mt-1">{item.mime}</p>
            </div>
          )}
        </div>
        
        {/* Info bar */}
        <div className="flex items-center justify-between mt-3 px-2">
          <div>
            <p className="text-sm font-medium text-white">{item.name}</p>
            {item.size && <p className="text-xs text-white/60">{formatBytes(item.size)}</p>}
          </div>
          <a
            href={item.downloadUrl || `/api/files/${item.id}/download`}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20"
          >
            Download
          </a>
        </div>
      </div>
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