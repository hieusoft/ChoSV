-- ============================================
-- 04-chat-db.sql — Chat Service
-- Bảng: conversations, messages
-- ============================================
\c chat_db

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- product_id → product_db.products.id
-- buyer_id, seller_id → auth_db.users.id
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    last_message_id UUID,
    last_message_at TIMESTAMPTZ,
    buyer_unread_count INTEGER NOT NULL DEFAULT 0,
    seller_unread_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_product_buyer_seller UNIQUE (product_id, buyer_id, seller_id)
);
CREATE INDEX idx_conversations_product_id ON conversations(product_id);
CREATE INDEX idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);

-- sender_id → auth_db.users.id
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    risk_score INTEGER NOT NULL DEFAULT 0,
    moderation_status VARCHAR(30) NOT NULL DEFAULT 'unchecked',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_conversation_created_at ON messages(conversation_id, created_at);

-- FK nội bộ
ALTER TABLE conversations
    ADD CONSTRAINT fk_conversations_last_message_id
    FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;
