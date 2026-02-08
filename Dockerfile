# Optimized for low memory environments (Railway free tier)
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all package files
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

# Fix workspace references for npm
RUN sed -i 's/"@saga\/shared": "workspace:\*"/"@saga\/shared": "file:..\/..\/packages\/shared"/g' apps/api/package.json && \
    sed -i 's/"@saga\/shared": "workspace:\*"/"@saga\/shared": "file:..\/..\/packages\/shared"/g' apps/web/package.json

# Install ALL dependencies (including devDependencies for build)
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

# Build shared package using npx
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

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install only production dependencies
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Fix workspace references
RUN sed -i 's/"@saga\/shared": "workspace:\*"/"@saga\/shared": "file:..\/..\/packages\/shared"/g' apps/api/package.json

RUN npm install --omit=dev --legacy-peer-deps

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Create directories
RUN mkdir -p /app/storage /app/data

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV STORAGE_PATH=/app/storage
ENV DATABASE_URL=file:/app/data/saga.db

EXPOSE 3000

WORKDIR /app/apps/api
CMD npx prisma migrate deploy && node dist/index.js
