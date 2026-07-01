FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /auth-service .

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /auth-service /auth-service
EXPOSE 3001
CMD ["/auth-service"]
