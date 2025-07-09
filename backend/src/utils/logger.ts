import winston from 'winston';

const logger = winston.createLogger({
  level: 'info', // ログレベル (error, warn, info, http, verbose, debug, silly)
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }), // エラーにスタックトレースを含める
    winston.format.splat(), // 文字列補間を有効にする
    winston.format.json() // JSON形式で出力
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // コンソール出力に色を付ける
        winston.format.simple() // シンプルな形式で出力
      )
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }), // エラーログをファイルに出力
    new winston.transports.File({ filename: 'logs/combined.log' }) // 全てのログをファイルに出力
  ]
});

// 開発環境ではHTTPリクエストログもコンソールに出力
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
