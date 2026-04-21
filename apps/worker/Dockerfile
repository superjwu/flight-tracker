# Build from the monorepo root:
#   Railway → rootDirectory = "" (repo root), dockerfilePath = "apps/worker/Dockerfile"

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

# Copy manifests first for better layer caching.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY apps/worker/tsconfig.json apps/worker/tsconfig.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm install --workspaces --include-workspace-root

# Copy source.
COPY apps/worker/src apps/worker/src
COPY packages/shared/src packages/shared/src

CMD ["npm", "run", "start", "--workspace", "apps/worker"]
