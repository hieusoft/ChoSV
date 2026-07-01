-- ============================================
-- 02-user-db.sql — User Service
-- Bảng: profiles, reviews
-- ============================================
\c user_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- user_id trỏ đến auth_db.users.id (UUID, không FK — microservices pattern)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
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
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_university ON profiles(university);
CREATE INDEX idx_profiles_campus ON profiles(campus);

-- reviewer_id, reviewed_user_id → auth_db.users.id
-- product_id → product_db.products.id
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reviewer_id UUID NOT NULL,
    reviewed_user_id UUID NOT NULL,
    product_id UUID,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_review_per_product_pair UNIQUE (reviewer_id, reviewed_user_id, product_id)
);
CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_user_id ON reviews(reviewed_user_id);
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);
