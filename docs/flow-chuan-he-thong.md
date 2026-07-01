# Luồng flow chuẩn toàn bộ hệ thống — Chợ đồ cũ sinh viên

---

## Tổng quan các kênh giao tiếp

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Flutter App                               │
└────────────┬──────────────┬──────────────┬──────────────────────┘
             │              │              │
             ▼              ▼              ▼
       HTTP/HTTPS      WebSocket      Firebase FCM
       (REST API)      (Chat realtime) (Push notify)
             │              │              │
             ▼              ▼              │
      ┌──────────────┐ ┌──────────┐       │
      │ API Gateway  │ │  Chat    │       │
      │   (Go)       │ │  Service │       │
      │   Port 8080  │ │  Port    │       │
      │              │ │  3005    │       │
      └──────┬───────┘ └────┬─────┘       │
             │              │             │
    ┌────────┼──────────────┼─────────────┘
    │        ▼              ▼
    │  ┌──────────────────────────────┐
    │  │        Backend Services       │
    │  │  Auth | User | Product        │
    │  │  Search | AI | Moderation     │
    │  │  Notification | Admin         │
    │  └──────────────┬───────────────┘
    │                 │
    │    ┌────────────┼────────────┐
    │    ▼            ▼            ▼
    │  REST        RabbitMQ      REST
    │  (sync)      (async)       (sync)
    │    │            │            │
    │    ▼            ▼            ▼
    │  Service A   Events       Service B
    │  ──gọi──→   queue        ←──nhận──
    │
    ▼
┌──────────────────────────────────────────────────────┐
│                  Infrastructure                       │
│  PostgreSQL (7 DBs)  │  Redis  │  RabbitMQ           │
│  Cloudflare R2       │  Firebase FCM                 │
└──────────────────────────────────────────────────────┘
```

---

## Flow 0: Đăng ký + Đăng nhập

### 0.1 Đăng ký tài khoản

```text
Flutter App
  │
  │  POST /api/auth/register
  │  { email, password, full_name }
  │
  ▼
API Gateway (port 8080)
  │
  │  Route /api/auth/* → Auth Service (3001)
  │  Public route, không check JWT
  │
  ▼
Auth Service (Go, port 3001)
  │
  ├─ 1. Validate input (email format, password >= 6 ký tự)
  │
  ├─ 2. Kiểm tra email đã tồn tại chưa?
  │     SELECT FROM auth_db.users WHERE email = ?
  │     Nếu có → trả lỗi EMAIL_ALREADY_EXISTS
  │
  ├─ 3. Hash password bằng bcrypt
  │
  ├─ 4. INSERT vào auth_db.users
  │     { email, password_hash, role: "user", status: "active" }
  │
  ├─ 5. Generate JWT access_token (15 phút) + refresh_token (7 ngày)
  │
  ├─ 6. Publish event "user.registered" lên RabbitMQ
  │     Exchange: hieusoft.events
  │     Routing key: user.registered
  │
  ├─ 7. Gọi REST sang User Service
  │     POST http://user-service:3002/api/internal/profiles
  │     { user_id, full_name }
  │
  └─ 8. Trả response về Flutter
       { user, tokens: {access_token, refresh_token} }
```

### 0.2 User Service nhận tạo profile (REST đồng bộ)

```text
Auth Service
  │
  │  POST http://user-service:3002/api/internal/profiles
  │  (gọi trực tiếp, không qua Gateway, không qua RabbitMQ)
  │
  ▼
User Service (Node.js, port 3002)
  │
  ├─ INSERT INTO user_db.profiles
  │   { user_id, full_name }
  │
  └─ Trả OK
```

### 0.3 Notification Service nhận event bất đồng bộ

```text
RabbitMQ
  │
  │  Event: user.registered
  │  Routing key: user.registered
  │
  ▼
Notification Service (Node.js, port 3006) — Consumer
  │
  ├─ (Optional MVP) Gửi email welcome
  └─ Không làm gì nếu chưa cần
```

### 0.4 Đăng nhập

```text
Flutter App
  │
  │  POST /api/auth/login
  │  { email, password }
  │
  ▼
API Gateway
  │  Public route
  ▼
Auth Service
  │
  ├─ 1. Tìm user theo email trong auth_db.users
  │     Nếu không có → INVALID_CREDENTIALS
  │
  ├─ 2. Check status
  │     banned → USER_BANNED
  │     inactive → USER_INACTIVE
  │
  ├─ 3. So sánh password với bcrypt hash
  │     Sai → INVALID_CREDENTIALS
  │
  ├─ 4. Generate JWT access_token + refresh_token
  │
  ├─ 5. Lưu session vào auth_db.sessions
  │     { user_id, refresh_token_hash, device_info }
  │
  ├─ 6. Update last_login_at
  │
  └─ 7. Trả response
       { user, tokens: {access_token, refresh_token} }

Flutter App
  │
  ├─ Lưu access_token vào SecureStorage
  ├─ Lưu refresh_token vào SecureStorage
  └─ Lưu FCM token lên server
       POST /api/notifications/device-token
       { token, platform: "android"|"ios" }
```

---

## Flow 1: Đăng sản phẩm mới (có AI hỗ trợ + upload ảnh R2)

Đây là flow phức tạp nhất, chia 3 bước: AI gợi ý → Upload ảnh → Tạo sản phẩm.

### Bước 1: AI gợi ý nội dung

```text
Flutter App (CreateProductScreen)
  │
  │  User nhập mô tả thô: "máy tính casio 580 còn tốt, bán 450k"
  │  User bấm "Dùng AI tạo nội dung"
  │
  │  POST /api/ai/generate-listing
  │  Authorization: Bearer <token>
  │  { raw_description, expected_price }
  │
  ▼
API Gateway
  │  Verify JWT
  │  Route /api/ai/* → AI Service (3007)
  │  Set header X-User-Id
  │
  ▼
AI Service (Python FastAPI, port 3007)
  │
  ├─ 1. Lấy prompt template từ ai_db.ai_prompts
  │     WHERE task_type = 'generate_listing' AND is_active = true
  │
  ├─ 2. Build prompt với raw_description + expected_price
  │
  ├─ 3. Gọi AI API (OpenAI / Claude / etc.)
  │     POST https://api.openai.com/v1/chat/completions
  │
  ├─ 4. Parse response JSON
  │     { title, description, category_slug, condition_suggestion,
  │       price_suggestion: {min, max, reason} }
  │
  ├─ 5. Validate output
  │     - title không rỗng, < 255 ký tự
  │     - category_slug phải tồn tại trong product_db.categories
  │     - condition_suggestion phải hợp lệ
  │
  ├─ 6. INSERT vào ai_db.ai_logs
  │     { user_id, task_type, input, output, model, tokens, latency }
  │
  └─ 7. Trả kết quả về Flutter
       { title, description, category_slug, condition_suggestion, price_suggestion }
```

### Bước 2: Upload ảnh lên Cloudflare R2

```text
Flutter App
  │
  │  User chọn ảnh từ thư viện (có thể chọn nhiều ảnh)
  │  Với mỗi ảnh, lặp:
  │
  ├──► POST /api/uploads/presign
  │    Authorization: Bearer <token>
  │    { purpose: "product_image", file_name: "laptop.jpg",
  │      content_type: "image/jpeg", file_size: 1024000,
  │      product_id: "optional_or_null" }
  │
  ▼
API Gateway → Product Service (3003)
  │
  ├─ 1. Validate: content_type là image/jpeg|png|webp, file_size < 5MB
  │
  ├─ 2. Tạo object_key: products/{user_id}/{uuid}.jpg
  │
  ├─ 3. INSERT upload_files (status = "pending")
  │     { owner_id, object_key, purpose, file_name, content_type }
  │
  ├─ 4. Gọi Cloudflare R2 SDK tạo presigned upload URL (PUT, 5 phút hết hạn)
  │
  └─ 5. Trả về Flutter
       { upload_url, object_key, public_url }

Flutter App
  │
  │  PUT {upload_url}
  │  Body: binary file data
  │  Header: Content-Type = image/jpeg
  │
  │  (Upload TRỰC TIẾP lên R2, không qua backend)
  │
  │  Upload thành công →
  │
  ├──► POST /api/uploads/confirm
  │    Authorization: Bearer <token>
  │    { object_key, purpose: "product_image", sort_order: 1 }
  │
  ▼
Product Service
  │
  ├─ 1. HEAD request lên R2 để verify object tồn tại
  │
  ├─ 2. UPDATE upload_files SET status = "linked"
  │
  └─ 3. Nếu product đã được tạo → INSERT product_images
       Nếu chưa → Flutter sẽ gửi kèm object_keys khi tạo product

Flutter App
  │
  └─ Lưu object_keys vào state để gửi khi tạo product
```

### Bước 3: Tạo sản phẩm

```text
Flutter App
  │
  │  User đã xem gợi ý AI, đã chỉnh sửa, đã upload ảnh
  │  User bấm "Đăng sản phẩm"
  │
  │  POST /api/products
  │  Authorization: Bearer <token>
  │  {
  │    category_id, title, description, price, condition,
  │    location, campus,
  │    images: [{object_key, sort_order}, ...]
  │  }
  │
  ▼
API Gateway → Product Service (3003)
  │
  ├─ 1. Validate: title, price > 0, condition hợp lệ, category tồn tại
  │
  ├─ 2. INSERT product_db.products
  │     { seller_id, category_id, title, description, price, condition,
  │       status: "pending_check", location, campus }
  │
  ├─ 3. INSERT product_db.product_images
  │     Với mỗi ảnh: { product_id, object_key, image_url, sort_order }
  │
  ├─ 4. UPDATE product_db.upload_files SET status = "linked"
  │     WHERE object_key IN (...)
  │
  ├─ 5. Publish event "product.created" vào RabbitMQ
  │     Exchange: hieusoft.events
  │     Routing key: product.created
  │     Payload: { product_id, seller_id, title, category_id, price, status }
  │
  └─ 6. Trả response cho Flutter
       { id, status: "pending_check", message: "Sản phẩm đang chờ duyệt" }
```

### Bước 4: Moderation Service xử lý bất đồng bộ

```text
RabbitMQ
  │
  │  Event: product.created
  │
  ▼
Moderation Service (Python FastAPI, port 3008) — Consumer
  │
  ├─ 1. Nhận event từ queue "moderation-service-queue"
  │
  ├─ 2. Lấy thông tin sản phẩm từ Product Service
  │     GET http://product-service:3003/api/internal/products/{product_id}
  │     (REST gọi trực tiếp, không qua Gateway)
  │
  ├─ 3. Chạy rule-based check nhanh:
  │     - Từ khóa cấm (số đề, chất cấm, ...)
  │     - Giá quá thấp/cao bất thường
  │     - Mô tả chứa link ngoài, SĐT
  │     - Tài khoản mới tạo (< 24h) đăng sản phẩm giá cao
  │
  ├─ 4. Nếu rule check không kết luận được → gọi AI
  │     POST http://ai-service:3007/api/ai/moderate-content
  │     { target_type: "product", content: {title, description, price} }
  │
  ├─ 5. AI Service xử lý (Flow 7)
  │     Trả về: { risk_score, risk_level, signals, action }
  │
  ├─ 6. Quyết định dựa trên risk_level:
  │     ┌─────────────────────────────────────────────┐
  │     │ risk < 30  → action = "allow"               │
  │     │ risk 30-60 → action = "warn"                │
  │     │ risk 60-80 → action = "review" (đưa admin)  │
  │     │ risk > 80  → action = "hide"                │
  │     └─────────────────────────────────────────────┘
  │
  ├─ 7. Gọi REST sang Product Service cập nhật
  │     PATCH http://product-service:3003/api/internal/products/{id}/status
  │     { status: "active" | "pending_review" | "hidden" }
  │
  ├─ 8. Nếu cần admin → INSERT moderation_db.moderation_queue
  │     { target_type: "product", target_id, risk_score, signals }
  │
  └─ 9. Publish event "notification.requested"
        { user_id: seller_id, type: "product_approved"|"product_hidden",
          title, body, data: {product_id} }
```

### Bước 5: Notification Service xử lý

```text
RabbitMQ
  │
  │  Event: notification.requested
  │
  ▼
Notification Service (Node.js, port 3006) — Consumer
  │
  ├─ 1. INSERT notification_db.notifications
  │     { user_id, type, title, body, data }
  │
  ├─ 2. Lấy device_tokens của user
  │     SELECT FROM notification_db.device_tokens
  │     WHERE user_id = ? AND is_active = true
  │
  └─ 3. Gọi Firebase Admin SDK gửi push
        {
          notification: { title, body },
          data: { type, product_id, click_action: "FLUTTER_NOTIFICATION_CLICK" }
        }
       ↓
      FCM → Điện thoại User
      User bấm notification → Flutter mở ProductDetailScreen
```

---

## Flow 2: Duyệt sản phẩm + Tìm kiếm

```text
Flutter App (HomeScreen / ProductListScreen)
  │
  │  GET /api/products?page=1&limit=20&category_id=&sort=newest
  │  (Có thể không cần auth)
  │
  ▼
API Gateway → Product Service (3003)
  │
  ├─ 1. SELECT * FROM product_db.products
  │     WHERE status = 'active' AND deleted_at IS NULL
  │     [AND category_id = ?] [AND condition = ?] [AND campus = ?]
  │     ORDER BY created_at DESC
  │     LIMIT 20 OFFSET 0
  │
  ├─ 2. JOIN với product_db.product_images
  │     để lấy thumbnail (sort_order = 1)
  │
  ├─ 3. Với mỗi product, lấy thông tin seller từ User Service
  │     (Có thể cache/batch để giảm request)
  │     GET http://user-service:3002/api/internal/profiles/{seller_id}
  │
  └─ 4. Trả response
       {
         items: [{ id, title, price, thumbnail_url, seller, ... }],
         pagination: { page, limit, total, total_pages }
       }
```

### Tìm kiếm

```text
Flutter App (SearchScreen)
  │
  │  GET /api/search?q=casio&category_id=&min_price=&max_price=&condition=&sort=newest
  │
  ▼
API Gateway → Search Service (3004)
  │
  ├─ 1. Query product_db (read-only)
  │     SELECT * FROM product_db.products
  │     WHERE status = 'active' AND deleted_at IS NULL
  │     AND (title ILIKE '%casio%' OR description ILIKE '%casio%')
  │     [AND price BETWEEN min AND max] [AND condition = ?]
  │
  ├─ 2. (Future) Nếu có AI parse intent:
  │     POST http://ai-service:3007/api/ai/parse-search
  │     { query: "tìm laptop học code dưới 10 triệu" }
  │     → { category, max_price, keywords }
  │
  └─ 3. Trả kết quả + enrich với seller info từ User Service
```

---

## Flow 3: Xem chi tiết sản phẩm

```text
Flutter App (ProductDetailScreen)
  │
  │  GET /api/products/{id}
  │
  ▼
API Gateway → Product Service (3003)
  │
  ├─ 1. SELECT product + JOIN category + JOIN product_images
  │     FROM product_db (products, categories, product_images)
  │
  ├─ 2. GET seller info từ User Service
  │     GET http://user-service:3002/api/internal/profiles/{seller_id}
  │
  ├─ 3. Kiểm tra user hiện tại đã favorite chưa
  │     SELECT FROM product_db.favorites
  │     WHERE user_id = ? AND product_id = ?
  │     → is_favorited: true/false
  │
  ├─ 4. Tăng view_count
  │     UPDATE product_db.products SET view_count = view_count + 1
  │
  └─ 5. Trả response đầy đủ
       {
         product detail + seller info + images + is_favorited +
         related_products (optional)
       }
```

---

## Flow 4: Chat realtime giữa Buyer và Seller (WebSocket)

Đây là flow chat — **dùng WebSocket, không qua HTTP**.

### 4.1 Khởi tạo cuộc trò chuyện

```text
Flutter App (ProductDetailScreen)
  │
  │  User (Buyer) bấm "Chat với người bán"
  │
  ├──► POST /api/conversations  (REST, tạo conversation)
  │    Authorization: Bearer <token>
  │    { product_id }
  │
  ▼
API Gateway → Chat Service (3005)
  │
  ├─ 1. Lấy seller_id từ product (gọi Product Service internal)
  │
  ├─ 2. Check: buyer không được chat với chính mình
  │
  ├─ 3. Tìm conversation đã tồn tại
  │     SELECT FROM chat_db.conversations
  │     WHERE product_id = ? AND buyer_id = ? AND seller_id = ?
  │
  ├─ 4. Nếu chưa có → INSERT conversation mới
  │     { product_id, buyer_id, seller_id }
  │
  └─ 5. Trả { conversation_id }

Flutter App
  │
  └─ Nhận conversation_id → Mở ChatDetailScreen
```

### 4.2 Kết nối WebSocket + Gửi/Nhận tin nhắn

```text
Flutter App (ChatDetailScreen)
  │
  │  Kết nối WebSocket:
  │  ws://host:8080/ws?token=<access_token>
  │
  ▼
API Gateway
  │
  │  WebSocket proxy thẳng → Chat Service (3005)
  │
  ▼
Chat Service (Go, port 3005) — WebSocket Handler
  │
  ├─ 1. Verify JWT từ query param "token"
  │
  ├─ 2. Đăng ký client vào Hub (in-memory connection pool)
  │     Hub: map[user_id] → *WebSocketConn
  │
  ├─ 3. Client gửi event "join_conversation"
  │
  ├─ 4. Load 30 tin nhắn gần nhất từ chat_db.messages
  │     SELECT FROM chat_db.messages
  │     WHERE conversation_id = ? AND deleted_at IS NULL
  │     ORDER BY created_at DESC LIMIT 30
  │     → Trả ngược lại cho client qua WS
  │
  │
  │  ╔═══════════════════════════════════════════╗
  │  ║  REALTIME CHAT LOOP                       ║
  │  ╚═══════════════════════════════════════════╝
  │
  │  Buyer gửi tin nhắn:
  │
  │  Flutter ──WebSocket──→ Chat Service
  │  {
  │    "event": "send_message",
  │    "data": {
  │      "conversation_id": "uuid",
  │      "content": "Còn bán không bạn?",
  │      "message_type": "text"
  │    }
  │  }
  │
  ▼
Chat Service
  │
  ├─ 1. Validate: conversation tồn tại, sender là buyer/seller
  │
  ├─ 2. INSERT vào chat_db.messages
  │     { conversation_id, sender_id, content, message_type }
  │
  ├─ 3. Cập nhật conversation
  │     UPDATE chat_db.conversations
  │     SET last_message_id = ?, last_message_at = now(),
  │         buyer_unread_count = buyer_unread_count + 1 (nếu sender là seller)
  │         hoặc seller_unread_count = seller_unread_count + 1 (nếu sender là buyer)
  │
  ├─ 4. Gửi realtime cho người nhận (nếu đang online)
  │     │
  │     │  Chat Service kiểm tra Hub:
  │     │  receiver_id có trong Hub.connections không?
  │     │
  │     ├─ CÓ (online):
  │     │    ──WebSocket──→ Flutter của Receiver
  │     │    {
  │     │      "event": "message_received",
  │     │      "data": {
  │     │        "id": "msg_uuid",
  │     │        "conversation_id": "...",
  │     │        "sender_id": "buyer_uuid",
  │     │        "content": "Còn bán không bạn?",
  │     │        "message_type": "text",
  │     │        "created_at": "2026-07-01T12:00:00Z"
  │     │      }
  │     │    }
  │     │
  │     └─ KHÔNG (offline):
  │          → Publish event "message.sent" lên RabbitMQ
  │            Exchange: hieusoft.events
  │            Routing key: message.sent
  │
  ├─ 5. Trả ack cho người gửi
  │    ──WebSocket──→ Flutter của Sender
  │    {
  │      "event": "message_sent_ack",
  │      "data": { "message_id": "uuid", "timestamp": "..." }
  │    }
  │
  └─ 6. (Async) Publish event "message.sent" lên RabbitMQ
        để Notification Service gửi FCM push
        ── luôn publish để Notification Service xử lý push
```

### 4.3 Notification Service xử lý push cho tin nhắn

```text
RabbitMQ
  │  Event: message.sent
  │  { message_id, conversation_id, sender_id, receiver_id, content }
  │
  ▼
Notification Service (Node.js, port 3006) — Consumer
  │
  ├─ 1. Lấy tên người gửi từ User Service
  │     GET http://user-service:3002/api/internal/profiles/{sender_id}
  │
  ├─ 2. INSERT notification_db.notifications
  │     { user_id: receiver_id, type: "message_new",
  │       title: "Tin nhắn mới",
  │       body: "{sender_name} đã nhắn tin về {product_title}",
  │       data: { conversation_id, product_id, sender_id } }
  │
  ├─ 3. Lấy FCM tokens của receiver
  │     SELECT FROM notification_db.device_tokens
  │     WHERE user_id = receiver_id AND is_active = true
  │
  └─ 4. Gửi FCM push đến từng token
       Firebase Admin SDK
       ↓
       FCM → Điện thoại Receiver
       Rung/ring thông báo
       User bấm → Flutter mở ChatDetailScreen(conversation_id)
```

### 4.4 Người nhận online: mark read

```text
Flutter của Receiver (đang mở ChatDetailScreen)
  │
  │  Khi xem tin nhắn → tự động gửi:
  │  {
  │    "event": "mark_read",
  │    "data": { "conversation_id": "uuid" }
  │  }
  │
  ▼
Chat Service
  │
  ├─ UPDATE chat_db.messages
  │   SET is_read = true, read_at = now()
  │   WHERE conversation_id = ? AND sender_id != current_user AND is_read = false
  │
  ├─ UPDATE chat_db.conversations
  │   SET buyer_unread_count = 0 (nếu current_user là buyer)
  │   hoặc seller_unread_count = 0 (nếu current_user là seller)
  │
  └─ Gửi WebSocket cho sender biết tin nhắn đã đọc (optional)
       {
         "event": "message_read",
         "data": { "conversation_id": "...", "read_by": "receiver_uuid" }
       }
```

### 4.5 WebSocket Events tổng hợp

```text
╔══════════════════════════════════════════════════════════════╗
║              WebSocket Events (Chat Service)                 ║
╠══════════════╦═══════════════╦═══════════════════════════════╣
║ Direction    ║ Event         ║ Mô tả                         ║
╠══════════════╬═══════════════╬═══════════════════════════════╣
║ Client→Server║ join_conv     ║ Tham gia phòng chat           ║
║ Client→Server║ send_message  ║ Gửi tin nhắn                  ║
║ Client→Server║ mark_read     ║ Đánh dấu đã đọc               ║
║ Client→Server║ leave_conv    ║ Rời phòng chat                 ║
║ Client→Server║ load_more     ║ Load tin nhắn cũ hơn (scroll) ║
║ Server→Client║ message_recv  ║ Có tin nhắn mới               ║
║ Server→Client║ message_ack   ║ Xác nhận đã gửi               ║
║ Server→Client║ message_read  ║ Người kia đã đọc              ║
║ Server→Client║ risk_warning  ║ Cảnh báo scam trong chat      ║
║ Server→Client║ user_online   ║ Người kia online/offline      ║
╚══════════════╩═══════════════╩═══════════════════════════════╝
```

---

## Flow 5: Report sản phẩm + Admin xử lý

### 5.1 User report sản phẩm

```text
Flutter App (ProductDetailScreen)
  │
  │  User bấm "Báo cáo" → ReportScreen
  │
  │  POST /api/reports
  │  Authorization: Bearer <token>
  │  { target_type: "product", target_id, reason: "scam", description }
  │
  ▼
API Gateway → Moderation Service (3008)
  │
  ├─ 1. INSERT moderation_db.reports
  │     { reporter_id, target_type, target_id, reason, description }
  │
  ├─ 2. Đếm số report của target này
  │     SELECT COUNT(*) FROM reports
  │     WHERE target_type = ? AND target_id = ? AND status = 'pending'
  │
  ├─ 3. Nếu số report >= 3 HOẶC reason nghiêm trọng → tạo moderation_queue
  │     INSERT moderation_db.moderation_queue
  │     { target_type, target_id, risk_score, risk_level, signals, status: "pending" }
  │
  ├─ 4. Publish event "notification.requested"
  │     (báo admin có report mới)
  │
  └─ 5. Trả response
       { id, status: "pending", message: "Cảm ơn bạn đã báo cáo" }
```

### 5.2 Admin xem moderation queue

```text
Admin Web/Mobile
  │
  │  GET /api/admin/moderation/queue?status=pending&risk_level=high
  │
  ▼
API Gateway → Admin Service (3009)
  │
  ├─ 1. Admin Service gọi Moderation Service
  │     GET http://moderation-service:3008/api/internal/queue
  │
  └─ 2. Moderation Service query moderation_db
        SELECT * FROM moderation_queue
        WHERE status = ? [AND risk_level = ?]
        ORDER BY risk_score DESC, created_at ASC
```

### 5.3 Admin xử lý

```text
Admin bấm "Ẩn sản phẩm"
  │
  │  POST /api/admin/moderation/{queue_id}/action
  │  { action: "hide", note: "Sản phẩm có dấu hiệu lừa đảo" }
  │
  ▼
API Gateway → Admin Service → Moderation Service
  │
  ├─ 1. INSERT moderation_db.moderation_actions
  │     { admin_id, target_type, target_id, action, note }
  │
  ├─ 2. UPDATE moderation_db.moderation_queue
  │     SET status = 'resolved', assigned_admin_id = ?, resolved_at = now()
  │
  ├─ 3. Gọi Product Service cập nhật trạng thái
  │     PATCH http://product-service:3003/api/internal/products/{id}/status
  │     { status: "hidden" }
  │
  ├─ 4. UPDATE moderation_db.reports
  │     SET status = 'resolved', resolved_at = now()
  │     WHERE target_id = ?
  │
  ├─ 5. Publish event "notification.requested"
  │     Báo seller: "Sản phẩm của bạn đã bị ẩn vì {reason}"
  │
  └─ 6. Trả response OK

Product Service nhận REST từ Moderation
  │
  └─ UPDATE product_db.products SET status = 'hidden'

Notification Service xử lý push
  │
  └─ FCM → Seller: "Sản phẩm {title} đã bị ẩn"
```

---

## Flow 6: Review sau giao dịch

```text
Flutter App
  │
  │  Sau khi giao dịch hoàn tất
  │  User đánh giá người kia
  │
  │  POST /api/users/{user_id}/reviews
  │  Authorization: Bearer <token>
  │  { product_id, rating: 5, comment: "Thân thiện, hàng đúng mô tả" }
  │
  ▼
API Gateway → User Service (3002)
  │
  ├─ 1. Check: reviewer và reviewed_user đều liên quan đến product
  │     (seller hoặc buyer)
  │
  ├─ 2. Check: chưa review cho cặp (reviewer, reviewed_user, product) này
  │
  ├─ 3. INSERT user_db.reviews
  │     { reviewer_id, reviewed_user_id, product_id, rating, comment }
  │
  ├─ 4. Cập nhật điểm uy tín
  │     UPDATE user_db.profiles
  │     SET reputation_score = (
  │       SELECT AVG(rating) FROM reviews WHERE reviewed_user_id = ?
  │     ), total_reviews = total_reviews + 1
  │
  └─ 5. Trả response
       { id, message: "Đánh giá thành công" }
```

---

## Flow 7: AI Moderate (được gọi từ Moderation Service)

```text
Moderation Service
  │
  │  POST http://ai-service:3007/api/ai/moderate-content
  │  { target_type, target_id, content: {title, description, price} }
  │
  ▼
AI Service (Python, port 3007)
  │
  ├─ 1. Lấy prompt template từ ai_db.ai_prompts
  │     WHERE task_type = 'moderate_product'
  │
  ├─ 2. Build prompt với nội dung sản phẩm + thông tin seller
  │     (gọi User Service nếu cần thông tin seller)
  │
  ├─ 3. Gọi AI API
  │
  ├─ 4. Parse response JSON
  │     { risk_score: 0-100, risk_level, signals: [...], action }
  │
  ├─ 5. INSERT ai_db.ai_logs
  │
  └─ 6. Trả kết quả cho Moderation Service
```

---

## Flow 8: Favorite / Yêu thích

```text
Flutter App
  │
  │  POST /api/products/{id}/favorite     (thêm)
  │  DELETE /api/products/{id}/favorite   (bỏ)
  │
  ▼
API Gateway → Product Service (3003)
  │
  ├─ INSERT/DELETE product_db.favorites
  │
  ├─ UPDATE product_db.products
  │   SET favorite_count = favorite_count +/- 1
  │
  └─ Trả { is_favorited: true/false, favorite_count: N }

Flutter App
  │
  │  GET /api/me/favorites
  │
  ▼
Product Service
  │
  └─ SELECT products JOIN favorites
       WHERE favorites.user_id = ?
       ORDER BY favorites.created_at DESC
```

---

## Flow 9: Notification tổng hợp

```text
╔═══════════════════════════════════════════════════════════════╗
║       Tất cả các điểm gửi notification trong hệ thống         ║
╠══════════════════════╦════════════╦═══════════════════════════╣
║ Trigger              ║ Type       ║ Người nhận               ║
╠══════════════════════╬════════════╬═══════════════════════════╣
║ Có tin nhắn mới      ║ msg_new    ║ Receiver (FCM push)      ║
║ SP được duyệt        ║ prd_ok     ║ Seller (FCM)             ║
║ SP bị ẩn/từ chối     ║ prd_hide   ║ Seller (FCM)             ║
║ Có người yêu thích   ║ prd_like   ║ Seller (in-app)          ║
║ Report được xử lý    ║ rpt_done   ║ Reporter (in-app)        ║
║ Cảnh báo rủi ro      ║ risk       ║ Buyer/Seller (FCM+inapp) ║
║ Admin có việc mới    ║ adm_new    ║ Admin (in-app)           ║
║ Đăng ký thành công   ║ welcome    ║ New user (email/push)    ║
╚══════════════════════╩════════════╩═══════════════════════════╝

Cơ chế gửi notification:
  - Bất kỳ service nào cũng có thể publish event "notification.requested"
  - Notification Service consume event → lưu DB + gửi FCM
  - Flutter cũng poll GET /api/notifications để hiển thị in-app
```

---

## Flow 10: Tổng quan RabbitMQ Events

```text
╔══════════════════════════════════════════════════════════════════╗
║              RabbitMQ Events — MVP chỉ dùng 3 event             ║
╠══════════════╦══════════════╦══════════════╦════════════════════╣
║ Event        ║ Publisher    ║ Consumer(s)  ║ Mục đích           ║
╠══════════════╬══════════════╬══════════════╬════════════════════╣
║ message.sent ║ Chat Service ║ Notification ║ Push FCM cho       ║
║              ║              ║ Service      ║ receiver offline   ║
╠══════════════╬══════════════╬══════════════╬════════════════════╣
║ product.     ║ Product      ║ Moderation   ║ Auto-kiểm duyệt    ║
║ created      ║ Service      ║ Service      ║ sản phẩm mới       ║
╠══════════════╬══════════════╬══════════════╬════════════════════╣
║ notification ║ Bất kỳ       ║ Notification ║ Gửi push/in-app    ║
║ .requested   ║ service nào  ║ Service      ║ notification       ║
╚══════════════╩══════════════╩══════════════╩════════════════════╝

Các tương tác còn lại → REST trực tiếp:
  - Auth → User Service: tạo profile (POST /api/internal/profiles)
  - Moderation → Product Service: cập nhật status (PATCH /api/internal/products/:id/status)
  - Moderation → AI Service: kiểm tra nội dung (POST /api/ai/moderate-content)
  - Product → AI Service: gợi ý listing (POST /api/ai/generate-listing)
  - Chat → User Service: lấy tên người dùng (GET /api/internal/profiles/:id)
  - Admin → Moderation Service: lấy queue (GET /api/internal/queue)
```

---

## Tổng kết: Giao tiếp giữa các service

```text
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│          │ Gateway  │ Auth     │ User     │ Product  │ Search   │ Chat     │ AI       │ Mod      │ Notif    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Gateway  │    -     │ Reverse  │ Reverse  │ Reverse  │ Reverse  │ Reverse  │ Reverse  │ Reverse  │ Reverse  │
│          │          │ Proxy    │ Proxy    │ Proxy    │ Proxy    │ Proxy    │ Proxy    │ Proxy    │ Proxy    │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Auth     │    -     │    -     │ REST     │    -     │    -     │    -     │    -     │    -     │ RMQ      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ User     │    -     │    -     │    -     │    -     │    -     │    -     │    -     │    -     │    -     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Product  │    -     │    -     │ REST     │    -     │    -     │    -     │ REST     │ RMQ      │ RMQ      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Search   │    -     │    -     │ REST     │    -     │    -     │    -     │ REST     │    -     │    -     │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Chat     │    -     │    -     │ REST     │ REST     │    -     │    -     │    -     │    -     │ RMQ      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Mod      │    -     │    -     │ REST     │ REST     │    -     │    -     │ REST     │    -     │ RMQ      │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│ Admin    │    -     │    -     │ REST     │ REST     │    -     │    -     │    -     │ REST     │ RMQ      │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘

REST  = Gọi trực tiếp HTTP (đồng bộ, internal, không qua Gateway)
RMQ   = Publish event lên RabbitMQ (bất đồng bộ)
Proxy = Gateway chuyển tiếp request từ Flutter
```
