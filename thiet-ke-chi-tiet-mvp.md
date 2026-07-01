# Thiết kế chi tiết MVP app chợ đồ cũ sinh viên

Tài liệu này được tách chi tiết từ `instruction.md`.

Mục tiêu:

```text
- Làm rõ phạm vi MVP
- Thiết kế database PostgreSQL
- Thiết kế API endpoints
- Thiết kế upload ảnh bằng Cloudflare R2
- Thiết kế chat realtime
- Thiết kế notification bằng Firebase Cloud Messaging
- Thiết kế AI Service
- Thiết kế moderation/report/admin
- Thiết kế Flutter app
```

---

# 1. Phạm vi MVP

## 1.1 User thường

User thường có thể:

```text
- Đăng ký tài khoản
- Đăng nhập
- Đăng xuất
- Xem/cập nhật hồ sơ cá nhân
- Upload ảnh đại diện
- Xem danh sách sản phẩm
- Tìm kiếm/lọc sản phẩm
- Xem chi tiết sản phẩm
- Đăng sản phẩm mới
- Upload nhiều ảnh sản phẩm
- Sửa sản phẩm
- Xóa sản phẩm
- Đánh dấu sản phẩm đã bán
- Lưu/bỏ lưu sản phẩm yêu thích
- Xem danh sách yêu thích
- Chat với người bán/người mua
- Nhận thông báo
- Báo cáo sản phẩm/người dùng/tin nhắn vi phạm
- Đánh giá người dùng sau giao dịch
```

## 1.2 Admin

Admin có thể:

```text
- Đăng nhập admin
- Xem danh sách user
- Khóa/mở khóa user
- Xem danh sách sản phẩm
- Ẩn/xóa/duyệt sản phẩm
- Xem danh sách report
- Xử lý report
- Xem moderation queue
- Xem AI logs
- Xem thống kê dashboard cơ bản
```

## 1.3 AI trong MVP

AI dùng cho:

```text
- Gợi ý tiêu đề sản phẩm
- Gợi ý mô tả sản phẩm
- Gợi ý danh mục
- Gợi ý giá dựa trên sản phẩm tương tự
- Kiểm tra spam/scam cơ bản
- Parse intent tìm kiếm nếu có thời gian
```

Nguyên tắc quan trọng:

```text
Flutter không gọi AI API trực tiếp.
Flutter gọi backend.
Backend gọi AI Module/AI Service.
AI Service gọi External AI API.
AI Service validate output JSON, lưu log, rồi trả kết quả.
```

---

# 2. Kiến trúc MVP khuyến nghị

Tài liệu gốc định hướng microservices. Với MVP/đồ án, nên triển khai theo hướng:

```text
Modular Monolith trước, Microservices-ready sau
```

Tức là backend chạy một app chính, nhưng code chia module rõ ràng như service.

```text
Flutter App
    ↓ HTTPS / WebSocket
Backend API
    ↓
Modules:
    - Auth Module
    - User Module
    - Product Module
    - Search Module
    - Chat Module
    - Upload Module
    - Notification Module
    - AI Module
    - Moderation Module
    - Admin Module
    ↓
PostgreSQL
```

External services:

```text
- Cloudflare R2: lưu ảnh sản phẩm, avatar, report attachment
- Firebase Cloud Messaging: gửi push notification
- AI API: sinh nội dung, phân loại, moderation
- Redis: optional cho cache/pub-sub/chat scale sau này
```

---

# 3. Database PostgreSQL

## 3.1 Quy ước chung

Dùng UUID cho khóa chính:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

Các bảng chính nên có:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
```

## 3.2 Bảng `users`

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
```

role: `user`, `admin`, `moderator`
status: `active`, `inactive`, `banned`, `pending_verification`, `deleted`

## 3.3 Bảng `profiles`

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    avatar_object_key TEXT,
    avatar_url TEXT,
    university VARCHAR(255),
    campus VARCHAR(255),
    phone VARCHAR(30),
    bio TEXT,
    reputation_score INTEGER NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 3.4 Bảng `sessions`

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    device_name VARCHAR(255),
    device_id VARCHAR(255),
    ip_address VARCHAR(100),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## 3.5 Bảng `categories`

```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    icon_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Danh mục MVP:

```text
books             Sách, giáo trình
electronics       Đồ điện tử
laptop-tablet     Laptop, máy tính bảng
dorm-items        Đồ ký túc xá
bicycle           Xe đạp
clothes           Quần áo
study-tools       Dụng cụ học tập
other             Khác
```

## 3.6 Bảng `products`

```sql
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    price NUMERIC(12, 2) NOT NULL,
    condition VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_check',
    location VARCHAR(255),
    campus VARCHAR(255),
    risk_score INTEGER NOT NULL DEFAULT 0,
    view_count INTEGER NOT NULL DEFAULT 0,
    favorite_count INTEGER NOT NULL DEFAULT 0,
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
```

condition: `new`, `like_new`, `good`, `fair`, `poor`
status: `draft`, `pending_check`, `active`, `pending_review`, `hidden`, `sold`, `rejected`, `deleted`

## 3.7 Bảng `product_images`

```sql
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    object_key TEXT NOT NULL,
    image_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    content_type VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Ví dụ: `object_key = products/prd_123/img_001.jpg`, `image_url = https://cdn.domain.com/products/prd_123/img_001.jpg`

## 3.8 Bảng `favorites`

```sql
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);
```

## 3.9 Bảng `conversations`

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_message_id UUID,
    last_message_at TIMESTAMPTZ,
    buyer_unread_count INTEGER NOT NULL DEFAULT 0,
    seller_unread_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_product_buyer_seller UNIQUE (product_id, buyer_id, seller_id)
);
```

## 3.10 Bảng `messages`

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    risk_score INTEGER NOT NULL DEFAULT 0,
    moderation_status VARCHAR(30) NOT NULL DEFAULT 'unchecked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
```

message_type: `text`, `image`, `system`
moderation_status: `unchecked`, `safe`, `warning`, `blocked`, `review`

## 3.11 Bảng `reviews`

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reviewed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT unique_review_per_product_pair UNIQUE (reviewer_id, reviewed_user_id, product_id)
);
```

## 3.12 Bảng `reports`

```sql
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
```

target_type: `product`, `user`, `message`
reason: `spam`, `scam`, `prohibited_item`, `fake_product`, `harassment`, `wrong_category`, `other`

## 3.13 Bảng `moderation_queue`

```sql
CREATE TABLE moderation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0,
    risk_level VARCHAR(30) NOT NULL DEFAULT 'low',
    signals JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);
```

risk_level: `low`, `medium`, `high`, `critical`

## 3.14 Bảng `moderation_actions`

```sql
CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    target_type VARCHAR(30) NOT NULL,
    target_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

action: `allow`, `warn`, `hide`, `block`, `delete`, `ban_user`, `dismiss_report`, `restore`

## 3.15 Bảng `device_tokens`

```sql
CREATE TABLE device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    platform VARCHAR(30) NOT NULL,
    device_id VARCHAR(255),
    device_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

platform: `android`, `ios`, `web`

## 3.16 Bảng `notifications`

```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

type: `message_new`, `product_approved`, `product_hidden`, `product_interested`, `report_resolved`, `risk_warning`, `system`

## 3.17 Bảng `ai_logs`

```sql
CREATE TABLE ai_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    task_type VARCHAR(50) NOT NULL,
    input JSONB NOT NULL,
    output JSONB,
    model VARCHAR(100),
    provider VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'success',
    error_message TEXT,
    latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

task_type: `generate_listing`, `suggest_category`, `suggest_price`, `moderate_product`, `moderate_message`, `parse_search`

## 3.18 Bảng `upload_files`

Quản lý file trên Cloudflare R2:

```sql
CREATE TABLE upload_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    object_key TEXT NOT NULL UNIQUE,
    public_url TEXT NOT NULL,
    file_name VARCHAR(255),
    content_type VARCHAR(100),
    file_size INTEGER,
    purpose VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

purpose: `product_image`, `avatar`, `report_attachment`, `chat_image`
status: `pending`, `uploaded`, `linked`, `deleted`, `orphaned`

---

# 4. API design

## 4.1 Quy ước chung

Base URL: `/api`

Response thành công:
```json
{ "success": true, "data": {} }
```

Response lỗi:
```json
{ "success": false, "error": { "code": "ERROR_CODE", "message": "Mô tả", "details": {} } }
```

Header auth: `Authorization: Bearer <access_token>`

Pagination: `?page=1&limit=20`

Response list:
```json
{ "success": true, "data": { "items": [], "pagination": { "page": 1, "limit": 20, "total": 100, "total_pages": 5 } } }
```

---

## 4.2 Auth API

### POST /api/auth/register

```json
// request
{ "email": "student@university.edu.vn", "password": "12345678", "full_name": "Nguyễn Văn A", "university": "Đại học ABC", "campus": "Cơ sở 1" }

// response
{ "success": true, "data": { "user": { "id": "uuid", "email": "...", "role": "user", "status": "active", "email_verified": false }, "profile": { "id": "uuid", "full_name": "Nguyễn Văn A", "university": "Đại học ABC", "campus": "Cơ sở 1" }, "tokens": { "access_token": "jwt", "refresh_token": "refresh_token" } } }
```

### POST /api/auth/login

```json
// request
{ "email": "student@university.edu.vn", "password": "12345678", "device_name": "iPhone 15" }

// response
{ "success": true, "data": { "user": { "id": "uuid", "email": "...", "role": "user" }, "tokens": { "access_token": "jwt", "refresh_token": "refresh_token" } } }
```

### GET /api/auth/me

Auth: cần. Trả về user + profile hiện tại.

### POST /api/auth/refresh-token

```json
// request
{ "refresh_token": "refresh_token" }
// response
{ "success": true, "data": { "access_token": "new_jwt", "refresh_token": "new_refresh_token" } }
```

### POST /api/auth/logout

Auth: cần. Body: `{ "refresh_token": "refresh_token" }`. Revoke session.

---

## 4.3 User/Profile API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| GET | /api/users/me | cần | Lấy profile của chính mình |
| PATCH | /api/users/me | cần | Cập nhật profile |
| GET | /api/users/{user_id} | không | Xem profile public của user |

PATCH /api/users/me - request:
```json
{ "full_name": "Nguyễn Văn A", "university": "Đại học ABC", "campus": "Cơ sở 1", "phone": "0900000000", "bio": "Sinh viên năm 3" }
```

---

## 4.4 Upload API (Cloudflare R2)

### POST /api/uploads/presign

Auth: cần.

```json
// request
{ "purpose": "product_image", "file_name": "laptop.jpg", "content_type": "image/jpeg", "file_size": 1024000, "product_id": "uuid" }

// response
{ "success": true, "data": { "upload_url": "https://r2-presigned-url...", "object_key": "products/uuid/img_uuid.jpg", "public_url": "https://cdn.domain.com/products/uuid/img_uuid.jpg", "headers": { "Content-Type": "image/jpeg" } } }
```

Validate:
- content_type phải là image/jpeg, image/png, image/webp
- file_size không quá giới hạn (ví dụ 5MB)
- purpose phải hợp lệ
- Nếu purpose là product_image, user phải là chủ product hoặc đang tạo draft

### POST /api/uploads/confirm

Auth: cần.

```json
// request
{ "object_key": "products/uuid/img_uuid.jpg", "purpose": "product_image", "product_id": "uuid", "sort_order": 1 }
```

Backend kiểm tra object có tồn tại trong R2 trước khi confirm.

---

## 4.5 Product API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| GET | /api/products | không | Danh sách sản phẩm (chỉ active) |
| GET | /api/products/{id} | không | Chi tiết sản phẩm |
| POST | /api/products | cần | Tạo sản phẩm mới |
| PATCH | /api/products/{id} | cần | Cập nhật (chỉ seller/admin) |
| DELETE | /api/products/{id} | cần | Xóa mềm (chỉ seller/admin) |
| POST | /api/products/{id}/mark-sold | cần | Đánh dấu đã bán (chỉ seller) |

GET /api/products query params:
```text
?page=1&limit=20&category_id=&min_price=&max_price=&condition=&campus=&sort=newest
```

POST /api/products - request:
```json
{ "category_id": "uuid", "title": "Máy tính Casio FX-580VN X", "description": "Máy còn tốt.", "price": 450000, "condition": "good", "location": "KTX khu A", "campus": "Cơ sở 1" }
```

---
## 4.6 Category API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| GET | /api/categories | không | Lấy danh sách danh mục active |

---

## 4.7 Favorite API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| POST | /api/products/{id}/favorite | cần | Thêm yêu thích |
| DELETE | /api/products/{id}/favorite | cần | Bỏ yêu thích |
| GET | /api/me/favorites | cần | Danh sách yêu thích |

---

## 4.8 Search API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| GET | /api/search | không | Tìm kiếm sản phẩm |

Query params:
```text
?q=casio&category_id=&min_price=&max_price=&condition=&campus=&sort=newest&page=1&limit=20
```

MVP dùng ILIKE query trên title và description.

---

## 4.9 Chat API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| GET | /api/conversations | cần | Danh sách hội thoại |
| POST | /api/conversations | cần | Tạo/lấy hội thoại theo product |
| GET | /api/conversations/{id}/messages | cần | Lấy tin nhắn |
| POST | /api/conversations/{id}/messages | cần | Gửi tin nhắn (REST fallback) |
| PATCH | /api/conversations/{id}/read | cần | Đánh dấu đã đọc |

POST /api/conversations - request:
```json
{ "product_id": "uuid" }
```

Không cho phép seller tự tạo conversation với chính mình.

---

## 4.10 Review API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| POST | /api/users/{user_id}/reviews | cần | Đánh giá user |
| GET | /api/users/{user_id}/reviews | không | Xem đánh giá của user |

POST - request:
```json
{ "product_id": "uuid", "rating": 5, "comment": "Người bán thân thiện, sản phẩm đúng mô tả." }
```

---

## 4.11 Report API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| POST | /api/reports | cần | Tạo report |
| GET | /api/reports/me | cần | Xem report của mình |

POST - request:
```json
{ "target_type": "product", "target_id": "uuid", "reason": "scam", "description": "Người bán yêu cầu chuyển khoản trước." }
```

---

## 4.12 Notification API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| POST | /api/notifications/device-token | cần | Lưu FCM token |
| GET | /api/notifications | cần | Danh sách thông báo |
| PATCH | /api/notifications/{id}/read | cần | Đánh dấu đã đọc |
| PATCH | /api/notifications/read-all | cần | Đánh dấu tất cả đã đọc |

POST /api/notifications/device-token - request:
```json
{ "token": "fcm_token", "platform": "android", "device_id": "device_uuid", "device_name": "Samsung Galaxy A" }
```

---

## 4.13 AI API

| Method | URL | Auth | Mô tả |
|--------|-----|------|-------|
| POST | /api/ai/generate-listing | cần | AI sinh tiêu đề + mô tả + gợi ý danh mục + giá |
| POST | /api/ai/suggest-category | cần | AI gợi ý danh mục |
| POST | /api/ai/suggest-price | cần | AI giải thích giá (backend tính median, AI giải thích) |
| POST | /api/ai/moderate-content | cần/internal | AI kiểm tra spam/scam |

POST /api/ai/generate-listing - request:
```json
{ "raw_description": "máy tính casio 580 còn tốt, dùng 1 năm", "images": ["https://cdn.domain.com/temp/image1.jpg"], "expected_price": 450000 }
```
Response: `{ title, description, category_slug, condition_suggestion, price_suggestion: { min, max, reason } }`

POST /api/ai/moderate-content - response:
```json
{ "risk_score": 78, "risk_level": "high", "signals": ["Giá thấp bất thường", "Có yêu cầu chuyển khoản trước"], "action": "review" }
```
action: `allow`, `warn`, `review`, `hide`, `block`, `ban_suggested`

---

## 4.14 Admin API

Tất cả cần auth với role `admin` hoặc `moderator`.

| Method | URL | Mô tả |
|--------|-----|-------|
| GET | /api/admin/dashboard/stats | Thống kê dashboard |
| GET | /api/admin/users | Danh sách users |
| PATCH | /api/admin/users/{id}/status | Cập nhật trạng thái user |
| GET | /api/admin/products | Danh sách sản phẩm (cả ẩn/chờ duyệt) |
| PATCH | /api/admin/products/{id}/status | Cập nhật trạng thái sản phẩm |
| GET | /api/admin/moderation/queue | Moderation queue |
| POST | /api/admin/moderation/{queue_id}/action | Xử lý moderation |
| GET | /api/admin/ai-logs | Xem AI logs |

POST /api/admin/moderation/{queue_id}/action - request:
```json
{ "action": "hide", "note": "Ẩn sản phẩm vì có dấu hiệu scam" }
```

---

# 5. WebSocket chat events

WebSocket URL: `wss://api.domain.com/ws`

Auth: gửi access_token khi connect.

### Client → Server: join_conversation
```json
{ "event": "join_conversation", "data": { "conversation_id": "uuid" } }
```

### Client → Server: send_message
```json
{ "event": "send_message", "data": { "conversation_id": "uuid", "content": "Bạn còn bán không?", "message_type": "text" } }
```

### Server → Client: message_received
```json
{ "event": "message_received", "data": { "id": "uuid", "conversation_id": "uuid", "sender_id": "uuid", "content": "...", "message_type": "text", "created_at": "..." } }
```

### Client → Server: mark_read
```json
{ "event": "mark_read", "data": { "conversation_id": "uuid" } }
```

### Server → Client: risk_warning
```json
{ "event": "risk_warning", "data": { "conversation_id": "uuid", "message_id": "uuid", "risk_score": 80, "signals": ["Có yêu cầu chuyển khoản trước"], "warning_text": "Hãy cẩn thận, tin nhắn này có dấu hiệu rủi ro." } }
```

---

# 6. Firebase Cloud Messaging

## 6.1 Luồng gửi FCM khi có tin nhắn mới

```text
1. User A gửi message cho User B
2. Backend lưu message
3. Backend tạo notification trong bảng notifications cho User B
4. Backend lấy device_tokens active của User B
5. Backend gọi Firebase Admin SDK gửi push
6. FCM đẩy tới điện thoại User B
7. User B bấm notification → Flutter mở ChatDetailScreen
```

FCM payload:
```json
{
  "notification": { "title": "Tin nhắn mới", "body": "Nguyễn Văn A đã nhắn tin về Máy tính Casio" },
  "data": { "type": "message_new", "conversation_id": "uuid", "product_id": "uuid" }
}
```

## 6.2 Các loại notification cần FCM

| Event | FCM title | FCM body |
|-------|-----------|----------|
| Có tin nhắn mới | Tin nhắn mới | {sender_name} đã nhắn tin về {product_title} |
| Sản phẩm được duyệt | Sản phẩm đã được duyệt | {product_title} đã được đăng thành công |
| Sản phẩm bị ẩn | Sản phẩm bị ẩn | {product_title} đã bị ẩn vì {reason} |
| Report được xử lý | Report đã được xử lý | Report của bạn đã được xem xét |
| Cảnh báo rủi ro | ⚠ Cảnh báo giao dịch | Hãy cẩn thận khi giao dịch |
| Có người yêu thích | Có người quan tâm | {user_name} đã lưu {product_title} vào yêu thích |

---

# 7. Cloudflare R2 upload flow

Object key convention:
```text
avatars/{user_id}/avatar.jpg
products/{product_id}/{image_id}.jpg
reports/{report_id}/attachment.jpg
chat/{conversation_id}/{message_id}.jpg
```

Luồng upload ảnh sản phẩm:
```text
1. User tạo sản phẩm (status = draft hoặc pending_check)
2. Flutter gọi POST /api/uploads/presign
3. Backend tạo object_key, tạo upload_files (status = pending)
4. Backend gọi R2 SDK tạo presigned URL (PUT method)
5. Backend trả upload_url cho Flutter
6. Flutter PUT file lên upload_url (upload trực tiếp lên R2)
7. Flutter gọi POST /api/uploads/confirm
8. Backend kiểm tra object tồn tại trong R2 (HEAD request)
9. Backend tạo product_images record
10. Backend update upload_files.status = linked
```

Public URL format:
```text
https://cdn.domain.com/products/uuid/img_uuid.jpg
```
(Dùng custom domain hoặc R2 public URL)

---

# 8. Luồng nghiệp vụ chính

## 8.1 Đăng sản phẩm có AI hỗ trợ

```text
1. User nhập mô tả ngắn hoặc upload ảnh nháp
2. Flutter gọi POST /api/ai/generate-listing
3. Backend gọi AI API
4. AI trả title, description, category, condition, price suggestion
5. Flutter hiển thị gợi ý cho user chỉnh sửa
6. User bấm đăng → POST /api/products
7. Backend tạo product (status = pending_check)
8. User upload ảnh qua presign + confirm
9. Backend chạy moderation (rule + AI nếu cần)
10. Nếu an toàn → status = active
11. Nếu rủi ro → status = pending_review, tạo moderation_queue
```

## 8.2 Chat + notification

```text
1. Buyer bấm Chat → POST /api/conversations
2. Backend trả conversation_id
3. Flutter mở ChatDetailScreen + connect WebSocket
4. Buyer gửi message (WebSocket hoặc REST fallback)
5. Backend lưu message
6. Backend gửi WebSocket event cho receiver nếu online
7. Backend tạo notification trong DB
8. Backend gửi FCM push cho receiver nếu có device token
9. Receiver bấm notification → mở ChatDetailScreen
```

## 8.3 Report + moderation

```text
1. User bấm Report → POST /api/reports
2. Backend lưu report
3. Backend kiểm tra số report / risk score
4. Nếu nghiêm trọng → tạo moderation_queue
5. Admin mở dashboard thấy queue
6. Admin chọn action → POST /api/admin/moderation/{id}/action
7. Backend lưu moderation_actions
8. Backend cập nhật target (product/user/message)
9. Backend gửi notification cho user liên quan
```

---

# 9. Flutter app design

## 9.1 Cấu trúc thư mục

```text
lib/
├── main.dart
├── app.dart
│
├── config/
│   ├── app_config.dart          # Base URL, timeout, constants
│   ├── app_theme.dart           # Theme, colors, text styles
│   ├── app_routes.dart          # Route names, GoRouter config
│   └── app_environment.dart     # dev/staging/prod environments
│
├── models/
│   ├── user.dart
│   ├── profile.dart
│   ├── product.dart
│   ├── product_image.dart
│   ├── category.dart
│   ├── conversation.dart
│   ├── message.dart
│   ├── notification_item.dart
│   ├── review.dart
│   ├── report.dart
│   ├── pagination.dart
│   └── api_response.dart
│
├── services/
│   ├── api/
│   │   ├── api_client.dart          # Dio instance, interceptors, base config
│   │   ├── auth_api.dart
│   │   ├── user_api.dart
│   │   ├── product_api.dart
│   │   ├── category_api.dart
│   │   ├── search_api.dart
│   │   ├── favorite_api.dart
│   │   ├── chat_api.dart
│   │   ├── upload_api.dart
│   │   ├── notification_api.dart
│   │   ├── ai_api.dart
│   │   ├── report_api.dart
│   │   ├── review_api.dart
│   │   └── admin_api.dart
│   ├── socket/
│   │   └── websocket_service.dart   # WebSocket connection, events
│   ├── auth/
│   │   └── auth_service.dart        # Token storage, login state
│   ├── storage/
│   │   └── secure_storage.dart      # Flutter Secure Storage for tokens
│   ├── notification/
│   │   └── fcm_service.dart         # FCM init, token, onMessage handlers
│   ├── image/
│   │   └── image_picker_service.dart
│   └── location/
│       └── r2_upload_service.dart   # Upload ảnh lên R2 presigned URL
│
├── providers/                        # State management (Provider/Riverpod)
│   ├── auth_provider.dart
│   ├── product_provider.dart
│   ├── chat_provider.dart
│   ├── notification_provider.dart
│   ├── favorite_provider.dart
│   ├── search_provider.dart
│   └── theme_provider.dart
│
├── screens/
│   ├── splash/
│   │   └── splash_screen.dart
│   ├── auth/
│   │   ├── login_screen.dart
│   │   ├── register_screen.dart
│   │   └── forgot_password_screen.dart
│   ├── home/
│   │   └── home_screen.dart
│   ├── product/
│   │   ├── product_list_screen.dart
│   │   ├── product_detail_screen.dart
│   │   ├── create_product_screen.dart
│   │   ├── edit_product_screen.dart
│   │   └── my_products_screen.dart
│   ├── search/
│   │   └── search_screen.dart
│   ├── favorite/
│   │   └── favorite_screen.dart
│   ├── chat/
│   │   ├── conversation_list_screen.dart
│   │   └── chat_detail_screen.dart
│   ├── profile/
│   │   ├── profile_screen.dart
│   │   ├── edit_profile_screen.dart
│   │   └── user_profile_screen.dart
│   ├── notification/
│   │   └── notification_screen.dart
│   ├── report/
│   │   └── report_screen.dart
│   ├── review/
│   │   └── review_screen.dart
│   └── admin/
│       ├── admin_dashboard_screen.dart
│       ├── admin_users_screen.dart
│       ├── admin_products_screen.dart
│       ├── admin_reports_screen.dart
│       └── admin_moderation_screen.dart
│
├── widgets/
│   ├── common/
│   │   ├── app_button.dart
│   │   ├── app_text_field.dart
│   │   ├── app_loader.dart
│   │   ├── app_snackbar.dart
│   │   ├── empty_state.dart
│   │   ├── error_state.dart
│   │   ├── pagination_list.dart
│   │   └── cached_image.dart
│   ├── product/
│   │   ├── product_card.dart
│   │   ├── product_grid.dart
│   │   ├── product_image_carousel.dart
│   │   ├── product_condition_chip.dart
│   │   ├── product_price_display.dart
│   │   └── product_status_badge.dart
│   ├── chat/
│   │   ├── message_bubble.dart
│   │   ├── chat_input_bar.dart
│   │   └── conversation_tile.dart
│   ├── user/
│   │   ├── user_avatar.dart
│   │   ├── user_rating_stars.dart
│   │   └── user_reputation_badge.dart
│   ├── category/
│   │   └── category_chip.dart
│   └── search/
│       ├── search_bar.dart
│       └── filter_bottom_sheet.dart
│
└── utils/
    ├── validators.dart            # Email, password, phone validators
    ├── formatters.dart            # Price format, date format
    ├── constants.dart             # Condition labels, status labels
    └── helpers.dart               # Misc utility functions
```

---

## 9.2 State management

Khuyến nghị dùng **Riverpod** hoặc **Provider**.

Ví dụ cấu trúc provider với Riverpod:

```dart
// auth_provider.dart
final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});

class AuthState {
  final User? user;
  final Profile? profile;
  final bool isLoading;
  final String? error;
  final bool isAuthenticated;
}

class AuthNotifier extends StateNotifier<AuthState> {
  // login()
  // register()
  // logout()
  // refreshToken()
  // getMe()
}
```

```dart
// product_provider.dart
final productListProvider = FutureProvider.family<PaginationResult<Product>, ProductFilter>((ref, filter) {
  return ref.read(productApiProvider).getProducts(filter);
});

final productDetailProvider = FutureProvider.family<ProductDetail, String>((ref, id) {
  return ref.read(productApiProvider).getProduct(id);
});
```

```dart
// chat_provider.dart
final conversationsProvider = FutureProvider<PaginationResult<Conversation>>((ref) {
  return ref.read(chatApiProvider).getConversations();
});

final messagesProvider = FutureProvider.family<PaginationResult<Message>, String>((ref, conversationId) {
  return ref.read(chatApiProvider).getMessages(conversationId);
});
```

---

## 9.3 Routing

Dùng **GoRouter**:

```dart
final router = GoRouter(
  initialLocation: '/splash',
  redirect: (context, state) {
    final isLoggedIn = /* check auth state */;
    final isOnAuth = state.matchedLocation.startsWith('/login') || 
                     state.matchedLocation.startsWith('/register');
    
    if (!isLoggedIn && !isOnAuth && state.matchedLocation != '/splash') {
      return '/login';
    }
    if (isLoggedIn && isOnAuth) {
      return '/home';
    }
    return null;
  },
  routes: [
    GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
    GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
    GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
    
    // Main tabs (nested navigation với BottomNavigationBar)
    StatefulShellRoute.indexedStack(
      builder: (_, __, navigationShell) => HomeScreen(navigationShell: navigationShell),
      branches: [
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/home', builder: (_, __) => const ProductListScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/search', builder: (_, __) => const SearchScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/create', builder: (_, __) => const CreateProductScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/chats', builder: (_, __) => const ConversationListScreen()),
          ],
        ),
        StatefulShellBranch(
          routes: [
            GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          ],
        ),
      ],
    ),
    
    GoRoute(path: '/products/:id', builder: (_, state) => ProductDetailScreen(id: state.pathParameters['id']!)),
    GoRoute(path: '/products/:id/edit', builder: (_, state) => EditProductScreen(id: state.pathParameters['id']!)),
    GoRoute(path: '/my-products', builder: (_, __) => const MyProductsScreen()),
    GoRoute(path: '/favorites', builder: (_, __) => const FavoriteScreen()),
    GoRoute(path: '/chats/:id', builder: (_, state) => ChatDetailScreen(conversationId: state.pathParameters['id']!)),
    GoRoute(path: '/profile/edit', builder: (_, __) => const EditProfileScreen()),
    GoRoute(path: '/users/:id', builder: (_, state) => UserProfileScreen(userId: state.pathParameters['id']!)),
    GoRoute(path: '/notifications', builder: (_, __) => const NotificationScreen()),
    GoRoute(path: '/report', builder: (_, __) => const ReportScreen()),
    GoRoute(path: '/review/:userId', builder: (_, state) => ReviewScreen(userId: state.pathParameters['userId']!)),
    
    // Admin
    GoRoute(path: '/admin', builder: (_, __) => const AdminDashboardScreen()),
    GoRoute(path: '/admin/users', builder: (_, __) => const AdminUsersScreen()),
    GoRoute(path: '/admin/products', builder: (_, __) => const AdminProductsScreen()),
    GoRoute(path: '/admin/reports', builder: (_, __) => const AdminReportsScreen()),
    GoRoute(path: '/admin/moderation', builder: (_, __) => const AdminModerationScreen()),
  ],
);
```

---

## 9.4 Mô tả chi tiết từng màn hình

### SplashScreen
```text
Mục đích: Hiển thị logo app, kiểm tra token.
Logic:
  - Kiểm tra access_token trong SecureStorage
  - Nếu có → gọi GET /api/auth/me để kiểm tra token còn valid
  - Nếu valid → navigate đến /home
  - Nếu không → navigate đến /login
UI: Logo + tên app + loading indicator
```

### LoginScreen
```text
UI:
  - Email TextField
  - Password TextField
  - Button "Đăng nhập"
  - Link "Quên mật khẩu?"
  - Link "Chưa có tài khoản? Đăng ký"

Logic:
  - Validate email/password client-side
  - Gọi AuthApi.login()
  - Lưu access_token + refresh_token vào SecureStorage
  - Lưu FCM token (gọi NotificationApi.saveDeviceToken)
  - Navigate đến /home

Error handling:
  - INVALID_CREDENTIALS → "Email hoặc mật khẩu không đúng"
  - USER_BANNED → "Tài khoản đã bị khóa"
  - Network error → "Không thể kết nối đến server"
```

### RegisterScreen
```text
UI:
  - Email TextField
  - Password TextField
  - Confirm Password TextField
  - Full name TextField
  - University TextField (optional)
  - Campus TextField (optional)
  - Button "Đăng ký"
  - Link "Đã có tài khoản? Đăng nhập"

Logic:
  - Validate email format, password length (>= 6), password match
  - Gọi AuthApi.register()
  - Auto login sau register → lưu token → navigate /home
```

### HomeScreen
```text
Mục đích: Màn hình chính với BottomNavigationBar.

Tabs:
  1. Trang chủ (ProductListScreen với filter mặc định)
  2. Tìm kiếm (SearchScreen)
  3. Đăng bán (CreateProductScreen)
  4. Tin nhắn (ConversationListScreen)
  5. Tôi (ProfileScreen)

BottomNavigationBar items:
  - Trang chủ (icon: home)
  - Tìm kiếm (icon: search)
  - Đăng bán (icon: add_circle)
  - Tin nhắn (icon: chat, badge: unread_count)
  - Tôi (icon: person)
```

### ProductListScreen
```text
UI:
  - AppBar với tiêu đề
  - Filter chips (danh mục, giá, tình trạng, khu vực)
  - GridView hoặc ListView sản phẩm
  - Pull-to-refresh
  - Infinite scroll pagination
  - Loading skeleton
  - Empty state: "Chưa có sản phẩm nào"

Mỗi ProductCard hiển thị:
  - Ảnh thumbnail (ảnh đầu tiên)
  - Tiêu đề (max 2 dòng)
  - Giá (định dạng VND)
  - Tình trạng (chip màu)
  - Khu vực / trường
  - Thời gian đăng
  - Icon favorite (nếu đã lưu)

Tap → navigate đến ProductDetailScreen
```

### ProductDetailScreen
```text
UI:
  - Image carousel (PageView + indicator dots)
  - Seller info (avatar, tên, điểm uy tín, badge)
  - Tiêu đề sản phẩm
  - Giá (to, màu nổi bật)
  - Tình trạng (chip)
  - Danh mục (chip)
  - Mô tả (expandable nếu dài)
  - Khu vực / trường
  - Thời gian đăng
  - Số lượt xem
  - Số yêu thích

Actions:
  - Button "Chat với người bán" (primary button, to nhất)
  - IconButton "Yêu thích" (heart icon, toggle)
  - IconButton "Chia sẻ"
  - Nếu là chủ sản phẩm: "Sửa", "Đánh dấu đã bán", "Xóa"
  - Link "Báo cáo sản phẩm"

Seller section (tap → UserProfileScreen):
  - Avatar
  - Tên
  - Điểm uy tín + sao
```

### CreateProductScreen
```text
UI (Form cuộn dọc):
  - Upload ảnh (grid ảnh, nút thêm ảnh, tối đa 8 ảnh)
  - "Dùng AI tạo nội dung" (nút, mở bottom sheet nhập mô tả thô)
  - Tiêu đề TextField
  - Danh mục Dropdown (từ categories API)
  - Giá TextField (numeric keyboard)
  - Tình trạng (chips: Mới, Như mới, Tốt, Dùng ổn, Cũ)
  - Mô tả TextField (multiline)
  - Khu vực TextField
  - Trường/Campus TextField
  - Button "Đăng sản phẩm"

Logic:
  - Validate form
  - Nếu dùng AI → gọi POST /api/ai/generate-listing trước → fill form
  - Upload từng ảnh qua presign → confirm
  - Gọi POST /api/products
  - Show success → navigate đến ProductDetailScreen

AI flow:
  - User nhập mô tả thô vào bottom sheet
  - Gọi AI generate-listing
  - Hiển thị kết quả, user chỉnh sửa
  - User bấm "Dùng kết quả này" → fill form
```

### SearchScreen
```text
UI:
  - SearchBar (TextField + icon search)
  - Filter chips (danh mục, giá range, tình trạng, khu vực)
  - Sort dropdown (Mới nhất, Giá thấp→cao, Giá cao→thấp)
  - Kết quả (giống ProductListScreen)

Logic:
  - Debounce search input (300ms)
  - Gọi GET /api/search với query params
  - Filter mở bottom sheet
```

### ConversationListScreen
```text
UI:
  - AppBar "Tin nhắn"
  - ListView các conversation

ConversationTile:
  - Avatar người kia
  - Tên người kia
  - Tên sản phẩm
  - Last message (1 dòng, có thể là "[Hình ảnh]")
  - Thời gian
  - Badge unread count

Tap → ChatDetailScreen

Empty state: "Chưa có cuộc trò chuyện nào"
```

### ChatDetailScreen
```text
UI:
  - AppBar:
    - Nút back
    - Tên người kia + trạng thái (online/offline nếu có)
    - Avatar người kia
    - Link đến sản phẩm
  - ListView tin nhắn (đảo ngược, scroll từ dưới lên)
  - ChatInputBar (TextField + nút gửi + nút đính kèm nếu có)

MessageBubble:
  - Bên phải (màu xanh): tin nhắn của mình
  - Bên trái (màu xám): tin nhắn của người kia
  - Hiển thị: nội dung, thời gian, trạng thái đã đọc
  - Nếu có risk warning → hiển thị warning banner

Logic:
  - Kết nối WebSocket khi vào màn hình
  - Load messages cũ qua REST (GET /api/conversations/{id}/messages)
  - Nhận message mới qua WebSocket (event: message_received)
  - Gửi message qua WebSocket (event: send_message)
  - Fallback REST nếu WebSocket không kết nối được
  - Tự động mark_read khi xem
  - Pagination load thêm khi scroll lên trên
```

### ProfileScreen
```text
UI:
  - Avatar (to, giữa)
  - Tên
  - Điểm uy tín (stars)
  - Trường / Khu vực
  - Bio
  - Stats row: Sản phẩm đã bán | Đánh giá | Yêu thích

Menu:
  - Sản phẩm của tôi
  - Yêu thích
  - Cài đặt thông báo
  - Chỉnh sửa hồ sơ
  - Đăng xuất

Admin (nếu role = admin):
  - Quản trị (mở AdminDashboardScreen)
```

### NotificationScreen
```text
UI:
  - AppBar "Thông báo"
  - Nút "Đánh dấu tất cả đã đọc"
  - ListView notifications

NotificationTile:
  - Icon theo type (chat, check, warning, system)
  - Title
  - Body
  - Thời gian

Tap → navigate theo data.type:
  - message_new → ChatDetailScreen
  - product_* → ProductDetailScreen
  - report_resolved → ReportScreen
  - system → không navigate

Unread notifications có background hơi khác màu / dot indicator
```

### ReportScreen
```text
UI:
  - Dropdown target_type (Sản phẩm / Người dùng)
  - Dropdown reason (Spam, Lừa đảo, Hàng cấm, Khác)
  - Description TextField
  - Button "Gửi báo cáo"

Nếu mở từ ProductDetailScreen → tự động fill target_type = product, target_id = product.id
```

---

## 9.5 Models

Ví dụ model product.dart:

```dart
class Product {
  final String id;
  final String? categoryId;
  final String title;
  final String description;
  final double price;
  final String condition;    // new, like_new, good, fair, poor
  final String status;       // active, hidden, sold, ...
  final String? location;
  final String? campus;
  final int riskScore;
  final int viewCount;
  final int favoriteCount;
  final DateTime? soldAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Relations (khi load detail)
  final Category? category;
  final UserBrief? seller;
  final List<ProductImage>? images;
  final bool isFavorited;

  // Computed
  String get conditionLabel {
    switch (condition) {
      case 'new': return 'Mới';
      case 'like_new': return 'Như mới';
      case 'good': return 'Tốt';
      case 'fair': return 'Dùng ổn';
      case 'poor': return 'Cũ';
      default: return condition;
    }
  }

  String get priceFormatted {
    // Format as VND
    return '${price.toStringAsFixed(0).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (m) => '.')}đ';
  }

  factory Product.fromJson(Map<String, dynamic> json) { ... }
}
```

---

## 9.6 Services

### ApiClient (Dio)

```dart
class ApiClient {
  late final Dio dio;

  ApiClient() {
    dio = Dio(BaseOptions(
      baseUrl: AppConfig.baseUrl,    // e.g. http://localhost:8080/api
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(AuthInterceptor());      // Thêm auth header
    dio.interceptors.add(LogInterceptor());        // Debug log
    dio.interceptors.add(ErrorInterceptor());      // Xử lý lỗi chung
  }
}

class AuthInterceptor extends Interceptor {
  @override
  void onRequest(options, handler) async {
    final token = await SecureStorage.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(error, handler) async {
    if (error.response?.statusCode == 401) {
      // Try refresh token
      final refreshed = await _tryRefreshToken();
      if (refreshed) {
        // Retry request
        ...
      } else {
        // Force logout
        ...
      }
    }
    handler.next(error);
  }
}
```

### AuthApi

```dart
class AuthApi {
  final ApiClient _client;
  AuthApi(this._client);

  Future<AuthResponse> login(String email, String password, String? deviceName) async { ... }
  Future<AuthResponse> register(String email, String password, String fullName, ...) async { ... }
  Future<UserMe> getMe() async { ... }
  Future<TokenPair> refreshToken(String refreshToken) async { ... }
  Future<void> logout(String refreshToken) async { ... }
}
```

### ProductApi

```dart
class ProductApi {
  final ApiClient _client;
  ProductApi(this._client);

  Future<PaginationResult<Product>> getProducts(ProductFilter filter) async { ... }
  Future<ProductDetail> getProduct(String id) async { ... }
  Future<Product> createProduct(CreateProductRequest req) async { ... }
  Future<Product> updateProduct(String id, UpdateProductRequest req) async { ... }
  Future<void> deleteProduct(String id) async { ... }
  Future<Product> markSold(String id) async { ... }
}
```

### UploadApi

```dart
class UploadApi {
  final ApiClient _client;
  UploadApi(this._client);

  Future<PresignResponse> getPresignedUrl(PresignRequest req) async { ... }
  Future<void> confirmUpload(ConfirmUploadRequest req) async { ... }
}
```

### R2UploadService

```dart
class R2UploadService {
  final UploadApi _uploadApi;

  Future<String> uploadProductImage(String productId, XFile imageFile, int sortOrder) async {
    // 1. Get presigned URL
    final presign = await _uploadApi.getPresignedUrl(PresignRequest(
      purpose: 'product_image',
      fileName: imageFile.name,
      contentType: imageFile.mimeType ?? 'image/jpeg',
      fileSize: await imageFile.length(),
      productId: productId,
    ));

    // 2. Upload directly to R2
    final uploadDio = Dio(); // No auth interceptor
    await uploadDio.put(
      presign.uploadUrl,
      data: await imageFile.readAsBytes(),
      options: Options(headers: presign.headers),
    );

    // 3. Confirm
    await _uploadApi.confirmUpload(ConfirmUploadRequest(
      objectKey: presign.objectKey,
      purpose: 'product_image',
      productId: productId,
      sortOrder: sortOrder,
    ));

    return presign.publicUrl;
  }
}
```

### WebSocketService

```dart
class WebSocketService {
  WebSocketChannel? _channel;
  final StreamController<ChatEvent> _eventController = StreamController.broadcast();

  Stream<ChatEvent> get events => _eventController.stream;

  Future<void> connect(String token) async {
    _channel = WebSocketChannel.connect(
      Uri.parse('${AppConfig.wsUrl}?token=$token'),
    );
    _channel!.stream.listen(_handleMessage);
  }

  void _handleMessage(dynamic data) {
    final json = jsonDecode(data);
    final event = ChatEvent.fromJson(json);
    _eventController.add(event);
  }

  void joinConversation(String conversationId) {
    _send({'event': 'join_conversation', 'data': {'conversation_id': conversationId}});
  }

  void sendMessage(String conversationId, String content, {String type = 'text'}) {
    _send({'event': 'send_message', 'data': {'conversation_id': conversationId, 'content': content, 'message_type': type}});
  }

  void markRead(String conversationId) {
    _send({'event': 'mark_read', 'data': {'conversation_id': conversationId}});
  }

  void _send(Map<String, dynamic> data) {
    _channel?.sink.add(jsonEncode(data));
  }

  void disconnect() {
    _channel?.sink.close();
  }
}
```

### FCMService

```dart
class FCMService {
  final NotificationApi _notificationApi;

  Future<void> init() async {
    // Request permission
    await FirebaseMessaging.instance.requestPermission();

    // Get FCM token
    final token = await FirebaseMessaging.instance.getToken();
    if (token != null) {
      await _notificationApi.saveDeviceToken(token, Platform.isAndroid ? 'android' : 'ios');
    }

    // Listen for token refresh
    FirebaseMessaging.instance.onTokenRefresh.listen((newToken) async {
      await _notificationApi.saveDeviceToken(newToken, Platform.isAndroid ? 'android' : 'ios');
    });

    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      // Show local notification or in-app banner
      _showLocalNotification(message);
    });

    // Handle background tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleNotificationTap(message.data);
    });

    // Handle app opened from terminated state
    final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage.data);
    }
  }

  void _handleNotificationTap(Map<String, dynamic> data) {
    final type = data['type'];
    // Use GoRouter to navigate based on type
    // router.go('/chats/${data['conversation_id']}');
  }
}
```

---

## 9.7 App Lifecycle & Auth Flow

```text
App khởi động
    ↓
SplashScreen
    ↓
Kiểm tra access_token trong SecureStorage
    ↓
┌──── Có token? ──── Không → LoginScreen
│
↓ Có
Gọi GET /api/auth/me
    ↓
┌──── Token valid? ──── Không → Thử refresh token
│                                   ↓
│                              ┌── Refresh OK? ─── Không → LoginScreen
│                              │
│                              ↓ OK
│                              Lưu token mới
↓ Có                              ↓
HomeScreen ←──────────────────────┘
```

---

## 9.8 Packages Flutter khuyến nghị

```yaml
dependencies:
  flutter:
    sdk: flutter

  # Networking
  dio: ^5.x
  web_socket_channel: ^2.x

  # State management
  flutter_riverpod: ^2.x
  riverpod_annotation: ^2.x

  # Routing
  go_router: ^12.x

  # Storage
  flutter_secure_storage: ^9.x

  # Firebase
  firebase_core: ^2.x
  firebase_messaging: ^14.x

  # Image
  image_picker: ^1.x
  cached_network_image: ^3.x
  photo_view: ^0.x

  # UI
  shimmer: ^3.x              # Loading skeleton
  flutter_slidable: ^3.x     # Swipe actions
  timeago: ^3.x              # "3 phút trước"
  intl: ^0.x                 # Number formatting
  flutter_svg: ^2.x

  # Utils
  image_picker: ^1.x
  path_provider: ^2.x
  connectivity_plus: ^5.x
  package_info_plus: ^5.x

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.x
  build_runner: ^2.x
  riverpod_generator: ^2.x
  json_serializable: ^6.x
```

---

# 10. Backend folder structure

```text
backend/
├── main.go / index.js / app.py (tùy ngôn ngữ)
├── config/
│   ├── database.ts
│   ├── r2.ts
│   ├── fcm.ts
│   ├── ai.ts
│   └── app.ts
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.repository.ts
│   │   ├── auth.routes.ts
│   │   └── auth.middleware.ts (JWT guard)
│   ├── user/
│   │   ├── user.controller.ts
│   │   ├── user.service.ts
│   │   └── user.routes.ts
│   ├── product/
│   │   ├── product.controller.ts
│   │   ├── product.service.ts
│   │   ├── product.repository.ts
│   │   └── product.routes.ts
│   ├── upload/
│   │   ├── upload.controller.ts
│   │   ├── upload.service.ts   (R2 presign, confirm)
│   │   └── upload.routes.ts
│   ├── search/
│   │   ├── search.controller.ts
│   │   ├── search.service.ts
│   │   └── search.routes.ts
│   ├── chat/
│   │   ├── chat.controller.ts
│   │   ├── chat.service.ts
│   │   ├── chat.routes.ts
│   │   └── chat.websocket.ts   (WebSocket handler)
│   ├── notification/
│   │   ├── notification.controller.ts
│   │   ├── notification.service.ts
│   │   ├── notification.routes.ts
│   │   └── fcm.service.ts
│   ├── ai/
│   │   ├── ai.controller.ts
│   │   ├── ai.service.ts       (build prompt, call AI API, validate)
│   │   ├── ai.routes.ts
│   │   └── prompts/            (prompt templates)
│   ├── moderation/
│   │   ├── moderation.controller.ts
│   │   ├── moderation.service.ts
│   │   ├── moderation.routes.ts
│   │   └── moderation.rules.ts
│   └── admin/
│       ├── admin.controller.ts
│       ├── admin.service.ts
│       └── admin.routes.ts
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── queries/
├── middleware/
│   ├── auth.middleware.ts
│   ├── error.middleware.ts
│   └── validation.middleware.ts
└── utils/
    ├── jwt.ts
    ├── password.ts
    ├── pagination.ts
    └── response.ts
```

---

# 11. Thứ tự triển khai khuyến nghị (6 tuần)

## Tuần 1: Setup + Auth
```text
Backend:
- Init project, database connection
- Migrations: users, profiles, sessions
- Auth module: register, login, JWT, refresh, me

Flutter:
- Init Flutter project, theme, routing
- SplashScreen, LoginScreen, RegisterScreen
- AuthService, SecureStorage, ApiClient
```

## Tuần 2: Product + Category + Upload
```text
Backend:
- Migrations: categories, products, product_images, upload_files
- Category CRUD + seed data
- Product CRUD
- Upload R2 presign/confirm

Flutter:
- ProductListScreen, ProductDetailScreen
- CreateProductScreen (basic, chưa AI)
- Upload ảnh qua R2
- Category chips
```

## Tuần 3: Search + Profile + Favorite
```text
Backend:
- Search API
- Profile API
- Favorite API

Flutter:
- SearchScreen + filter
- ProfileScreen, EditProfileScreen
- MyProductsScreen
- FavoriteScreen
```

## Tuần 4: Chat + Notification
```text
Backend:
- Migrations: conversations, messages, notifications, device_tokens
- Chat REST API
- WebSocket server
- FCM integration

Flutter:
- ConversationListScreen, ChatDetailScreen
- WebSocket service
- FCM service
- NotificationScreen
```

## Tuần 5: AI + Moderation
```text
Backend:
- AI module: generate-listing, suggest-category, suggest-price, moderate-content
- AI logs
- Moderation rules
- Moderation queue

Flutter:
- AI integration trong CreateProductScreen
- AI suggest price trong ProductDetailScreen (nếu là chủ)

```

## Tuần 6: Report + Admin + Testing
```text
Backend:
- Migrations: reports, moderation_queue, moderation_actions, reviews
- Report API
- Review API
- Admin APIs

Flutter:
- ReportScreen
- ReviewScreen
- AdminDashboardScreen + admin sub-screens
- Testing, bug fixes
- Demo data
```

---

# 12. Bản MVP tối thiểu (nếu rút gọn)

Làm trước:
```text
1. Auth: register/login/me
2. Profile: get/update
3. Product: list/detail/create/update/delete
4. R2 upload ảnh sản phẩm
5. Search/filter cơ bản (ILIKE)
6. Favorite
7. Chat REST + WebSocket realtime
8. FCM push notification cho tin nhắn
9. AI generate listing
10. Report sản phẩm
```

Để sau:
```text
- Student email verification
- Review user
- AI usage tracking dashboard
- AI prompts management
- Semantic search
- Admin dashboard đẹp
- Chat image upload
- Report attachment upload
- Notification preferences
```

---

# 13. Kết luận

Tài liệu này cung cấp thiết kế chi tiết cho MVP app chợ đồ cũ sinh viên, bao gồm:

```text
- Database schema PostgreSQL (18 bảng)
- API endpoints (50+ endpoints)
- Upload ảnh Cloudflare R2
- Chat realtime WebSocket
- Push notification Firebase Cloud Messaging
- AI Service
- Moderation/report/admin
- Flutter app (folder structure, routing, state, screens, services)
- Kế hoạch triển khai 6 tuần
```

Công nghệ chính:
```text
Mobile: Flutter
Backend: REST API + WebSocket (modular monolith)
Database: PostgreSQL
Storage: Cloudflare R2
Notification: Firebase Cloud Messaging
AI: AI API (qua AI Service)
```
