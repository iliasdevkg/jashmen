import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', sourcemap: false },
  // admin/index.html is a pre-built, already-bundled app (built separately
  // from admin-src/, see vite.admin.config.js) — without this, Vite's dev
  // dependency scanner crawls every *.html in the project, tries to treat
  // that built bundle as source, and chokes on its own bundled imports.
  optimizeDeps: { entries: ['index.html'] },
  server: {
    proxy: {
      '/admin/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
      },
    },
  },
});
