# Optimized for low memory environments (Railway free tier)
FROM node:20-alpine AS builder

# Use npm instead of pnpm to reduce memory overhead
WORKDIR /app

# Copy package files first
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Create simplified package.json for npm (remove workspace protocol)
RUN sed -i 's/"@saga\/shared": "workspace:\*"/"@saga\/shared": "file:..\/..\/packages\/shared"/g' apps/api/package.json && \
    sed -i 's/"@saga\/shared": "workspace:\*"/"@saga\/shared": "file:..\/..\/packages\/shared"/g' apps/web/package.json

# Install dependencies with npm
RUN npm install --legacy-peer-deps

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web
COPY tsconfig.json ./

# Build shared package
WORKDIR /app/packages/shared
RUN npm run build

# Generate Prisma client
WORKDIR /app/apps/api
RUN npx prisma generate

# Build frontend
WORKDIR /app/apps/web
ENV NODE_OPTIONS="--max-old-space-size=512"
RUN npm run build

# Build backend
WORKDIR /app/apps/api
RUN npm run build

# Production stage - minimal image
FROM node:20-alpine AS production

WORKDIR /app

# Copy only what's needed for production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Install production dependencies only
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/web/dist ./apps/web/dist

# Create directories
RUN mkdir -p /app/storage /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV STORAGE_PATH=/app/storage
ENV DATABASE_URL=file:/app/data/saga.db

EXPOSE 3000

WORKDIR /app/apps/api

# Run migrations and start server
CMD npx prisma migrate deploy && node dist/index.js
