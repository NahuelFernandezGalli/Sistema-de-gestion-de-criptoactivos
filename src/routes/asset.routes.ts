import { Router } from 'express';
import { Container } from '../container';
import { validate } from '../middlewares/validate.middleware';
import { marketRateLimiter } from '../middlewares/rate-limit.middleware';
import {
  assetIdParamSchema,
  createAssetSchema,
  updateAssetSchema,
} from '../schemas/asset.schema';

/**
 * Rutas del recurso "assets".
 *
 * Cada ruta declara: validación de entrada -> (rate limit si aplica) -> controller.
 * Las rutas más específicas van antes que `/:id` para que Express no interprete
 * "price" o "history" como un id.
 */
export function buildAssetRoutes(container: Container): Router {
  const router = Router();
  const { assetController, marketController } = container;

  router.get(
    '/:id/history',
    validate({ params: assetIdParamSchema }),
    assetController.getHistory
  );

  // Alias de la primera entrega. Consume la API externa, así que comparte el
  // mismo rate limiter que /api/market/:id.
  router.get(
    '/:id/price',
    validate({ params: assetIdParamSchema }),
    marketRateLimiter,
    marketController.getValuation
  );

  router.get('/', assetController.getAll);

  router.get('/:id', validate({ params: assetIdParamSchema }), assetController.getById);

  router.post('/', validate({ body: createAssetSchema }), assetController.create);

  router.put(
    '/:id',
    validate({ params: assetIdParamSchema, body: updateAssetSchema }),
    assetController.update
  );

  router.delete('/:id', validate({ params: assetIdParamSchema }), assetController.remove);

  return router;
}
