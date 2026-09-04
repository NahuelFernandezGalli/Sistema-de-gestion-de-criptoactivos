import { Router } from 'express';
import { Container } from '../container';
import { buildAssetRoutes } from './asset.routes';
import { buildMarketRoutes } from './market.routes';

/** Monta todos los routers de la API bajo /api. */
export function buildApiRoutes(container: Container): Router {
  const router = Router();

  router.use('/assets', buildAssetRoutes(container));
  router.use('/market', buildMarketRoutes(container));

  return router;
}
