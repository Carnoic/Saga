# Optimized for low memory environments (Railway free tier)
FROM node:20-alpine AS builder

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copy all package files first
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Copy tsconfig files
COPY tsconfig.base.json ./
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/web/tsconfig.json ./apps/web/
COPY apps/web/tsconfig.node.json ./apps/web/
COPY packages/shared/tsconfig.json ./packages/shared/

# Fix pnpm workspace references for npm (workspace:* -> *)
RUN sed -i 's/"workspace:\*"/"*"/g' apps/api/package.json && \
    sed -i 's/"workspace:\*"/"*"/g' apps/web/package.json

# Install ALL dependencies including devDependencies for build
# Using --workspaces to install deps for all packages
RUN npm install --legacy-peer-deps

# Copy source code
COPY packages/shared/src ./packages/shared/src
COPY apps/api/src ./apps/api/src
COPY apps/api/prisma ./apps/api/prisma
COPY apps/web/src ./apps/web/src
COPY apps/web/index.html ./apps/web/
COPY apps/web/vite.config.ts ./apps/web/
COPY apps/web/postcss.config.js ./apps/web/
COPY apps/web/tailwind.config.js ./apps/web/
COPY apps/web/public ./apps/web/public

# Build shared package first
WORKDIR /app/packages/shared
RUN npx tsc

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build frontend with limited memory
WORKDIR /app/apps/web
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npx vite build

# Build backend
WORKDIR /app/apps/api
RUN npx tsc

# Create database with schema in builder
ENV DATABASE_URL=file:/app/data/saga.db
RUN mkdir -p /app/data && npx prisma db push --skip-generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Fix workspace references
RUN sed -i 's/"workspace:\*"/"*"/g' apps/api/package.json

# Install only production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy built files from builder
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Copy Prisma client (may be in root node_modules with workspaces)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy initialized database from builder
COPY --from=builder /app/data ./data

# Create directories for data
RUN mkdir -p /app/storage /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV STORAGE_PATH=/app/storage
ENV DATABASE_URL=file:/app/data/saga.db

EXPOSE 3000

WORKDIR /app/apps/api
CMD ["node", "dist/index.js"]
