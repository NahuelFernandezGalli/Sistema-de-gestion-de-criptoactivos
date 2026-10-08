import { config } from './config/env';
import { IAssetRepository } from './repositories/asset.repository';
import { IAuditRepository } from './repositories/audit.repository';
import { AssetService } from './services/asset.service';
import { MarketService } from './services/market.service';
import { CoinGeckoPriceProvider } from './services/price-provider.service';
import { CoinGeckoExchangeRateProvider } from './services/exchange-rate-provider.service';
import { buildIngestionPipeline } from './pipeline/ingestion.pipeline';
import { buildAnalyticsPipeline } from './pipeline/analytics.pipeline';
import { AnalysisService } from './services/analysis.service';
import { AnalysisController } from './controllers/analysis.controller';
import { AssetController } from './controllers/asset.controller';
import { MarketController } from './controllers/market.controller';
import { TtlCache } from './utils/cache';

/**
 * Composition root: el único lugar donde se instancian las implementaciones
 * concretas y se inyectan las dependencias.
 *
 * Los repositorios llegan por parámetro (los arma `initPersistence` con MySQL
 * y MongoDB, o en memoria). Así el contenedor no sabe qué motor hay detrás:
 * pasar de arrays en memoria a bases de datos reales no tocó ni services, ni
 * controllers, ni pipelines.
 */
export interface Repositories {
  assetRepository: IAssetRepository;
  auditRepository: IAuditRepository;
}

export function buildContainer({ assetRepository, auditRepository }: Repositories) {
  const ingestionPipeline = buildIngestionPipeline(new CoinGeckoExchangeRateProvider());
  const assetService = new AssetService(assetRepository, auditRepository, ingestionPipeline);
  const priceProvider = new CoinGeckoPriceProvider();
  const priceCache = new TtlCache<number>(config.priceCacheTtlMs);
  const marketService = new MarketService(assetService, priceProvider, priceCache);
  const analysisService = new AnalysisService(buildAnalyticsPipeline(config.analytics));

  return {
    assetService,
    marketService,
    analysisService,
    assetController: new AssetController(assetService),
    marketController: new MarketController(marketService),
    analysisController: new AnalysisController(analysisService),
  };
}

export type Container = ReturnType<typeof buildContainer>;
