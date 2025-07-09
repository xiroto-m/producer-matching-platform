import { createLogger, format, transports } from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, align } = format;

// カスタムログフォーマット
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

const logger = createLogger({
  level: 'info', // デフォルトのログレベル
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // コンソールへの出力
    new transports.Console({
      format: combine(
        colorize(),
        align(),
        logFormat
      ),
    }),
    // ファイルへの出力 (combined.log)
    new transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      level: 'info',
    }),
    // エラーログのみ (error.log)
    new transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
    }),
  ],
});

export default logger;
