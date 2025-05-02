FROM oven/bun:slim AS builder

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

# copy the rest of the application
COPY . .

RUN bun run build

# Use NginX to serve the built frontend and serve as a reverse proxy to the backend
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY public/maintenance.html /usr/share/nginx/html/maintenance.html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
