import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { config } from '../config/env';

/**
 * Logger centralizado (Winston) con dos transports:
 *  - Consola: formato legible y coloreado para desarrollo.
 *  - Archivo (logs/app.log): formato JSON, pensado para ser parseado por
 *    herramientas de observabilidad (ELK, Datadog, etc.).
 *
 * Toda la app loguea a través de este módulo; no quedan `console.log`.
 */

const logFilePath = path.resolve(process.cwd(), config.logging.file);
fs.mkdirSync(path.dirname(logFilePath), { recursive: true });

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}] ${message}${extra}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: config.logging.level,
  silent: config.logging.silent,
  defaultMeta: { service: 'crypto-portfolio-api' },
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: logFilePath,
      format: fileFormat,
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
    }),
  ],
});
