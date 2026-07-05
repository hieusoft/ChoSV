-- ============================================
-- 00-create-databases.sql
-- Tạo tất cả database cho microservices
-- auth_db đã được tạo sẵn bởi POSTGRES_DB
-- ============================================
CREATE DATABASE user_db OWNER hieusoft;
CREATE DATABASE product_db OWNER hieusoft;
CREATE DATABASE chat_db OWNER hieusoft;
CREATE DATABASE notification_db OWNER hieusoft;
CREATE DATABASE moderation_db OWNER hieusoft;
CREATE DATABASE ai_db OWNER hieusoft;
CREATE DATABASE upload_db OWNER hieusoft;
