// admin-api/server.js — JashMen backend entrypoint.
//
// Serves everything under /admin/api. In dev, vite.config.js proxies
// /admin/api/* to http://localhost:PORT unchanged; in prod, vercel.json
// rewrites the same path to the deployed API. Either way this process only
// ever needs to know about the /admin/api prefix.
//
// Dual-mode on purpose: `npm run server` runs this as a normal long-lived
// Node process (app.listen()) for local dev / a non-serverless host. On
// Vercel, `process.env.VERCEL` is set automatically — api/index.js imports
// the default export below and Vercel's Node runtime calls it directly as
// a request handler per invocation, so app.listen() is skipped there (a
// serverless function doesn't own a persistent port to listen on).

import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import routes from './routes.js';
import adminRoutes from './adminRoutes.js';
import cronRoutes from './cronRoutes.js';
import { UPLOADS_DIR } from './uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3030;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
// Reads the httpOnly refresh-token cookie into req.cookies for
// /u/refresh, /u/logout, and their admin equivalents (auth.js/adminAuth.js
// — Task 2's JWT-storage migration). No secret needed: the cookie's value
// is an opaque token, not a signed/encrypted payload.
app.use(cookieParser());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
});

app.get('/admin/api/health', (req, res) => res.json({ ok: true }));

// Uploaded lesson media / partner logos / prize photos — public, read-only.
app.use('/admin/api/uploads', express.static(UPLOADS_DIR));

app.use('/admin/api/admin', adminRoutes);
app.use('/admin/api/cron', cronRoutes);
app.use('/admin/api', routes);

app.use('/admin/api', (req, res) => {
  res.status(404).json({ error: 'Табылган жок' });
});

// Static frontend — only relevant off Vercel (the frontend is deployed
// separately there). `npm run build` produces dist/ at the repo root with
// the admin SPA already copied into dist/admin/ (see package.json's build
// script); this mirrors the two rewrite rules from vercel.json (SPA
// fallback for "/", separate SPA fallback for "/admin") for a
// non-serverless host that has to do its own routing.
const DIST_DIR = path.join(__dirname, '..', 'dist');
if (!process.env.VERCEL && fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));

  // A request for a *file* that express.static didn't find is a genuine 404,
  // not a client-side route — no route in src/App.jsx has a dot in it. Without
  // this, the SPA fallbacks below answer 200 + index.html for anything, which
  // is a soft 404: /nope.html, /missing.js and /robots.txt-typo all look like
  // real pages to a crawler, and it also silently breaks verification schemes
  // that fetch a named file (Google Search Console's HTML-file method expects
  // its own content back, not the app shell).
  const looksLikeFile = /\.[a-z0-9]{1,8}$/i;
  app.get(/^(?!\/admin\/api).*/, (req, res, next) => {
    if (looksLikeFile.test(req.path)) {
      res.status(404).type('txt').send('Not found');
      return;
    }
    next();
  });

  app.get(/^\/admin(\/.*)?$/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'admin', 'index.html'));
  });
  app.get(/^(?!\/admin\/api).*/, (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// Central error handler — every route above forwards failures via next(err),
// so no unhandled rejection ever falls through as a bare 500 HTML page.
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Сервер катасы, кайра аракет кылыңыз' });
});

if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(`[server] JashMen API listening on http://localhost:${PORT}`);
  });

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      console.log(`\n[server] ${sig} received, shutting down...`);
      server.close(() => process.exit(0));
    });
  }
}

export default app;
