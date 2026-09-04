import { Router } from 'express';
import { Container } from '../container';
import { validate } from '../middlewares/validate.middleware';
import { marketRateLimiter } from '../middlewares/rate-limit.middleware';
import { assetIdParamSchema } from '../schemas/asset.schema';

/**
 * Rutas de consulta de mercado (consumen la API externa de precios).
 * Protegidas con rate limiting: 5 peticiones por minuto por IP.
 */
export function buildMarketRoutes(container: Container): Router {
  const router = Router();

  router.get(
    '/:id',
    validate({ params: assetIdParamSchema }),
    marketRateLimiter,
    container.marketController.getValuation
  );

  return router;
}
