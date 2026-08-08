# syntax=docker/dockerfile:1

# ---- Stage 1: build the frontend (React SPA + admin panel) -------------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Builds admin-src/ (vite.admin.config.js) into admin/, then the main
# site into dist/, then copies admin/ -> dist/admin — same as running
# `npm run build` locally. See package.json.
RUN npm run build

# ---- Stage 2: production runtime — Express API + static frontend -------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Runtime deps only — the frontend is already compiled, no vite/tailwind/etc needed.
RUN npm ci --omit=dev && npm cache clean --force

COPY admin-api ./admin-api
COPY --from=builder /app/dist ./dist

# admin-api/data/{db.json,uploads/} persists app state on a mounted volume
# (see docker-compose.yml) — created on first run by db.js/uploads.js if absent.
RUN mkdir -p admin-api/data && chown -R node:node /app
USER node

EXPOSE 3030
CMD ["node", "admin-api/server.js"]
