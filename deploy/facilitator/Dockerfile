FROM node:22-bookworm-slim AS deps
WORKDIR /app

RUN corepack enable

COPY examples/typescript/package.json examples/typescript/pnpm-lock.yaml examples/typescript/pnpm-workspace.yaml examples/typescript/turbo.json ./examples/typescript/
COPY typescript/package.json typescript/pnpm-workspace.yaml typescript/turbo.json typescript/tsconfig.base.json ./typescript/
COPY typescript/packages ./typescript/packages
COPY examples/typescript/facilitator/base-docker ./examples/typescript/facilitator/base-docker

WORKDIR /app/examples/typescript
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @x402/base-facilitator-docker... build
RUN pnpm deploy --filter @x402/base-facilitator-docker --prod --legacy /out

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /out ./

EXPOSE 4022
CMD ["node", "dist/index.js"]
