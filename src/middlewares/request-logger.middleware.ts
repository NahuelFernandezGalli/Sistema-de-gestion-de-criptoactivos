import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

/**
 * Loguea cada request al completarse, con su código de estado y duración.
 * Es el reemplazo estructurado de los `console.log` de la primera entrega.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    logger.info('HTTP request', {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: req.ip,
    });
  });

  next();
}
