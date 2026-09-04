import { Request, Response } from 'express';
import { MarketService } from '../services/market.service';
import { validatedParams } from '../middlewares/validate.middleware';
import { AssetIdParam } from '../schemas/asset.schema';

/**
 * Endpoints que consultan el servicio externo de precios de mercado.
 * Son los que están protegidos por rate limiting.
 */
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /**
   * Valuación de mercado de un activo del portafolio.
   * Async: si la promesa se rechaza, Express 5 la propaga sola al middleware
   * de errores, sin necesidad de try/catch.
   */
  getValuation = async (_req: Request, res: Response): Promise<void> => {
    const { id } = validatedParams<AssetIdParam>(res);
    const valuation = await this.marketService.getAssetValuation(id);
    res.status(200).json(valuation);
  };
}
