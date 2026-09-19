# ============================================================
# Stage 1: Dependencies
# ============================================================
FROM node:24-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --only=production && \
    npx prisma generate

# ============================================================
# Stage 2: Production image
# ============================================================
FROM node:24-alpine AS runner

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init openssl

ENV NODE_ENV=production

# Create non-root user
RUN addgroup -S -g 1001 nodejs && \
    adduser -S -D -H -u 1001 -G nodejs nodeapp

# Copy dependencies and Prisma client from the deps stage
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/prisma ./prisma

# Copy application source code
COPY --chown=nodeapp:nodejs src ./src
COPY --chown=nodeapp:nodejs package*.json ./

# Create uploads directory
RUN mkdir -p \
    uploads/tickets \
    uploads/knowledge \
    uploads/assets \
    uploads/avatars && \
    chown -R nodeapp:nodejs uploads

USER nodeapp

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
