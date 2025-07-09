import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger'; // ロガーをインポート

// グローバルエラーハンドリングミドルウェア
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  // ログにエラーを記録
  logger.error(`Error: ${err.message}, Stack: ${err.stack}, Path: ${req.path}, Method: ${req.method}, Body: ${JSON.stringify(req.body)}`);

  // ステータスコードを設定 (デフォルトは500)
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);

  // クライアントにエラーレスポンスを送信
  res.json({
    message: err.message,
    // 開発環境でのみスタックトレースを返す
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

// 存在しないルートを処理するミドルウェア
export const notFound = (req: Request, res: Response, next: NextFunction) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error); // エラーハンドリングミドルウェアに渡す
};
