# API Contracts

Thư mục này chứa các contract (giao diện) giữa các service.

- `openapi/` — OpenAPI specs cho REST API
- `events/` — JSON schemas cho RabbitMQ events

## Nguyên tắc

- Mỗi service publish event phải tuân theo schema trong `events/`
- Mỗi service expose REST API nên có OpenAPI spec trong `openapi/`
- Khi thay đổi contract, tăng version

## Service Ports (local dev)

| Service | Port |
|---------|------|
| API Gateway | 8080 |
| Auth Service | 3001 |
| User Service | 3002 |
| Product Service | 3003 |
| Search Service | 3004 |
| Chat Service | 3005 |
| Notification Service | 3006 |
| AI Service | 3007 |
| Moderation Service | 3008 |
| Admin Service | 3009 |
