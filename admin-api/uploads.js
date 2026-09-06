// admin-api/uploads.js
//
// Media storage for the admin panel (lesson theory/media cards, partner
// logos, prize photos) — with a REAL production path, not just a promise
// of one. Two backends, chosen automatically:
//
//   - MEDIA_READ_WRITE_TOKEN (or BLOB_READ_WRITE_TOKEN as a fallback, for
//     simple single-store local dev setups) set → Vercel Blob, PUBLIC
//     access (these are meant to be publicly viewable — lesson images,
//     logos), CDN-backed URLs, survives serverless/ephemeral deploys.
//     Deliberately a SEPARATE token/store from db.js/contentStore.js's
//     BLOB_READ_WRITE_TOKEN — that one holds the private, non-public
//     user/content database and must never share a store (let alone a
//     token) with anything served publicly.
//   - unset (default, local dev) → admin-api/data/uploads/, same
//     gitignored runtime-data convention as db.json/content.json.
//
// Uploads are buffered in memory (25MB cap) so the same file can be routed
// to either backend without a disk round-trip either way.

import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, 'data', 'uploads');

// The gate multer applies to the CLIENT-declared type. It is a coarse first
// pass only — saveUploadedFile re-checks the actual bytes, which is what
// decides. HEIC is on the list deliberately even though no browser can paint
// it: letting it through to the byte check is what earns the operator the
// "convert it to JPEG" message instead of a blank "file not accepted".
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
  'image/heic', 'image/heif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — comfortably covers the PDF's "screencast up to 30s"
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
});

const BLOB_TOKEN = process.env.MEDIA_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN || null;

// Vercel's deployed filesystem is read-only outside /tmp — creating this
// directory unconditionally would crash every cold start once Blob is
// configured (the intended, actually-used path in production). Only touch
// disk when disk is actually where uploads are going.
if (!BLOB_TOKEN) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.warn(
    '[uploads] MEDIA_READ_WRITE_TOKEN is not set — media saves to local\n' +
    '          disk (admin-api/data/uploads/), which does NOT survive a\n' +
    '          serverless/ephemeral deploy. Create a Blob store in the\n' +
    '          Vercel dashboard and set this in admin-api/.env before\n' +
    '          deploying the admin panel to production.'
  );
}

// What the file actually is, read from its own first bytes rather than from
// the type the browser guessed off its extension.
//
// multer's fileFilter trusts `file.mimetype`, which the browser derives from
// the filename — so an MP3 renamed to `.jpeg` arrives declared as
// `image/jpeg`, is stored under `.jpeg`, and is then served as an image the
// browser cannot decode. The card renders blank with a 200 on the wire and
// nothing in the console: exactly the shape of bug that is impossible to
// diagnose from the admin panel. One real photo did this in production.
const MAGIC = [
  { mime: 'image/png',  ext: '.png',  bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/jpeg', ext: '.jpg',  bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/gif',  ext: '.gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
];

function startsWith(buf, bytes, offset = 0) {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/// The real type, or null when the bytes match nothing we can serve.
export function sniffMediaType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;

  for (const m of MAGIC) {
    if (startsWith(buf, m.bytes)) return { mime: m.mime, ext: m.ext };
  }

  // RIFF....WEBP — the four-byte size sits between the two markers.
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  // ISO base media (mp4 / mov): 'ftyp' at offset 4, then the brand.
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buf.subarray(8, 12).toString('latin1');
    // HEIC is an ISO container too, and no browser will paint it. Naming it
    // separately is what lets the admin say "convert it to JPEG" rather than
    // the useless "unsupported file".
    if (brand.startsWith('hei') || brand.startsWith('hev') || brand === 'mif1') {
      return { mime: 'image/heic', ext: '.heic', unsupported: true };
    }
    if (brand === 'qt  ') return { mime: 'video/quicktime', ext: '.mov' };
    return { mime: 'video/mp4', ext: '.mp4' };
  }

  // WebM / Matroska.
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: 'video/webm', ext: '.webm' };

  // SVG is text, so it has no magic number — look for its root element in
  // the opening bytes instead.
  const head = buf.subarray(0, 512).toString('latin1').toLowerCase();
  if (head.includes('<svg')) return { mime: 'image/svg+xml', ext: '.svg' };

  return null;
}

export async function saveUploadedFile(file) {
  const real = sniffMediaType(file.buffer);
  if (!real) {
    const err = new Error('Бул файл сүрөт же видео эмес. PNG, JPEG, WebP, GIF, MP4 же WebM жүктөңүз.');
    err.status = 400;
    throw err;
  }
  if (real.unsupported) {
    const err = new Error('HEIC сүрөттөрүн браузер ача албайт. iPhone\'да «Эң шайкеш» форматын тандаңыз же JPEG кылып сактаңыз.');
    err.status = 400;
    throw err;
  }

  // The sniffed extension and content-type, never the client's — that is the
  // whole point of looking.
  const filename = `${randomUUID()}${real.ext}`;

  if (BLOB_TOKEN) {
    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: real.mime,
      token: BLOB_TOKEN,
    });
    return blob.url; // absolute, CDN-backed — works regardless of which deploy serves the page
  }

  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
  return `/admin/api/uploads/${filename}`;
}
