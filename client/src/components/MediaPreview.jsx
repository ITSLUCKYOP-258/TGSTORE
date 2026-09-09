import { rawUrl } from '../api.js';

function previewExt(name) {
  return String(name || '').split('.').pop().toLowerCase();
}

/** Player type by MIME first, extension fallback (some uploads are stored as application/octet-stream). */
function previewKind(item) {
  const mime = item.mime || '';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = previewExt(item.name);
  if (['mp4', 'm4v', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'heic', 'heif'].includes(ext)) return 'image';
  return 'other';
}

function previewSrc(item) {
  if (item.url) return item.url;
  if (item.id != null) return rawUrl(item.id);
  return '';
}

/** Resolve a browser-usable MIME type from the stored MIME + filename.
 *  Mirrors server-side resolveMime — some uploads arrive with a generic
 *  `application/octet-stream` MIME; without a video/* or audio/* type the
 *  browser won't pick the right player (and the volume/sound controls vanish). */
const EXT_MIME = {
  // video
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  // audio
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg',
  opus: 'audio/opus', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac',
  // images
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
};
function resolveMime(name, mime) {
  if (mime && mime !== 'application/octet-stream') return mime;
  const ext = String(name || '').split('.').pop().toLowerCase();
  return EXT_MIME[ext] || mime || 'application/octet-stream';
}

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
          {previewKind(item) === 'video' ? (
            <video
              key={previewSrc(item)}
              controls
              preload="metadata"
              playsInline
              className="w-full max-h-[80vh] object-contain bg-black"
            >
              <source src={previewSrc(item)} type={resolveMime(item.name, item.mime)} />
            </video>
          ) : previewKind(item) === 'audio' ? (
            <div className="flex flex-col items-center justify-center px-8 py-16">
              <div className="text-6xl mb-4">🎵</div>
              <p className="text-base font-medium text-white mb-4 px-4 text-center">{item.name}</p>
              <audio
                key={previewSrc(item)}
                controls
                preload="metadata"
                className="w-full max-w-md"
              >
                <source src={previewSrc(item)} type={resolveMime(item.name, item.mime)} />
              </audio>
            </div>
          ) : previewKind(item) === 'image' ? (
            <img
              src={item.url || item.thumbnail || previewSrc(item)}
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
            {(previewKind(item) === 'video' || previewKind(item) === 'audio') && (
              <p className="text-xs text-white/60 mt-1">🔊 Sound plays in the player above — use its volume slider</p>
            )}
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