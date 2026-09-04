import rateLimit from 'express-rate-limit';
import { config } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Rate limiting del endpoint de consulta de mercado.
 *
 * Se aplica solo a las rutas que consumen la API externa de precios: son las
 * caras (latencia + cuota del proveedor) y las que conviene proteger. El CRUD
 * en memoria no necesita el mismo límite.
 *
 * Política: 5 peticiones por minuto por IP.
 */
export const marketRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-7', // expone RateLimit-* según el estándar IETF
  legacyHeaders: false,
  handler: (req, res, _next, options) => {
    logger.warn('Límite de peticiones excedido', {
      ip: req.ip,
      path: req.originalUrl,
      limit: options.limit,
      windowMs: options.windowMs,
    });

    res.status(options.statusCode).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Demasiadas peticiones al servicio de mercado. El límite es de ${options.limit} por minuto por IP. Intentá de nuevo en unos segundos.`,
      },
    });
  },
});
