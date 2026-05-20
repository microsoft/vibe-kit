# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Vite env vars — inlined at build time
ARG VITE_AI4S_HOME_URL=https://www.microsoft.com/en-us/research/lab/microsoft-research-ai-for-science/
ENV VITE_AI4S_HOME_URL=$VITE_AI4S_HOME_URL

# Build the app (Vite outputs to dist/)
RUN npm run build

# Production stage
FROM nginx:alpine

# Install envsubst for runtime environment variable substitution
RUN apk add --no-cache gettext

# Copy nginx template for dynamic configuration
COPY --from=build /app/nginx.conf.template /app/nginx.conf.template

# Copy built app from build stage (Vite outputs to dist/)
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Use envsubst to substitute BACKEND_SERVICE at runtime, then start nginx
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_SERVICE}' < /app/nginx.conf.template > /etc/nginx/nginx.conf && nginx -g 'daemon off;'"]
