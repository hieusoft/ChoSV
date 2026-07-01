-- ============================================
-- 08-seed.sql — Seed data
-- ============================================

-- Seed categories vào product_db
\c product_db
INSERT INTO categories (name, slug, description, sort_order) VALUES
    ('Sách, giáo trình',       'books',         'Sách giáo khoa, giáo trình, tài liệu học tập',         1),
    ('Đồ điện tử',             'electronics',   'Điện thoại, máy tính bảng, phụ kiện điện tử',          2),
    ('Laptop, máy tính bảng',  'laptop-tablet', 'Laptop, MacBook, iPad, máy tính bảng các loại',         3),
    ('Đồ ký túc xá',           'dorm-items',    'Đồ dùng phòng trọ, ký túc xá, đồ gia dụng',            4),
    ('Xe đạp',                 'bicycle',       'Xe đạp, xe đạp điện, phụ tùng xe',                     5),
    ('Quần áo',                'clothes',       'Quần áo nam nữ, giày dép, phụ kiện thời trang',         6),
    ('Dụng cụ học tập',        'study-tools',   'Bút, vở, máy tính cầm tay, dụng cụ học tập',            7),
    ('Khác',                   'other',         'Các mặt hàng khác',                                     8)
ON CONFLICT (slug) DO NOTHING;

-- Seed AI prompts mẫu
\c ai_db
INSERT INTO ai_prompts (name, version, task_type, prompt_template, is_active) VALUES
    ('generate_title_vn', 1, 'generate_listing',
     'Bạn là trợ lý tạo nội dung cho chợ đồ cũ sinh viên. Từ mô tả thô sau, hãy tạo:
1. Tiêu đề sản phẩm hấp dẫn (dưới 100 ký tự)
2. Mô tả chi tiết (thân thiện, phù hợp sinh viên)
3. Gợi ý danh mục phù hợp nhất
4. Gợi ý tình trạng sản phẩm
5. Gợi ý khoảng giá hợp lý

Mô tả thô: {{raw_description}}
Giá mong muốn: {{expected_price}}

Trả về JSON:
{
  "title": "...",
  "description": "...",
  "category_slug": "...",
  "condition_suggestion": "new|like_new|good|fair|poor",
  "price_suggestion": {"min": ..., "max": ..., "reason": "..."}
}', TRUE),

    ('moderate_product_vn', 1, 'moderate_product',
     'Bạn là hệ thống kiểm duyệt nội dung cho chợ đồ cũ sinh viên. Kiểm tra sản phẩm sau và đánh giá rủi ro.

Tiêu đề: {{title}}
Mô tả: {{description}}
Giá: {{price}}
Người bán: {{seller_info}}

Đánh giá các dấu hiệu:
- Spam (nội dung không liên quan, lặp lại)
- Scam (lừa đảo, yêu cầu chuyển khoản trước)
- Hàng cấm
- Giá bất thường
- Thông tin không rõ ràng

Trả về JSON:
{
  "risk_score": 0-100,
  "risk_level": "low|medium|high|critical",
  "signals": ["dấu hiệu 1", "dấu hiệu 2"],
  "action": "allow|warn|review|hide|block"
}', TRUE)
ON CONFLICT (name, version) DO NOTHING;
