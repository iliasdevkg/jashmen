// admin-api/server.js — JashMen backend entrypoint.
//
// Serves everything under /admin/api. In dev, vite.config.js proxies
// /admin/api/* to http://localhost:PORT unchanged; in prod, vercel.json
// rewrites the same path to the deployed API. Either way this process only
// ever needs to know about the /admin/api prefix.

import express from 'express';
import cookieParser from 'cookie-parser';
import routes from './routes.js';
import adminRoutes from './adminRoutes.js';
import cronRoutes from './cronRoutes.js';
import { UPLOADS_DIR } from './uploads.js';

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

// Central error handler — every route above forwards failures via next(err),
// so no unhandled rejection ever falls through as a bare 500 HTML page.
app.use((err, req, res, next) => {
  console.error('[server] unhandled error:', err);
  res.status(500).json({ error: 'Сервер катасы, кайра аракет кылыңыз' });
});

const server = app.listen(PORT, () => {
  console.log(`[server] JashMen API listening on http://localhost:${PORT}`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`\n[server] ${sig} received, shutting down...`);
    server.close(() => process.exit(0));
  });
}
