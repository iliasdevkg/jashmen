// admin-api/uploads.js
//
// Media storage for the admin panel (lesson theory/media cards, partner
// logos, prize photos) — with a REAL production path, not just a promise
// of one. Two backends, chosen automatically:
//
//   - BLOB_READ_WRITE_TOKEN set  → Vercel Blob (public, CDN-backed URLs,
//     survives serverless/ephemeral deploys). Create a Blob store in the
//     Vercel dashboard (Storage → Blob) and copy its token into
//     admin-api/.env to turn this on — no code change needed.
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
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB — comfortably covers the PDF's "screencast up to 30s"
  fileFilter: (req, file, cb) => cb(null, ALLOWED_MIME.has(file.mimetype)),
});

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || null;
if (!BLOB_TOKEN) {
  console.warn(
    '[uploads] BLOB_READ_WRITE_TOKEN is not set — media saves to local disk\n' +
    '          (admin-api/data/uploads/), which does NOT survive a\n' +
    '          serverless/ephemeral deploy. Create a Blob store in the\n' +
    '          Vercel dashboard and set this in admin-api/.env before\n' +
    '          deploying the admin panel to production.'
  );
}

function safeExt(originalname) {
  return path.extname(originalname || '').slice(0, 10).replace(/[^a-zA-Z0-9.]/g, '');
}

export async function saveUploadedFile(file) {
  const filename = `${randomUUID()}${safeExt(file.originalname)}`;

  if (BLOB_TOKEN) {
    const blob = await put(filename, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
      token: BLOB_TOKEN,
    });
    return blob.url; // absolute, CDN-backed — works regardless of which deploy serves the page
  }

  await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
  return `/admin/api/uploads/${filename}`;
}
