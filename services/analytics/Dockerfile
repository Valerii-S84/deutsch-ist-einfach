FROM node:22-alpine AS builder
WORKDIR /app/services/analytics
COPY services/analytics/package*.json ./
RUN npm ci
COPY services/analytics/tsconfig.json ./
COPY services/analytics/src ./src
COPY lib/analytics /app/lib/analytics
COPY lib/article-definitions.ts /app/lib/article-definitions.ts
# Shared files resolve dependencies from /app/node_modules during compilation.
RUN ln -s /app/services/analytics/node_modules /app/node_modules
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY services/analytics/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/services/analytics/dist ./dist
COPY services/analytics/db ./db
USER node
CMD ["sh", "-c", "npm run migrate && npm start"]
