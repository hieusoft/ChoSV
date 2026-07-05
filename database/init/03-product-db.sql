-- ============================================
-- 03-product-db.sql — Product Service
-- Bảng: categories, products, product_images, favorites, upload_files
-- ============================================
\c product_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Danh mục sản phẩm
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
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_is_active ON categories(is_active);

-- seller_id → auth_db.users.id (UUID, không FK)
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL,
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
CREATE INDEX idx_products_seller_id ON products(seller_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_condition ON products(condition);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_campus ON products(campus);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_status_created_at ON products(status, created_at DESC);
CREATE INDEX idx_products_search ON products
    USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

-- Ảnh sản phẩm trên Cloudflare R2.
-- upload_id → upload_db.upload_files.id (dùng cho lifecycle save/unsave, không FK chéo DB).
-- object_key / image_url copy sẵn từ upload-service để render KHÔNG cần gọi upload-service.
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    upload_id UUID,
    object_key TEXT NOT NULL,
    image_url TEXT NOT NULL,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    content_type VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_sort_order ON product_images(product_id, sort_order);
CREATE INDEX idx_product_images_upload_id ON product_images(upload_id);

-- user_id → auth_db.users.id, product_id → products (local FK)
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_product_favorite UNIQUE (user_id, product_id)
);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_product_id ON favorites(product_id);

-- NOTE: bảng upload_files ĐÃ CHUYỂN sang upload-service (upload_db).
-- Upload là microservice riêng sở hữu metadata file. product_images.upload_id
-- tham chiếu tới upload_db.upload_files.id (không FK chéo DB).
