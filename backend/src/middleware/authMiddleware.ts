import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// ExpressのRequest型を拡張してuserプロパティを持たせる
export interface IGetUserAuthInfoRequest extends Request {
  user?: any // anyにすることで、controllerでの型エラーを一旦回避
}

// 環境変数を安全に取得するヘルパー
const getEnv = (key: string): string => {
    const value = process.env[key];
    if (!value) {
        throw new Error(`環境変数 ${key} が設定されていません。`);
    }
    return value;
};

export const protect = (req: IGetUserAuthInfoRequest, res: Response, next: NextFunction) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, getEnv('JWT_SECRET'));
            req.user = decoded;
            next();
        } catch (error) {
            console.error(error);
            return res.status(401).json({ message: '認証に失敗しました。トークンが無効です。' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: '認証されていません。トークンがありません。' });
    }
};

/**
 * ユーザーのロール（役割）に基づいてアクセスを制限するミドルウェア
 * @param roles 許可するロールの配列
 */
export const authorize = (...roles: string[]) => {
  return (req: IGetUserAuthInfoRequest, res: Response, next: NextFunction) => {
    // protectミドルウェアによってreq.userが設定されていることが前提
    if (!req.user) {
        return res.status(403).json({ message: 'Forbidden: User not found in request.' });
    }

    const userRole = req.user.role;
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ message: `Forbidden: You do not have the required role. Required one of: ${roles.join(', ')}` });
    }
    
    next();
  };
};