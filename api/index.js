// api/index.js — Vercel serverless entry point for the backend project
// (test-jashmen-api / jashmen-api), NOT used by the frontend project.
//
// Vercel treats every file under /api as its own serverless function; this
// is the only one, and vercel.backend.json rewrites all /admin/api/:path*
// traffic to it. The Express app itself still owns the full /admin/api/*
// routing (see admin-api/server.js) — Vercel rewrites preserve the
// original request path, so the app sees the same URLs it always has and
// needs no path-stripping logic here.
//
// IMPORTANT — vercel.backend.json only takes effect via an explicit
// `vercel --prod --local-config vercel.backend.json` CLI deploy (that's
// how this backend project is actually deployed). Vercel's normal
// git-push-to-deploy pipeline always reads the literal filename
// `vercel.json` at the project's Root Directory — since this project's
// Root Directory is the repo root, same as the FRONTEND project's own
// `vercel.json` sitting right next to this file, a git-connected
// auto-deploy for this backend project would silently pick up the
// frontend's config (wrong rewrites, wrong crons) instead of this one.
// No Git repo is connected to this Vercel project as of this writing, so
// that's not live-exploitable today — but before ever enabling git
// auto-deploy for it, either give it a distinct Root Directory with its
// own vercel.json, or keep deploying it via the explicit --local-config
// flag.
export { default } from '../admin-api/server.js';
