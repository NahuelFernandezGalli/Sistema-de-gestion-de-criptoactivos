import { AssetValuation } from '../models/asset.model';
import { TtlCache } from '../utils/cache';
import { logger } from '../utils/logger';
import { round } from '../utils/math';
import { AssetService } from './asset.service';
import { IPriceProvider } from './price-provider.service';

/**
 * Lógica de mercado: consulta el precio actual y calcula la rentabilidad de
 * una posición del portafolio.
 *
 * Los cálculos viven acá (no en el controller ni en el proveedor externo) para
 * poder testearlos con un proveedor de precios falso, sin red.
 */
export class MarketService {
  constructor(
    private readonly assetService: AssetService,
    private readonly priceProvider: IPriceProvider,
    private readonly priceCache: TtlCache<number>
  ) {}

  /** Precio actual de un símbolo, con caché para no golpear la API externa de más. */
  async getPrice(symbol: string): Promise<number> {
    const key = symbol.toUpperCase();
    const cached = this.priceCache.get(key);

    if (cached !== undefined) {
      logger.debug('Precio servido desde caché', { symbol: key });
      return cached;
    }

    const price = await this.priceProvider.getPriceUsd(key);
    this.priceCache.set(key, price);
    logger.info('Precio obtenido del servicio externo', { symbol: key, price });

    return price;
  }

  /** Valuación de un activo del portafolio contra el precio de mercado actual. */
  async getAssetValuation(assetId: string): Promise<AssetValuation> {
    // Si el activo no existe, AssetService lanza NotFoundError y no llegamos
    // a gastar una llamada al servicio externo.
    const asset = this.assetService.getById(assetId);
    const currentPrice = await this.getPrice(asset.symbol);

    const currentValue = asset.amount * currentPrice;
    const purchaseValue = asset.amount * asset.purchasePrice;
    const profitLoss = currentValue - purchaseValue;

    return {
      assetId: asset.id,
      symbol: asset.symbol,
      name: asset.name,
      amount: asset.amount,
      purchasePrice: asset.purchasePrice,
      currentPrice,
      currentValue: round(currentValue),
      purchaseValue: round(purchaseValue),
      profitLoss: round(profitLoss),
      profitLossPercentage: round((profitLoss / purchaseValue) * 100),
      pricedAt: new Date().toISOString(),
    };
  }
}
