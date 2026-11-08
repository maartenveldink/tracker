# Tracker on a single server: PocketBase serves the API *and* the built PWA from
# one container / one origin. See server/README.md.

# --- 1. Build the PWA --------------------------------------------------------
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "same-origin" = talk to the origin the PWA is served from (see src/lib/pb.ts).
ARG VITE_PB_URL=same-origin
ENV VITE_PB_URL=$VITE_PB_URL
RUN npm run build

# --- 2. PocketBase + static PWA ---------------------------------------------
FROM ghcr.io/muchobien/pocketbase:0.28.4
COPY server/pb_migrations /pb_migrations
COPY server/pb_hooks /pb_hooks
COPY server/entrypoint.sh /entrypoint.sh
COPY --from=web /app/dist /pb_public

# The data dir (/data) is the only persistent path on the server (see server/README.md).
ENV PB_DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
