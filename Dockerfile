# CareerPilot AI — frontend (TanStack Start SSR).
#
# The project's default nitro preset targets Cloudflare Workers; this build
# overrides it with the node-server preset so the same app runs in Docker
# behind plain Node (see docker-compose.yml).
#
# VITE_API_URL is baked in at build time and must be reachable from the
# *browser*, so for local Docker compose pass the host-accessible backend URL
# (http://localhost:8000/api) — docker-compose.yml does this for you.
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies first so rebuilds after source changes reuse the layer.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL \
    NITRO_PRESET=node-server
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
