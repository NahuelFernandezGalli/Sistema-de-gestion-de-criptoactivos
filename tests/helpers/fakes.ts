import { Asset } from '../../src/models/asset.model';
import { InMemoryAssetRepository } from '../../src/repositories/asset.repository';
import { InMemoryAuditRepository } from '../../src/repositories/audit.repository';
import { AssetService } from '../../src/services/asset.service';
import { IPriceProvider } from '../../src/services/price-provider.service';
import { IExchangeRateProvider } from '../../src/services/exchange-rate-provider.service';
import { buildIngestionPipeline } from '../../src/pipeline/ingestion.pipeline';

/**
 * Helpers de test.
 *
 * La inyección de dependencias por constructor permite armar el grafo completo
 * sin red, sin base de datos y sin levantar Express.
 */

/** Proveedor de precios falso: devuelve precios fijos, nunca sale a internet. */
export class FakePriceProvider implements IPriceProvider {
  public calls: string[] = [];

  constructor(private readonly prices: Record<string, number> = {}) {}

  getPriceUsd = jest.fn(async (symbol: string): Promise<number> => {
    this.calls.push(symbol);
    const price = this.prices[symbol.toUpperCase()];

    if (price === undefined) {
      throw new Error(`FakePriceProvider sin precio configurado para ${symbol}`);
    }
    return price;
  });
}

/** Proveedor de tasas falso: cuántos USD vale 1 unidad de cada moneda. */
export class FakeExchangeRateProvider implements IExchangeRateProvider {
  constructor(private readonly usdRates: Record<string, number> = { EUR: 1.1 }) {}

  getUsdRate = jest.fn(async (currency: string): Promise<number> => {
    if (currency.toUpperCase() === 'USD') return 1;
    const rate = this.usdRates[currency.toUpperCase()];

    if (rate === undefined) {
      throw new Error(`FakeExchangeRateProvider sin tasa configurada para ${currency}`);
    }
    return rate;
  });
}

export function buildAsset(overrides: Partial<Asset> = {}): Asset {
  const now = new Date().toISOString();
  return {
    id: '11111111-1111-4111-8111-111111111111',
    symbol: 'BTC',
    name: 'Bitcoin',
    amount: 2,
    purchasePrice: 30000,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Arma un AssetService con repositorios en memoria vacíos (o con seed) y el
 * pipeline de ingesta real, conectado a un proveedor de tasas falso.
 */
export function buildAssetService(
  seed: Asset[] = [],
  exchangeRateProvider = new FakeExchangeRateProvider()
) {
  const assetRepository = new InMemoryAssetRepository(seed);
  const auditRepository = new InMemoryAuditRepository();
  const ingestionPipeline = buildIngestionPipeline(exchangeRateProvider);
  const assetService = new AssetService(assetRepository, auditRepository, ingestionPipeline);

  return { assetService, assetRepository, auditRepository, exchangeRateProvider };
}
