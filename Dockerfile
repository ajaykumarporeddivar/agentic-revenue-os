FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @agentic/database db:generate

FROM base AS web
WORKDIR /app
COPY --from=builder /app .
RUN pnpm --filter @agentic/web build
EXPOSE 3000
CMD ["pnpm", "--filter", "@agentic/web", "start"]

FROM base AS worker
WORKDIR /app
COPY --from=builder /app .
CMD ["pnpm", "--filter", "@agentic/worker", "start"]
