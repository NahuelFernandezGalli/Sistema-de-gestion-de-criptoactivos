import { Router } from 'express';
import { Container } from '../container';
import { validate } from '../middlewares/validate.middleware';
import { marketRateLimiter } from '../middlewares/rate-limit.middleware';
import { assetIdParamSchema, updateAssetSchema } from '../schemas/asset.schema';

/**
 * Rutas del recurso "assets".
 *
 * Cada ruta declara: validación de entrada -> (rate limit si aplica) -> controller.
 * Las rutas más específicas van antes que `/:id` para que Express no interprete
 * "price" o "history" como un id.
 */
export function buildAssetRoutes(container: Container): Router {
  const router = Router();
  const { assetController, marketController, analysisController } = container;

  // Pipeline de análisis: recibe un array de activos y devuelve un reporte de
  // riesgo. No persiste nada.
  router.post('/analyze', analysisController.analyze);

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

  // Sin middleware de validación: el alta pasa por el pipeline de ingesta,
  // cuyo primer filtro (ValidationFilter) valida con el mismo esquema Zod.
  router.post('/', assetController.create);

  router.put(
    '/:id',
    validate({ params: assetIdParamSchema, body: updateAssetSchema }),
    assetController.update
  );

  router.delete('/:id', validate({ params: assetIdParamSchema }), assetController.remove);

  return router;
}
