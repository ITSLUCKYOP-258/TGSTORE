import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getFilePath, fileDownloadUrl } from './telegram.js';

/** Yield the file's bytes across all Telegram chunks, optionally a byte range. */
export async function* telegramFileBytes(chunks, { start = 0, end = Infinity } = {}) {
  let offset = 0; // absolute offset where the current chunk begins
  for (const c of chunks) {
    const chunkEnd = offset + c.size - 1;
    const from = Math.max(start, offset);
    const to = Math.min(end, chunkEnd);
    if (from <= to && end >= offset && start <= chunkEnd) {
      const fp = await getFilePath(c.tg_file_id);
      const upstream = await fetch(fileDownloadUrl(fp));
      if (!upstream.ok) throw new Error(`Telegram file fetch failed: ${upstream.status}`);
      const nodeStream = Readable.fromWeb(upstream.body);
      let skip = from - offset;
      let remaining = to - from + 1;
      for await (const buf of nodeStream) {
        if (remaining <= 0) break;
        let b = buf;
        if (skip > 0) {
          if (skip >= buf.length) {
            skip -= buf.length;
            continue;
          }
          b = buf.subarray(skip);
          skip = 0;
        }
        if (b.length > remaining) b = b.subarray(0, remaining);
        remaining -= b.length;
        yield b;
      }
    }
    offset = chunkEnd + 1;
    if (offset > end) break;
  }
}

/**
 * Stream a file (given as DB chunk rows + metadata) to the HTTP response,
 * with full HTTP Range support (needed for video seeking).
 */
export function serveFileStream(chunks, file, req, res, { asAttachment }) {
  const size = file.size;
  const baseHeaders = {
    'Content-Type': file.mime || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Content-Disposition': `${asAttachment ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
    'Cache-Control': 'private, max-age=3600',
  };
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
  if (m) {
    let start = m[1] === '' ? null : Number(m[1]);
    let end = m[2] === '' ? null : Number(m[2]);
    if (start == null) {
      start = Math.max(0, size - (end ?? 0));
      end = size - 1;
    } else if (end == null || end >= size) {
      end = size - 1;
    }
    if (start > end || start >= size) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': end - start + 1,
    });
    if (req.method === 'HEAD') return res.end();
    return pipeline(Readable.from(telegramFileBytes(chunks, { start, end })), res).catch((err) => {
      if (!res.writableEnded) console.error('stream error:', err.message);
      res.end();
    });
  }
  res.writeHead(200, { ...baseHeaders, 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  return pipeline(Readable.from(telegramFileBytes(chunks)), res).catch((err) => {
    if (!res.writableEnded) console.error('stream error:', err.message);
    res.end();
  });
}
