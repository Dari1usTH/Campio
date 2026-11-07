FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata && adduser -D -u 10001 app \
 && mkdir -p /data/media && chown app /data/media
WORKDIR /app
COPY --from=build /out/server /app/server
COPY seed /app/seed
USER app
ENV SEED_DIR=/app/seed PORT=8080 MEDIA_DIR=/data/media
EXPOSE 8080
ENTRYPOINT ["/app/server"]
