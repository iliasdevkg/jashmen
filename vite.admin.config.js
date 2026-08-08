// vite.admin.config.js — builds admin-src/ (the real admin panel source)
// into admin/, which is what vercel.json's `/admin` rewrite and the root
// `npm run build` (via `cp -r admin dist/admin`) both serve. Separate from
// vite.config.js on purpose: two independent single-page apps, one build
// each, sharing nothing but the backend they both talk to.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: 'admin-src',
  base: '/admin/',
  plugins: [react()],
  // Explicit path: `root` is admin-src/, but the shared Tailwind/Autoprefixer
  // config lives at the project root — point at it instead of relying on
  // Vite's upward directory search to find it.
  css: { postcss: path.join(__dirname, 'postcss.config.js') },
  build: {
    outDir: '../admin',
    emptyOutDir: true,
    sourcemap: false,
  },
});
