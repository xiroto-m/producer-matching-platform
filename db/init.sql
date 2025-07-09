-- -------------------------------------------------------------
--  Producer Matching Platform - Database Schema
-- -------------------------------------------------------------

-- 自動更新関数の作成
-- TRIGGERで使用し、updated_atカラムを現在時刻で更新します。
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ENUM型の定義
-- roleやstatusなど、値が固定されるカラムに使用します。
CREATE TYPE user_role AS ENUM ('MUNICIPALITY', 'SALES', 'PRODUCER', 'RESTAURANT');
CREATE TYPE case_status AS ENUM ('NEW', 'PENDING', 'PROPOSING', 'NEGOTIATING', 'CLOSED', 'REJECTED');
CREATE TYPE proposal_status AS ENUM ('PROPOSED', 'SAMPLE_REQUESTED', 'CONSIDERING', 'ACCEPTED', 'DECLINED');


-- users テーブル
-- 全てのユーザー情報を格納します。
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- producers テーブル
-- 生産者情報を格納します。usersテーブルと1対1で紐付きます。
CREATE TABLE producers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_producers
BEFORE UPDATE ON producers
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- restaurants テーブル
-- 飲食店情報を格納します。usersテーブルと1対1で紐付きます。
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    managed_by_sales_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Note: 'SALES' roleのユーザーID。アプリケーション層で制約を設ける。
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_restaurants
BEFORE UPDATE ON restaurants
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- cases テーブル
-- 自治体担当者が登録する案件情報を格納します。
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    status case_status NOT NULL DEFAULT 'NEW',
    created_by_user_id INTEGER NOT NULL REFERENCES users(id), -- Note: 'MUNICIPALITY' roleのユーザーID。アプリケーション層で制約を設ける。
    producer_id INTEGER NOT NULL REFERENCES producers(id) ON DELETE CASCADE,
    assigned_sales_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Note: 'SALES' roleのユーザーID。アプリケーション層で制約を設ける。
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_cases
BEFORE UPDATE ON cases
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- case_details テーブル
-- 案件の品目や数量などの詳細情報を格納します。casesテーブルと1対1で紐付きます。
CREATE TABLE case_details (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    quantity VARCHAR(100),
    desired_price NUMERIC(10, 2),
    description TEXT,
    image_urls JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_case_details
BEFORE UPDATE ON case_details
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- proposals テーブル
-- 営業担当者が飲食店へ送る提案情報を格納します。
CREATE TABLE proposals (
    id SERIAL PRIMARY KEY,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    sales_id INTEGER NOT NULL REFERENCES users(id), -- Note: 'SALES' roleのユーザーID。アプリケーション層で制約を設ける。
    status proposal_status NOT NULL DEFAULT 'PROPOSED',
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(case_id, restaurant_id) -- 同一案件を同一飲食店に複数提案できないように制約を設定
);
CREATE TRIGGER set_timestamp_proposals
BEFORE UPDATE ON proposals
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- notifications テーブル
-- ユーザーへの通知を格納します。
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    link TEXT, -- 通知クリック時に遷移するURL
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON notifications
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- messages テーブル
-- 提案に関連するメッセージを格納します。
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);