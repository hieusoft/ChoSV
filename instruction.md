# Kiến trúc hệ thống app chợ đồ cũ sinh viên

## 1. Tổng quan project

Ứng dụng là một nền tảng **chợ đồ cũ dành cho sinh viên**, cho phép sinh viên đăng bán, tìm kiếm, trao đổi và mua bán các sản phẩm đã qua sử dụng như:

- Sách, giáo trình
- Đồ điện tử
- Laptop, máy tính bảng
- Đồ dùng ký túc xá
- Xe đạp
- Quần áo
- Dụng cụ học tập

Hệ thống tích hợp AI để hỗ trợ:

- Tạo tiêu đề và mô tả sản phẩm
- Gợi ý danh mục
- Gợi ý giá
- Tìm kiếm thông minh
- Phát hiện spam/scam
- Hỗ trợ kiểm duyệt nội dung

---

## 2. Công nghệ chính

```text
Mobile App: Flutter
Backend: Microservices
Database: PostgreSQL
Realtime Chat: WebSocket
Push Notification: Firebase Cloud Messaging
AI: AI API thông qua AI Service
Storage: Object Storage/S3-compatible/Cloudinary
Cache/Queue: Redis hoặc RabbitMQ
Deploy: Docker, VPS hoặc Kubernetes nếu mở rộng
```

---

## 3. Kiến trúc tổng thể

```text
Flutter App
    ↓ HTTP/HTTPS
API Gateway
    ↓ REST/gRPC
Microservices
    ↓
PostgreSQL / Redis / Queue / Object Storage
```

Các service chính:

```text
Auth Service
User Service
Product Service
Search Service
Chat Service
AI Service
Moderation Service
Notification Service
Admin Service
```

Sơ đồ tổng quát:

```text
                 ┌──────────────────┐
                 │   Flutter App     │
                 └─────────┬────────┘
                           │
                           ▼
                 ┌──────────────────┐
                 │   API Gateway     │
                 └─────────┬────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Auth Service│     │ Product Svc │     │ Chat Svc    │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ User Svc    │     │ Search Svc  │     │Notification │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └──────────┬────────┴──────────┬────────┘
                  ▼                   ▼
          ┌─────────────┐     ┌─────────────┐
          │ AI Service  │     │ Moderation  │
          └──────┬──────┘     └──────┬──────┘
                 │                   │
                 ▼                   ▼
          ┌────────────────────────────────┐
          │          PostgreSQL             │
          └────────────────────────────────┘
```

---

## 4. Vai trò các service

### 4.1 Auth Service

Phụ trách xác thực và phân quyền.

Chức năng:

- Đăng ký
- Đăng nhập
- JWT authentication
- Refresh token
- Xác thực email sinh viên
- Quên mật khẩu
- Phân quyền user/admin

Bảng liên quan:

```text
users
sessions
student_verifications
```

---

### 4.2 User Service

Quản lý thông tin người dùng.

Chức năng:

- Hồ sơ cá nhân
- Ảnh đại diện
- Trường/khu vực
- Điểm uy tín
- Lịch sử mua bán
- Đánh giá người dùng

Bảng liên quan:

```text
profiles
reviews
user_reputation
```

---

### 4.3 Product Service

Quản lý sản phẩm được đăng bán.

Chức năng:

- Đăng sản phẩm
- Sửa/xóa sản phẩm
- Upload ảnh
- Danh mục sản phẩm
- Đánh dấu đã bán
- Lưu sản phẩm yêu thích

Bảng liên quan:

```text
products
product_images
categories
favorites
```

---

### 4.4 Search Service

Phụ trách tìm kiếm và lọc sản phẩm.

Chức năng:

- Tìm kiếm theo từ khóa
- Lọc theo danh mục, giá, tình trạng, khu vực
- Tìm kiếm thông minh bằng AI
- Gợi ý sản phẩm tương tự

Có thể dùng:

```text
PostgreSQL full-text search
pgvector cho semantic search nếu cần
```

Bảng liên quan:

```text
product_embeddings
search_logs
```

---

### 4.5 Chat Service

Phụ trách chat giữa người mua và người bán.

Chức năng:

- Tạo hội thoại theo sản phẩm
- Gửi/nhận tin nhắn realtime
- Lưu tin nhắn
- Trạng thái đã đọc
- Tích hợp cảnh báo scam trong chat

Công nghệ:

```text
WebSocket
Redis Pub/Sub
Firebase Cloud Messaging
```

Bảng liên quan:

```text
conversations
messages
```

---

### 4.6 AI Service

Service trung gian để gọi AI API. Flutter không gọi AI API trực tiếp.

Chức năng:

- Sinh tiêu đề sản phẩm
- Sinh mô tả sản phẩm
- Gợi ý danh mục
- Gợi ý giá
- Parse tìm kiếm tự nhiên
- Kiểm tra nội dung spam/scam
- Tóm tắt report cho admin

Luồng xử lý:

```text
Service khác gửi request
↓
AI Service build prompt
↓
Gọi AI API
↓
Validate output JSON
↓
Lưu ai_logs
↓
Trả kết quả
```

Bảng liên quan:

```text
ai_logs
ai_prompts
ai_usage
```

---

### 4.7 Moderation Service

Phụ trách kiểm duyệt và đảm bảo an toàn nội dung/giao dịch.

Service này giúp phát hiện và xử lý:

- Bài đăng spam
- Nội dung lừa đảo
- Hàng cấm
- Tin nhắn có dấu hiệu scam
- Report từ người dùng
- Hành vi bất thường

Chức năng chính:

```text
Kiểm duyệt bài đăng
Kiểm tra tin nhắn rủi ro
Xử lý report
Tính risk_score
Đưa nội dung vào moderation_queue
Ghi nhận action của admin
```

Các action có thể trả về:

```text
allow          Cho phép
warn           Cảnh báo
review         Đưa vào hàng chờ admin duyệt
hide           Ẩn tạm thời
block          Chặn nội dung
ban_suggested  Gợi ý khóa tài khoản
```

Ví dụ response:

```json
{
  "target_type": "product",
  "target_id": "prd_123",
  "risk_score": 78,
  "risk_level": "high",
  "signals": [
    "Giá thấp bất thường",
    "Có yêu cầu chuyển khoản trước",
    "Tài khoản mới tạo"
  ],
  "action": "review"
}
```

Bảng liên quan:

```text
reports
moderation_queue
moderation_actions
moderation_rules
```

---

### 4.8 Notification Service

Phụ trách thông báo.

Chức năng:

- Push notification khi có tin nhắn
- Thông báo sản phẩm được quan tâm
- Thông báo kết quả kiểm duyệt
- Thông báo report/admin
- Thông báo sản phẩm phù hợp với từ khóa theo dõi

Công nghệ:

```text
Firebase Cloud Messaging
Email Service
In-app notifications
```

Bảng liên quan:

```text
notifications
notification_preferences
```

---

### 4.9 Admin Service

Phụ trách nghiệp vụ quản trị.

Chức năng:

- Quản lý user
- Quản lý sản phẩm
- Quản lý report
- Duyệt moderation queue
- Xem thống kê hệ thống
- Xem log AI

Bảng liên quan:

```text
admin_logs
moderation_actions
ai_logs
```

---

## 5. Giao tiếp giữa các service

Các service giao tiếp theo 2 kiểu chính:

```text
1. Đồng bộ: REST/gRPC
2. Bất đồng bộ: Message Queue/Event Bus
```

### 5.1 Giao tiếp đồng bộ

Dùng khi service cần kết quả ngay.

Ví dụ:

```text
Search Service gọi AI Service để parse intent
Product Service gọi AI Service để sinh mô tả
Chat Service gọi Moderation Service để check nhanh tin nhắn
```

Công nghệ đề xuất MVP:

```text
REST API
```

Có thể nâng cấp sau:

```text
gRPC
```

---

### 5.2 Giao tiếp bất đồng bộ

Dùng khi không cần chờ kết quả ngay.

Ví dụ event:

```text
ProductCreated
MessageSent
ReportCreated
ModerationRequired
NotificationRequested
ProductModerated
RiskDetected
```

Công nghệ đề xuất:

```text
RabbitMQ hoặc Redis Stream
```

---

## 6. Luồng nghiệp vụ chính

### 6.1 Luồng đăng sản phẩm có AI hỗ trợ

```text
Flutter
↓
API Gateway
↓
AI Service
↓
AI API
↓
AI Service trả title/description/category/price suggestion
↓
Flutter hiển thị gợi ý
↓
User chỉnh sửa
↓
Flutter gửi request tạo sản phẩm
↓
API Gateway
↓
Product Service
↓
Product Service lưu PostgreSQL
↓
Product Service publish ProductCreated event
↓
Moderation Service nhận event
↓
Moderation Service kiểm duyệt
↓
Nếu OK → product active
Nếu nghi ngờ → pending_review
```

API ví dụ:

```text
POST /api/ai/generate-listing
POST /api/products
```

---

### 6.2 Luồng đăng sản phẩm không dùng AI

```text
Flutter
↓
API Gateway
↓
Product Service
↓
Lưu product status = pending_check
↓
Publish ProductCreated event
↓
Moderation Service
↓
Check rule + gọi AI Service nếu cần
↓
Publish ProductModerated event
↓
Product Service cập nhật trạng thái sản phẩm
```

Event `ProductCreated`:

```json
{
  "event": "ProductCreated",
  "product_id": "prd_123",
  "seller_id": "usr_1"
}
```

Event `ProductModerated`:

```json
{
  "event": "ProductModerated",
  "product_id": "prd_123",
  "action": "allow",
  "risk_score": 12
}
```

---

### 6.3 Luồng tìm kiếm sản phẩm cơ bản

```text
Flutter
↓
GET /api/search?q=casio&maxPrice=500000
↓
API Gateway
↓
Search Service
↓
PostgreSQL query
↓
Trả danh sách sản phẩm
```

---

### 6.4 Luồng tìm kiếm thông minh bằng AI

User nhập:

```text
tìm laptop học code dưới 10 triệu gần ký túc xá
```

Luồng:

```text
Flutter
↓
API Gateway
↓
Search Service
↓
Search Service gọi AI Service để parse intent
↓
AI Service trả category, max_price, keywords, location
↓
Search Service query PostgreSQL
↓
Trả kết quả về Flutter
```

AI parse output:

```json
{
  "category": "electronics",
  "keywords": ["laptop", "học code"],
  "max_price": 10000000,
  "location": "ký túc xá"
}
```

---

### 6.5 Luồng chat giữa người mua và người bán

```text
Flutter
↓ WebSocket
Chat Service
↓
Chat Service rule-check nhanh
↓
Lưu message vào PostgreSQL
↓
Gửi realtime cho receiver
↓
Publish MessageSent event
↓
Notification Service gửi push notification
↓
Moderation Service check scam async
↓
Nếu rủi ro → publish RiskDetected event
↓
Chat Service/Notification Service hiển thị cảnh báo
```

Khuyến nghị MVP:

```text
Rule-check nhanh trước khi gửi
AI moderation chạy bất đồng bộ sau
```

---

### 6.6 Luồng report bài đăng

```text
Flutter
↓
POST /api/reports
↓
API Gateway
↓
Moderation Service
↓
Lưu report vào PostgreSQL
↓
Tính report count/risk_score
↓
Nếu nghiêm trọng → thêm vào moderation_queue
↓
Publish ReportCreated event
↓
Admin Service hiển thị trong dashboard
```

Nếu nghiêm trọng:

```text
Moderation Service publish ProductHiddenRequested
↓
Product Service consume event
↓
Update product status = hidden
↓
Notification Service báo người bán
```

---

### 6.7 Luồng admin duyệt report

```text
Admin Web/Mobile
↓
API Gateway
↓
Admin Service
↓
Admin Service gọi Moderation Service lấy queue
↓
Admin chọn action: approve/hide/delete/warn/ban
↓
Moderation Service lưu moderation_action
↓
Publish event
↓
Product/User Service cập nhật trạng thái
↓
Notification Service gửi thông báo
```

Ví dụ admin ẩn sản phẩm:

```text
Admin action = hide_product
↓
Moderation Service lưu action
↓
Publish ProductHideRequested
↓
Product Service update status = hidden
↓
Notification Service báo seller
```

---

### 6.8 Luồng gợi ý giá

```text
Flutter
↓
POST /api/products/suggest-price
↓
API Gateway
↓
Product Service
↓
Product Service tìm sản phẩm tương tự trong PostgreSQL
↓
Tính median price, price range
↓
Gọi AI Service để giải thích kết quả
↓
Trả về Flutter
```

Lưu ý:

```text
Không để AI tự bịa giá.
Product Service lấy dữ liệu và tính toán giá.
AI Service chỉ giải thích/gợi ý nội dung hiển thị.
```

---

## 7. Service nào gọi service nào?

| Service | Gọi service khác |
|---|---|
| API Gateway | Auth Service, route đến các service |
| Auth Service | User Service nếu cần tạo profile |
| User Service | Notification Service |
| Product Service | AI Service, Moderation Service, Search Service |
| Search Service | AI Service, Product DB/read model |
| Chat Service | Moderation Service, Notification Service |
| Moderation Service | AI Service, Product Service, User Service |
| Notification Service | Firebase/Email provider |
| Admin Service | User Service, Product Service, Moderation Service |
| AI Service | External AI API |

---

## 8. Database PostgreSQL

Với project MVP, nên dùng **một PostgreSQL instance**, chia schema theo service.

Ví dụ:

```text
auth.users
auth.sessions

user.profiles
user.reviews

product.products
product.product_images
product.categories
product.favorites

chat.conversations
chat.messages

moderation.reports
moderation.moderation_queue
moderation.moderation_actions

notification.notifications
notification.notification_preferences

ai.ai_logs
ai.ai_usage
```

Lý do:

- Dễ triển khai
- Dễ debug
- Phù hợp đồ án/MVP
- Vẫn giữ ranh giới logic service
- Sau này có thể tách DB riêng nếu cần scale

---

## 9. Các bảng cốt lõi

### users

```text
id
email
password_hash
role
status
created_at
updated_at
```

### profiles

```text
id
user_id
full_name
avatar_url
university
campus
phone
bio
reputation_score
created_at
updated_at
```

### products

```text
id
seller_id
category_id
title
description
price
condition
status
location
campus
risk_score
view_count
created_at
updated_at
```

### product_images

```text
id
product_id
image_url
sort_order
created_at
```

### conversations

```text
id
product_id
buyer_id
seller_id
last_message_at
created_at
```

### messages

```text
id
conversation_id
sender_id
content
is_read
risk_score
created_at
```

### reports

```text
id
reporter_id
target_type
target_id
reason
description
status
created_at
```

### moderation_queue

```text
id
target_type
target_id
risk_score
risk_level
signals
status
assigned_admin_id
created_at
resolved_at
```

### moderation_actions

```text
id
admin_id
target_type
target_id
action
note
created_at
```

### ai_logs

```text
id
user_id
task_type
input
output
model
status
created_at
```

---

## 10. Event bus

Event bus giúp các service giao tiếp lỏng hơn, không phụ thuộc trực tiếp nhau.

Ví dụ Product Service không cần biết Notification Service ở đâu. Nó chỉ publish event:

```text
ProductCreated
ProductSold
ProductHidden
```

Service nào cần thì subscribe.

Các event nên có:

```text
UserRegistered
StudentVerified

ProductCreated
ProductUpdated
ProductSold
ProductDeleted
ProductModerated
ProductHidden

MessageSent
RiskDetected

ReportCreated
ModerationActionCreated

NotificationRequested

AIJobCompleted
```

---

## 11. API Gateway

API Gateway xử lý:

- Routing request đến service phù hợp
- Verify JWT
- Rate limiting
- Logging
- Request validation
- CORS
- Versioning API

Route ví dụ:

```text
/api/auth/**
/api/users/**
/api/products/**
/api/search/**
/api/chat/**
/api/ai/**
/api/admin/**
/api/reports/**
```

---

## 12. Flutter app screens

Các màn hình chính:

```text
Splash / Onboarding
Login
Register
Home
Product List
Product Detail
Create Product
Edit Product
My Products
Favorites
Chat List
Chat Detail
Profile
Edit Profile
Notifications
Report Product
Review User
```

Admin có thể làm web dashboard riêng hoặc app admin riêng.

---

## 13. MVP tính năng chính

### User

```text
Đăng ký/đăng nhập
Hồ sơ cá nhân
Xác thực email sinh viên
Xem danh sách sản phẩm
Tìm kiếm/lọc sản phẩm
Xem chi tiết sản phẩm
Đăng bán sản phẩm
Upload ảnh sản phẩm
Sửa/xóa/đánh dấu đã bán
Yêu thích sản phẩm
Chat với người bán
Đánh giá sau giao dịch
Báo cáo bài đăng/người dùng
```

### AI trong MVP

```text
AI tạo tiêu đề + mô tả sản phẩm
AI gợi ý danh mục
AI gợi ý giá dựa trên sản phẩm tương tự
AI phát hiện spam/scam cơ bản
```

### Admin

```text
Quản lý users
Quản lý sản phẩm
Quản lý report
Duyệt moderation queue
Xem log AI
```

---

## 14. Roadmap triển khai

### Giai đoạn 1: Core marketplace

```text
Auth
User profile
Product CRUD
Upload ảnh
Danh sách sản phẩm
Search/filter
Product detail
Favorite
```

### Giai đoạn 2: Chat và giao dịch

```text
Conversation
Realtime messages
Push notification
Mark as sold
Review user
```

### Giai đoạn 3: AI Service

```text
AI sinh mô tả
AI gợi ý danh mục
AI gợi ý giá
AI moderation cơ bản
Lưu ai_logs
```

### Giai đoạn 4: Trust & Safety

```text
Report
Moderation queue
Risk score
Student email verification
User reputation
Admin dashboard
```

### Giai đoạn 5: Tối ưu và mở rộng

```text
Semantic search
Recommendation
Multi-campus
Analytics
Scalability
CI/CD
Docker/Kubernetes
```

---

## 15. Kế hoạch MVP 6 tuần

```text
Tuần 1:
- Setup Flutter project
- Setup backend services cơ bản
- Setup PostgreSQL
- Auth Service

Tuần 2:
- Product Service
- Upload ảnh
- Product list/detail

Tuần 3:
- Search/filter
- Profile
- Favorite
- My products

Tuần 4:
- Chat Service
- Notification cơ bản
- Mark as sold
- Review

Tuần 5:
- AI Service
- Generate listing
- Suggest category
- Suggest price
- Basic moderation

Tuần 6:
- Admin dashboard
- Report/moderation
- Testing
- Deploy
- Demo data
```

---

## 16. Kết luận

Hướng triển khai đề xuất:

```text
Mobile app: Flutter
Backend: Microservices
Database: PostgreSQL
AI: AI API thông qua AI Service riêng
Realtime chat: WebSocket
Notification: Firebase Cloud Messaging
Storage: Object Storage
Event bus: RabbitMQ hoặc Redis Stream
Deploy: Docker
```

Điểm nhấn kỹ thuật:

> AI không gọi trực tiếp từ app Flutter, mà đi qua **AI Service** riêng để quản lý prompt, validate output, lưu log, kiểm soát chi phí và bảo mật API key.

Giao tiếp hệ thống:

```text
Flutter gọi API Gateway.
API Gateway route đến service tương ứng.
Service cần kết quả ngay thì gọi REST/gRPC.
Service chỉ cần thông báo sự kiện thì publish event lên RabbitMQ/Redis Stream.
Chat realtime đi qua WebSocket.
Notification đi qua Firebase Cloud Messaging.
```
