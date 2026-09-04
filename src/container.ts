import { randomUUID } from 'crypto';
import { config } from './config/env';
import { Asset } from './models/asset.model';
import { InMemoryAssetRepository } from './repositories/asset.repository';
import { InMemoryAuditRepository } from './repositories/audit.repository';
import { AssetService } from './services/asset.service';
import { MarketService } from './services/market.service';
import { CoinGeckoPriceProvider } from './services/price-provider.service';
import { AssetController } from './controllers/asset.controller';
import { MarketController } from './controllers/market.controller';
import { TtlCache } from './utils/cache';

/**
 * Composition root: el único lugar donde se instancian las implementaciones
 * concretas y se inyectan las dependencias.
 *
 * El resto de la aplicación depende de interfaces, así que cambiar el
 * repositorio en memoria por uno con base de datos, o CoinGecko por otro
 * proveedor, se hace solamente acá.
 */

function seedAssets(): Asset[] {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      symbol: 'BTC',
      name: 'Bitcoin',
      amount: 0.5,
      purchasePrice: 42000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 3,
      purchasePrice: 2500,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function buildContainer() {
  const assetRepository = new InMemoryAssetRepository(seedAssets());
  const auditRepository = new InMemoryAuditRepository();

  const assetService = new AssetService(assetRepository, auditRepository);
  const priceProvider = new CoinGeckoPriceProvider();
  const priceCache = new TtlCache<number>(config.priceCacheTtlMs);
  const marketService = new MarketService(assetService, priceProvider, priceCache);

  return {
    assetRepository,
    auditRepository,
    assetService,
    marketService,
    assetController: new AssetController(assetService),
    marketController: new MarketController(marketService),
  };
}

export type Container = ReturnType<typeof buildContainer>;
