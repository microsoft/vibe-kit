# =============================================================================
# Stage 1: Build the frontend application
# =============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# The generated Aurora forecast payload is large enough to exceed Node's
# default heap during `tsc && vite build` in CI/container builds.
ENV NODE_OPTIONS=--max-old-space-size=8192

# Copy package metadata first so dependency installation can be cached.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build the static site.
COPY . .
RUN npm run build

# =============================================================================
# Stage 2: Serve with Nginx
# =============================================================================
FROM nginx:alpine

# Copy built assets from the build stage.
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration template for SPA routing and static caching.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

# Start nginx. The official image will process templates in /etc/nginx/templates.
CMD ["nginx", "-g", "daemon off;"]
