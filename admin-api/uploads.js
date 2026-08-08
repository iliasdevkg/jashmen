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

const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif',
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
