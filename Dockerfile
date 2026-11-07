# syntax=docker/dockerfile:1
FROM node:22-alpine AS frontend
WORKDIR /src/Frontend
COPY Frontend/package*.json ./
RUN npm ci
COPY Frontend/ ./
RUN npm run build

FROM golang:1.27-alpine AS backend
WORKDIR /src/Backend
COPY Backend/go.mod Backend/go.sum ./
RUN go mod download
COPY Backend/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

FROM alpine:3.22 AS app
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -u 10001 app \
 && mkdir -p /data/media /app/frontend \
 && chown -R app:app /data /app
WORKDIR /app
COPY --from=backend /out/server /app/server
COPY --from=backend /out/seed /app/seed-user
COPY --from=frontend /src/Frontend/dist/ /app/frontend/
COPY Backend/seed/ /app/seed/
USER app
ENV PORT=8080 FRONTEND_DIST=/app/frontend MEDIA_DIR=/data/media SEED_DIR=/app/seed
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
 CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
ENTRYPOINT ["/app/server"]
