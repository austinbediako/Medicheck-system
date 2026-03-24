# =============================================================================
# MediCheck System — Production Dockerfile
# Node 20 + SWI-Prolog on Debian slim
# =============================================================================

FROM node:20-slim

# Install SWI-Prolog
RUN apt-get update && \
    apt-get install -y --no-install-recommends swi-prolog && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Install dependencies (production + types/typescript for build)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Copy source and build TypeScript
COPY . .
RUN pnpm run build

# Expose port (Render injects PORT at runtime)
EXPOSE 4000

# Run DB migration then start server
CMD ["node", "-e", "require('./dist/scripts/initDb').initDb().then(() => require('./dist/server'))"]
