import request from 'supertest';
import app from '../index';
import pool from '../../db';
import { QueryResult } from 'pg';

// テスト用ユーザーの認証情報 (seed.sqlに存在する前提)
const MUNICIPALITY_EMAIL = 'municipality@example.com';
const MUNICIPALITY_PASSWORD = 'password123';
const SALES_EMAIL = 'sales@example.com';
const SALES_PASSWORD = 'password123';
const PRODUCER_EMAIL = 'producer@example.com';
const PRODUCER_PASSWORD = 'password123';

let municipalityToken: string;
let salesToken: string;
let producerToken: string;
let producerId: number;

describe('Case API - Create Case', () => {
  // 各テストの前にデータベースをクリーンアップし、必要なトークンを取得
  beforeAll(async () => {
    // 自治体担当者としてログインし、トークンを取得
    const municipalityRes = await request(app).post('/api/auth/login').send({
      email: MUNICIPALITY_EMAIL,
      password: MUNICIPALITY_PASSWORD,
    });
    municipalityToken = municipalityRes.body.token;

    // 営業担当者としてログインし、トークンを取得
    const salesRes = await request(app).post('/api/auth/login').send({
      email: SALES_EMAIL,
      password: SALES_PASSWORD,
    });
    salesToken = salesRes.body.token;

    // 生産者としてログインし、トークンとIDを取得
    const producerRes = await request(app).post('/api/auth/login').send({
      email: PRODUCER_EMAIL,
      password: PRODUCER_PASSWORD,
    });
    producerToken = producerRes.body.token;
    // producerIdを取得 (seed.sqlのデータに依存)
    const producerQueryResult: QueryResult = await pool.query(
      'SELECT id FROM producers WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [PRODUCER_EMAIL]
    );
    producerId = producerQueryResult.rows[0].id;
  });

  // 各テストの後にデータベースをクリーンアップ
  afterEach(async () => {
    await pool.query('DELETE FROM notifications');
    await pool.query('DELETE FROM proposals');
    await pool.query('DELETE FROM case_details');
    await pool.query('DELETE FROM cases');
  });

  // シナリオ1: 正常系 - 正しいデータと自治体担当者で案件を作成
  test('should create a case successfully with valid data and municipality user', async () => {
    const newCaseData = {
      title: 'テスト案件',
      producer_id: producerId,
      item_name: 'テスト品目',
      quantity: '100kg',
      desired_price: 50000,
      description: 'テスト案件の詳細説明です。',
      image_urls: ['http://example.com/image1.jpg', 'http://example.com/image2.jpg'],
    };

    const res = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${municipalityToken}`)
      .send(newCaseData);

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toEqual(newCaseData.title);
    expect(res.body.status).toEqual('NEW');
    expect(res.body.details.item_name).toEqual(newCaseData.item_name);

    // 通知が生成されたことを確認
    const notificationsRes = await pool.query(
      'SELECT * FROM notifications WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [MUNICIPALITY_EMAIL]
    );
    expect(notificationsRes.rows.length).toBe(1);
    expect(notificationsRes.rows[0].message).toContain(newCaseData.title);
  });

  // シナリオ2: 異常系 - 必須フィールドが不足
  test('should return 400 if required fields are missing', async () => {
    const invalidCaseData = {
      title: 'テスト案件',
      // producer_id, item_name が不足
    };

    const res = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${municipalityToken}`)
      .send(invalidCaseData);

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('errors');
    expect(res.body.errors).toHaveProperty('producer_id');
    expect(res.body.errors).toHaveProperty('item_name');
  });

  // シナリオ3: 異常系 - 権限のないユーザー
  test('should return 403 if user is not a municipality', async () => {
    const newCaseData = {
      title: 'テスト案件',
      producer_id: producerId,
      item_name: 'テスト品目',
    };

    // 営業担当者でリクエスト
    const salesRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${salesToken}`)
      .send(newCaseData);
    expect(salesRes.statusCode).toEqual(403);

    // 生産者でリクエスト
    const producerRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${producerToken}`)
      .send(newCaseData);
    expect(producerRes.statusCode).toEqual(403);
  });

  // シナリオ4: 異常系 - 未認証
  test('should return 401 if no token is provided', async () => {
    const newCaseData = {
      title: 'テスト案件',
      producer_id: producerId,
      item_name: 'テスト品目',
    };

    const res = await request(app)
      .post('/api/cases')
      .send(newCaseData);

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toEqual('認証トークンがありません。');
  });
});
