# Cloud Run worker for VIGIL paper pipeline
FROM oven/bun:1.4 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production=false
COPY . .
ENV NODE_ENV=production
CMD ["bun", "worker/index.ts"]
