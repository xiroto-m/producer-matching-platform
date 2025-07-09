import request from 'supertest';
import app from '../index'; // index.tsからappをインポート

// テスト用ユーザーの認証情報 (seed.sqlに存在する前提)
const TEST_USER_EMAIL = 'test@example.com';
const TEST_USER_PASSWORD = 'password123';

describe('Auth API - Login', () => {

  // シナリオ1: 正常系 - 正しいメールアドレスとパスワードでログイン
  test('should login successfully with correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('email');
    expect(res.body.user.email).toEqual(TEST_USER_EMAIL);
  });

  // シナリオ2: 異常系 - 間違ったパスワードでログイン
  test('should return 401 for incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER_EMAIL,
        password: 'wrongpassword',
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toEqual('メールアドレスまたはパスワードが間違っています。');
  });

  // シナリオ3: 異常系 - ユーザーが存在しない
  test('should return 401 for non-existent user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'anypassword',
      });

    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toEqual('メールアドレスまたはパスワードが間違っています。');
  });
});
