# Build context: ./apps (the site renders shared components from apps/frontend/src).
FROM node:20-alpine AS builder
WORKDIR /apps/marketing

COPY marketing/package*.json ./
RUN npm ci

COPY frontend/src /apps/frontend/src
COPY marketing/ ./

# Optional analytics / Search Console verification, baked in at build time.
ARG PUBLIC_GA_ID
ARG PUBLIC_GSC_TOKEN
ENV PUBLIC_GA_ID=$PUBLIC_GA_ID PUBLIC_GSC_TOKEN=$PUBLIC_GSC_TOKEN

RUN npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4321 API_URL=http://api:8000
COPY --from=builder /apps/marketing/dist ./dist
COPY --from=builder /apps/marketing/node_modules ./node_modules
COPY --from=builder /apps/marketing/package.json ./
USER node
EXPOSE 4321
CMD ["node", "dist/server/entry.mjs"]
