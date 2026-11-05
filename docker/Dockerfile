# syntax=docker/dockerfile:1.7

FROM node:24.22.2-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable

FROM base AS build-base

COPY . .
RUN --mount=type=cache,id=yara-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile \
      --fetch-timeout=300000 \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=10000 \
      --fetch-retry-maxtimeout=60000 \
      --network-concurrency=1
RUN pnpm run build:packages

FROM build-base AS api-build
RUN pnpm --filter @yara/api build

FROM build-base AS worker-build
RUN pnpm --filter @yara/worker build

FROM build-base AS web-build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm --filter @yara/web build

FROM node:24.22.2-bookworm-slim AS api

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=api-build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=api-build --chown=node:node /workspace/apps/api ./apps/api
COPY --from=api-build --chown=node:node /workspace/packages ./packages

USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]

FROM api AS migrate
CMD ["node", "packages/adapters-postgres/dist/migrate.js"]

FROM node:24.22.2-bookworm-slim AS worker

ENV NODE_ENV=production
WORKDIR /workspace

COPY --from=worker-build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=worker-build --chown=node:node /workspace/apps/worker ./apps/worker
COPY --from=worker-build --chown=node:node /workspace/packages ./packages

USER node
EXPOSE 4001
CMD ["node", "apps/worker/dist/main.js"]

FROM node:24.22.2-bookworm-slim AS web

ENV NODE_ENV=production
ENV WEB_PORT=3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

COPY --from=web-build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
