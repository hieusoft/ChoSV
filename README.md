# HieuSoft Marketplace — Chợ đồ cũ sinh viên

Backend microservices cho app chợ đồ cũ sinh viên. Kiến trúc tách service + DB riêng, giao tiếp qua REST (đồng bộ) và RabbitMQ (bất đồng bộ), vào chung qua API gateway Kong.

## Kiến trúc tổng quan

```
                    ┌─────────────┐
   Flutter app ───► │  Kong :8080 │  (API gateway, verify JWT, forward X-User-Id/Role)
                    └──────┬──────┘
          ┌────────────┬──┴──────┬────────────┬─────────────┐
          ▼            ▼         ▼            ▼             ▼
      auth:3001   user:3002  product:3003  upload:3010   ai:3007*
          │            │         │            │             │
          └── RabbitMQ (event bus) ───────────┘             │
          └── PostgreSQL (mỗi service 1 DB) ────────────────┘
   (* ai:3007 bind localhost, không expose qua Kong — chỉ nội bộ gọi)
```

Luồng event tiêu biểu (đăng sản phẩm → kiểm duyệt):
```
product tạo (pending_check) ──product.created──► moderation ──gọi──► ai /analyze
product cập nhật status ◄──product.moderated── moderation (quyết định)
```

## Tech stack

| Thành phần | Công nghệ |
|---|---|
| auth, user, product, upload | Node + Express + TypeScript |
| ai | Python + FastAPI |
| Gateway | Kong 3.7 (DB-less, declarative) |
| Database | PostgreSQL 16 (mỗi service 1 DB) |
| Message queue | RabbitMQ 3.13 |
| Cache | Redis 7 |
| Object storage | Cloudflare R2 (ảnh sản phẩm) |

> Các service `search`, `chat`, `notification`, `moderation`, `admin` đã có thư mục/schema nhưng chưa triển khai đầy đủ.

## Yêu cầu

- **Docker** + **Docker Compose** (bắt buộc — cách chạy chính)
- **Git Bash** nếu dùng Windows (các script `.sh` cần bash)
- Node 20+ và Python 3.11+ (chỉ khi muốn chạy service ngoài Docker để dev)

## Cấu trúc thư mục

```
project4/
├── docker-compose.yml           # Hạ tầng: Postgres, Redis, RabbitMQ
├── docker-compose.services.yml  # Các microservice + Kong
├── .env.example                 # Template biến môi trường
├── database/init/               # SQL khởi tạo DB (chạy tự động lần đầu)
│   ├── 00-create-databases.sql
│   ├── 01-auth-db.sql ... 09-upload-db.sql
│   └── 08-seed.sql              # Dữ liệu mẫu (categories, ...)
├── gateway/kong/
│   ├── build.sh                 # Gộp config -> kong.generated.yaml
│   ├── global.yaml, consumers.yaml
│   └── services/*.yaml          # Mỗi service 1 file route
└── services/
    ├── auth/  user/  product/  upload/   # Node + TS
    └── ai/                                # Python + FastAPI
```

## Setup

### 1. Chuẩn bị biến môi trường

```bash
cp .env.example .env
```

Mở `.env` và điền các giá trị **bắt buộc**:

| Biến | Ý nghĩa |
|---|---|
| `JWT_SECRET` | Chuỗi bí mật ký JWT (auth + Kong dùng chung — phải giống nhau) |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | Khóa Cloudflare R2 (upload ảnh) |
| `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL` | Cấu hình bucket R2 |
| `AI_API_KEY` | Khóa API vision (phân tích ảnh sản phẩm) |
| `AI_API_BASE_URL` | Endpoint vision API (tương thích OpenAI `chat/completions`) |
| `AI_MODEL` | Tên model vision |

> Thông tin DB/RabbitMQ giữa các service đã hardcode trong compose (`hieusoft/hieusoft123`), không cần chỉnh cho môi trường dev.

### 2. Build config Kong

Kong load 1 file `kong.generated.yaml` được gộp từ nhiều file nhỏ. Chạy lại mỗi khi sửa route trong `gateway/kong/`:

```bash
cd gateway/kong
bash build.sh          # cần Docker (dùng kong/deck qua container)
cd ../..
```

### 3. Khởi động toàn bộ

```bash
# Hạ tầng + tất cả service, build luôn image
docker compose -f docker-compose.yml -f docker-compose.services.yml up -d --build
```

Lần đầu Postgres sẽ tự chạy các script trong `database/init/` để tạo DB + seed. Các service chờ Postgres/RabbitMQ `healthy` rồi mới khởi động.

### 4. Kiểm tra

```bash
docker compose -f docker-compose.yml -f docker-compose.services.yml ps

# Health check qua từng service
curl http://localhost:3001/health   # auth
curl http://localhost:3003/health   # product
curl http://localhost:3007/health   # ai
```

## Cổng dịch vụ

| Dịch vụ | Cổng | Ghi chú |
|---|---|---|
| Kong (proxy) | **8080** | Điểm vào duy nhất cho client |
| Kong (admin) | 8001 | Chỉ nội bộ |
| auth-service | 3001 | |
| user-service | 3002 | |
| product-service | 3003 | |
| ai-service | 3007 | Bind `127.0.0.1` — không cho mạng ngoài |
| upload-service | 3010 | |
| PostgreSQL | 5432 | user/pass: `hieusoft`/`hieusoft123` |
| Redis | 6379 | |
| RabbitMQ | 5672 | AMQP |
| RabbitMQ UI | 15672 | Web quản lý (`hieusoft`/`hieusoft123`) |

## Sử dụng

Mọi request từ client đi qua Kong (`http://localhost:8080`). Kong verify JWT và forward `X-User-Id` / `X-User-Role` xuống service.

```bash
# Đăng ký
curl -X POST http://localhost:8080/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"sv@university.edu.vn","password":"secret123","full_name":"Sinh Vien"}'

# Đăng nhập -> lấy access_token
curl -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"sv@university.edu.vn","password":"secret123"}'

# Gọi API cần đăng nhập
curl http://localhost:8080/api/products \
  -H "Authorization: Bearer <access_token>"
```

> **Windows/Git Bash:** gửi tiếng Việt qua `curl -d '...'` inline dễ bị hỏng UTF-8. Ghi payload ra file `.json` rồi dùng `curl --data @file.json`.

### API docs (Swagger)

Các service Node có Swagger UI tại `/docs`, ví dụ:
- Product: http://localhost:3003/docs
- ai-service (FastAPI): http://localhost:3007/docs

## Lệnh thường dùng

```bash
# Xem log 1 service
docker logs -f hieusoft_product

# Rebuild lại 1 service sau khi sửa code
docker compose -f docker-compose.yml -f docker-compose.services.yml up -d --build product-service

# Nạp lại route Kong sau khi build.sh
docker compose -f docker-compose.yml -f docker-compose.services.yml up -d --force-recreate kong

# Truy cập psql
docker exec -it hieusoft_postgres psql -U hieusoft -d product_db

# Dừng toàn bộ (giữ dữ liệu)
docker compose -f docker-compose.yml -f docker-compose.services.yml down

# Dừng + xóa sạch volume (reset DB — mất hết dữ liệu)
docker compose -f docker-compose.yml -f docker-compose.services.yml down -v
```

## Phát triển 1 service ngoài Docker (tùy chọn)

Service Node:
```bash
cd services/product
npm install
npm run dev          # tsx watch, hot-reload
npm run typecheck    # kiểm tra kiểu, không emit
```

ai-service (Python):
```bash
cd services/ai
pip install -r requirements.txt
python -m app.main   # chạy uvicorn ở cổng AI_PORT
```

> Khi chạy ngoài Docker, đổi host trong URL kết nối từ tên container (`postgres`, `rabbitmq`) sang `localhost`.

## Xử lý sự cố

| Triệu chứng | Nguyên nhân / cách xử lý |
|---|---|
| Service không lên, log báo DB lỗi | Postgres chưa `healthy`, chờ vài giây rồi thử lại; kiểm tra `docker logs hieusoft_postgres` |
| DB thiếu bảng / seed | Script `database/init/` chỉ chạy **lần đầu** khi volume trống. Reset: `down -v` rồi `up` lại |
| Kong trả 404 route mới | Chưa chạy `build.sh` hoặc chưa `--force-recreate kong` |
| Kong trả 401 dù có token | `JWT_SECRET` trong `.env` khác với secret auth ký token — phải trùng |
| ai-service `upstream_error` | Vision provider lỗi tạm thời hoặc `AI_API_KEY` sai — thử lại / kiểm tra key |
```
