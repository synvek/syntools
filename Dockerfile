# syntax=docker/dockerfile:1

# ---------- Stage 1: build the static site ----------
FROM node:22-alpine AS build

# pnpm comes from Corepack, pinned by the "packageManager" field in package.json
RUN corepack enable

WORKDIR /app

# Install first so this layer is reused until the lockfile changes.
# HUSKY=0 skips the git-hook install (there is no .git in the build context).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN HUSKY=0 pnpm install --frozen-lockfile

# Build-time settings (see README → Deployment → Docker):
#   SITE_URL                canonical origin for sitemap.xml / canonical / hreflang
#   BASE_PATH               deployment sub-path, "/" by default
#   VITE_ANALYTICS_ENDPOINT optional; empty leaves analytics disabled
ARG SITE_URL=https://www.syntools.net
ARG BASE_PATH=/
ARG VITE_ANALYTICS_ENDPOINT=
ENV SITE_URL=${SITE_URL} \
    BASE_PATH=${BASE_PATH} \
    VITE_ANALYTICS_ENDPOINT=${VITE_ANALYTICS_ENDPOINT} \
    HUSKY=0 \
    NODE_OPTIONS=--max-old-space-size=8192

COPY . .
RUN pnpm build

# ---------- Stage 2: serve the prerendered static output ----------
FROM nginx:alpine

COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
