-- このスクリプトは、開発用の初期データをデータベースに投入します。
-- パスワードはすべて 'password123' です。

-- まず既存のデータをクリア (再実行時にエラーを防ぐため)
TRUNCATE TABLE users, producers, restaurants, cases, case_details, proposals RESTART IDENTITY CASCADE;

-- Users (ユーザー)
-- パスワード 'password123' の bcrypt ハッシュ値: '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i'
INSERT INTO users (name, email, password_hash, role) VALUES
('自治体 太郎', 'municipality1@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'MUNICIPALITY'),
('自治体 花子', 'municipality2@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'MUNICIPALITY'),
('サッポロ 営業一', 'sales1@sapporo.jp', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'SALES'),
('サッポロ 営業二', 'sales2@sapporo.jp', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'SALES'),
('サッポロ 営業三', 'sales3@sapporo.jp', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'SALES'),
('生産者A（田中農園）', 'producer1@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'PRODUCER'),
('生産者B（鈴木水産）', 'producer2@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'PRODUCER'),
('生産者C（佐藤牧場）', 'producer3@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'PRODUCER'),
('恵比寿ビアホール', 'restaurant1@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'RESTAURANT'),
('銀座ライオン', 'restaurant2@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'RESTAURANT'),
('創作ビストロ ガブリ', 'restaurant3@example.com', '$2b$10$E.m4zD9z9i3e.F.c1i.yZ.QoZ9G.G.w3F4aC5J/T8x7Z9e.I7i', 'RESTAURANT');

-- Producers (生産者)
INSERT INTO producers (user_id, name, address) VALUES
(6, '田中農園', '北海道空知郡'),
(7, '鈴木水産', '千葉県銚子市'),
(8, '佐藤牧場', '岩手県遠野市');

-- Restaurants (飲食店)
INSERT INTO restaurants (user_id, name, address, managed_by_sales_id) VALUES
(9, '恵比寿ビアホール', '東京都渋谷区', 3),
(10, '銀座ライオン', '東京都中央区', 4),
(11, '創作ビストロ ガブリ', '北海道札幌市', 3);

-- Cases & Case_Details (案件と詳細)
-- 案件1: 新着 (NEW)
INSERT INTO cases (title, status, created_by_user_id, producer_id) VALUES
('北海道空知産 規格外じゃがいも 5トン', 'NEW', 1, 6);
INSERT INTO case_details (case_id, item_name, quantity, desired_price, description) VALUES
(1, 'じゃがいも（とうや）', '5トン', 500000, '豊作により規格外品が大量に出ました。味は一級品です。フライドポテトやポテトサラダに最適。');

-- 案件2: 新着 (NEW)
INSERT INTO cases (title, status, created_by_user_id, producer_id) VALUES
('千葉県銚子産 訳ありサバ 100kg', 'NEW', 2, 7);
INSERT INTO case_details (case_id, item_name, quantity, desired_price, description) VALUES
(2, 'サバ', '100kg', 80000, 'サイズが不揃いなため訳あり品として出品。鮮度は抜群で、塩焼きや煮付けに最適です。');

-- 案件3: 担当アサイン済み (PENDING)
INSERT INTO cases (title, status, created_by_user_id, producer_id, assigned_sales_id) VALUES
('岩手県遠野産 ホップの余剰分', 'PENDING', 1, 8, 4);
INSERT INTO case_details (case_id, item_name, quantity, desired_price, description) VALUES
(3, 'ホップ（IBUKI）', '50kg', 150000, '契約分以外の余剰が出ました。クラフトビール醸造所様などにご提案ください。');

-- 案件4: 提案中 (PROPOSING)
INSERT INTO cases (title, status, created_by_user_id, producer_id, assigned_sales_id) VALUES
('北海道空知産 完熟トマト（ジュース用）', 'PROPOSING', 2, 6, 3);
INSERT INTO case_details (case_id, item_name, quantity, desired_price, description) VALUES
(4, 'トマト', '2トン', 300000, '完熟のため傷みやすく、生食用としては出荷が難しいです。トマトジュースやソースの原料として高品質です。');

-- Proposals (提案)
-- 案件4に対する提案
INSERT INTO proposals (case_id, restaurant_id, sales_id, status, memo) VALUES
(4, 11, 3, 'PROPOSED', '札幌市内のビストロなので、地産地消のストーリーで提案できそうです。まずはサンプルを送付して反応を見ます。');

SELECT 'Seed data loaded successfully!' as "Status";