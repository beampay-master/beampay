FROM rust:1.78-alpine AS builder

RUN apk add --no-cache musl-dev pkgconfig openssl-dev

WORKDIR /app

COPY Cargo.toml Cargo.lock ./
# Pre-fetch dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release 2>/dev/null; rm -rf src

COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM alpine:3.19
RUN apk add --no-cache ca-certificates libgcc

WORKDIR /app
COPY --from=builder /app/target/release/beampay-backend .
COPY migrations ./migrations

EXPOSE 8080
CMD ["./beampay-backend"]
