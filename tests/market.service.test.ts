import { MarketService } from '../src/services/market.service';
import { TtlCache } from '../src/utils/cache';
import { NotFoundError } from '../src/errors/app-error';
import { buildAsset, buildAssetService, FakePriceProvider } from './helpers/fakes';

/**
 * Todos estos tests corren con un proveedor de precios falso: no dependen de
 * internet ni de la disponibilidad de CoinGecko.
 */
describe('MarketService', () => {
  function buildSut(price = 50000, ttlMs = 0) {
    const asset = buildAsset({ amount: 2, purchasePrice: 30000 });
    const { assetService } = buildAssetService([asset]);
    const priceProvider = new FakePriceProvider({ BTC: price });
    const cache = new TtlCache<number>(ttlMs);
    const marketService = new MarketService(assetService, priceProvider, cache);

    return { marketService, priceProvider, asset, cache };
  }

  describe('getAssetValuation', () => {
    it('calcula valor actual, invertido y ganancia', async () => {
      const { marketService, asset } = buildSut(50000);

      const valuation = await marketService.getAssetValuation(asset.id);

      expect(valuation).toMatchObject({
        assetId: asset.id,
        symbol: 'BTC',
        amount: 2,
        currentPrice: 50000,
        currentValue: 100000, // 2 * 50000
        purchaseValue: 60000, // 2 * 30000
        profitLoss: 40000, // 100000 - 60000
      });
    });

    it('calcula correctamente la rentabilidad porcentual', async () => {
      const { marketService, asset } = buildSut(45000);

      const valuation = await marketService.getAssetValuation(asset.id);

      // Invertido 60000, ahora vale 90000 => +50%
      expect(valuation.profitLossPercentage).toBe(50);
    });

    it('refleja pérdidas con signo negativo', async () => {
      const { marketService, asset } = buildSut(15000);

      const valuation = await marketService.getAssetValuation(asset.id);

      expect(valuation.currentValue).toBe(30000);
      expect(valuation.profitLoss).toBe(-30000);
      expect(valuation.profitLossPercentage).toBe(-50);
    });

    it('redondea a dos decimales', async () => {
      const { marketService, asset } = buildSut(33333.333);

      const valuation = await marketService.getAssetValuation(asset.id);

      expect(valuation.currentValue).toBe(66666.67);
    });

    it('lanza NotFoundError y no consulta el precio si el activo no existe', async () => {
      const { marketService, priceProvider } = buildSut();

      await expect(marketService.getAssetValuation('inexistente')).rejects.toThrow(
        NotFoundError
      );
      expect(priceProvider.getPriceUsd).not.toHaveBeenCalled();
    });

    it('propaga el error del proveedor externo', async () => {
      const { assetService } = buildAssetService([buildAsset()]);
      const failingProvider = new FakePriceProvider(); // sin precios configurados
      const marketService = new MarketService(
        assetService,
        failingProvider,
        new TtlCache<number>(0)
      );

      await expect(
        marketService.getAssetValuation(buildAsset().id)
      ).rejects.toThrow();
    });
  });

  describe('caché de precios', () => {
    it('consulta el proveedor una sola vez dentro del TTL', async () => {
      const { marketService, priceProvider, asset } = buildSut(50000, 60_000);

      await marketService.getAssetValuation(asset.id);
      await marketService.getAssetValuation(asset.id);
      await marketService.getAssetValuation(asset.id);

      expect(priceProvider.getPriceUsd).toHaveBeenCalledTimes(1);
    });

    it('vuelve a consultar al proveedor si la caché está deshabilitada', async () => {
      const { marketService, priceProvider, asset } = buildSut(50000, 0);

      await marketService.getAssetValuation(asset.id);
      await marketService.getAssetValuation(asset.id);

      expect(priceProvider.getPriceUsd).toHaveBeenCalledTimes(2);
    });

    it('vuelve a consultar al proveedor cuando el TTL expira', async () => {
      const { marketService, priceProvider, asset } = buildSut(50000, 50);

      await marketService.getAssetValuation(asset.id);
      await new Promise((resolve) => setTimeout(resolve, 80));
      await marketService.getAssetValuation(asset.id);

      expect(priceProvider.getPriceUsd).toHaveBeenCalledTimes(2);
    });
  });
});
