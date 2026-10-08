import { ValidationError } from '../src/errors/app-error';
import { RiskAssessedAsset, RiskFlag, ScrubbedBatch } from '../src/models/analysis.model';
import { buildAnalyticsPipeline } from '../src/pipeline/analytics.pipeline';
import { FormattingFilter } from '../src/pipeline/filters/analytics/formatting.filter';
import { RiskAnalysisFilter } from '../src/pipeline/filters/analytics/risk-analysis.filter';
import { ScrubbingFilter } from '../src/pipeline/filters/analytics/scrubbing.filter';
import { AnalysisAssetInput } from '../src/schemas/analysis.schema';
import { AnalysisService } from '../src/services/analysis.service';

const thresholds = { whaleThresholdUsd: 100_000, volatilityThresholdPct: 10 };

function asset(overrides: Partial<AnalysisAssetInput> = {}): AnalysisAssetInput {
  return { symbol: 'BTC', amount: 1, purchasePrice: 1000, ...overrides };
}

describe('Filtros de análisis', () => {
  describe('ScrubbingFilter', () => {
    const filter = new ScrubbingFilter();

    it('deja pasar los activos con montos positivos', () => {
      const result = filter.process([asset(), asset({ symbol: 'ETH' })]);

      expect(result.assets.map((a) => a.symbol)).toEqual(['BTC', 'ETH']);
      expect(result.discarded).toEqual([]);
    });

    it('descarta cantidades en cero o negativas', () => {
      const result = filter.process([
        asset({ symbol: 'CERO', amount: 0 }),
        asset({ symbol: 'NEG', amount: -3 }),
        asset({ symbol: 'OK' }),
      ]);

      expect(result.assets.map((a) => a.symbol)).toEqual(['OK']);
      expect(result.discarded.map((d) => d.symbol)).toEqual(['CERO', 'NEG']);
    });

    it('descarta precios en cero o negativos', () => {
      const result = filter.process([asset({ purchasePrice: 0 })]);

      expect(result.assets).toHaveLength(0);
      expect(result.discarded[0].reason).toMatch(/precio/);
    });

    it('informa el motivo de cada descarte', () => {
      const result = filter.process([asset({ amount: -1 })]);

      expect(result.discarded[0]).toEqual({
        symbol: 'BTC',
        reason: 'cantidad en cero o negativa',
      });
    });
  });

  describe('RiskAnalysisFilter', () => {
    const filter = new RiskAnalysisFilter(thresholds);
    const assess = (...assets: AnalysisAssetInput[]) =>
      filter.process({ assets, discarded: [] }).assets;

    it('calcula el valor de la posición en USD', () => {
      const [result] = assess(asset({ amount: 2, purchasePrice: 1500 }));

      expect(result.positionValueUsd).toBe(3000);
    });

    it('marca como normal un activo bajo ambos umbrales', () => {
      const [result] = assess(asset({ volatility: 5 }));

      expect(result.riskLevel).toBe('normal');
      expect(result.riskFlags).toEqual([]);
    });

    it('Whale Alert: marca high_risk si el valor supera el umbral', () => {
      const [result] = assess(asset({ amount: 2, purchasePrice: 60_000 }));

      expect(result.riskLevel).toBe('high_risk');
      expect(result.riskFlags).toEqual([RiskFlag.WHALE_ALERT]);
    });

    it('marca high_risk si la volatilidad supera el umbral', () => {
      const [result] = assess(asset({ volatility: 25 }));

      expect(result.riskLevel).toBe('high_risk');
      expect(result.riskFlags).toEqual([RiskFlag.HIGH_VOLATILITY]);
    });

    it('acumula ambos motivos si se superan los dos umbrales', () => {
      const [result] = assess(asset({ amount: 10, purchasePrice: 50_000, volatility: 30 }));

      expect(result.riskFlags).toEqual([RiskFlag.WHALE_ALERT, RiskFlag.HIGH_VOLATILITY]);
    });

    it('igualar el umbral no alcanza: tiene que superarlo', () => {
      const [result] = assess(asset({ amount: 1, purchasePrice: 100_000, volatility: 10 }));

      expect(result.riskLevel).toBe('normal');
    });

    it('sin volatilidad informada solo evalúa el monto', () => {
      const [result] = assess(asset({ volatility: undefined }));

      expect(result.riskFlags).not.toContain(RiskFlag.HIGH_VOLATILITY);
    });

    it('conserva la lista de descartados del filtro anterior', () => {
      const discarded = [{ symbol: 'X', reason: 'cantidad en cero o negativa' }];
      const batch: ScrubbedBatch = { assets: [asset()], discarded };

      expect(filter.process(batch).discarded).toBe(discarded);
    });
  });

  describe('FormattingFilter', () => {
    const filter = new FormattingFilter();

    function assessed(overrides: Partial<RiskAssessedAsset> = {}): RiskAssessedAsset {
      return {
        ...asset(),
        positionValueUsd: 1000,
        riskLevel: 'normal',
        riskFlags: [],
        ...overrides,
      };
    }

    it('redondea los valores monetarios y porcentuales a dos decimales', () => {
      const report = filter.process({
        assets: [
          assessed({ purchasePrice: 1234.5678, positionValueUsd: 2469.1356, volatility: 12.345 }),
        ],
        discarded: [],
      });

      expect(report.assets[0]).toMatchObject({
        purchasePrice: 1234.57,
        positionValueUsd: 2469.14,
        volatility: 12.35,
      });
    });

    it('redondea la cantidad a 8 decimales para no perder fracciones de cripto', () => {
      const report = filter.process({
        assets: [assessed({ amount: 0.000512345678 })],
        discarded: [],
      });

      expect(report.assets[0].amount).toBe(0.00051235);
    });

    it('no agrega volatility si el activo no la tenía', () => {
      const report = filter.process({ assets: [assessed()], discarded: [] });

      expect(report.assets[0]).not.toHaveProperty('volatility');
    });

    it('agrega metadatos de auditoría con los conteos del análisis', () => {
      const report = filter.process({
        assets: [
          assessed({ positionValueUsd: 100.111 }),
          assessed({ riskLevel: 'high_risk', positionValueUsd: 200.222 }),
        ],
        discarded: [{ symbol: 'X', reason: 'r' }],
      });

      expect(report.metadata).toMatchObject({
        receivedCount: 3,
        analyzedCount: 2,
        discardedCount: 1,
        highRiskCount: 1,
        totalValueUsd: 300.33,
      });
      expect(report.metadata.analysisId).toMatch(/^[0-9a-f-]{36}$/);
      expect(new Date(report.metadata.analyzedAt).toISOString()).toBe(
        report.metadata.analyzedAt
      );
    });
  });

  describe('Pipeline de análisis completo', () => {
    const pipeline = buildAnalyticsPipeline(thresholds);

    it('ejecuta Validación -> Scrubbing -> Riesgo -> Formato, en ese orden', () => {
      expect(pipeline.filterNames).toEqual([
        'ValidationFilter',
        'ScrubbingFilter',
        'RiskAnalysisFilter',
        'FormattingFilter',
      ]);
    });

    it('produce el reporte a partir del array crudo', async () => {
      const report = await pipeline.run([
        { symbol: 'btc', amount: 3, purchasePrice: 40_000.456 }, // whale
        { symbol: 'doge', amount: 1000, purchasePrice: 0.08, volatility: 18.5 }, // volátil
        { symbol: 'eth', amount: 1, purchasePrice: 2500, volatility: 3 }, // normal
        { symbol: 'scam', amount: 0, purchasePrice: 1 }, // descartado
      ]);

      expect(report.assets.map((a) => [a.symbol, a.riskLevel])).toEqual([
        ['BTC', 'high_risk'],
        ['DOGE', 'high_risk'],
        ['ETH', 'normal'],
      ]);
      expect(report.assets[0].positionValueUsd).toBe(120_001.37);
      expect(report.discarded).toEqual([
        { symbol: 'SCAM', reason: 'cantidad en cero o negativa' },
      ]);
      expect(report.metadata).toMatchObject({
        receivedCount: 4,
        analyzedCount: 3,
        highRiskCount: 2,
      });
    });

    it('el orden importa: el monto descartado no cuenta para el total', async () => {
      const report = await pipeline.run([
        { symbol: 'BTC', amount: 1, purchasePrice: 100 },
        { symbol: 'NEG', amount: -50, purchasePrice: 100 },
      ]);

      expect(report.metadata.totalValueUsd).toBe(100);
    });

    it('fail-fast: un body que no es un array corta en ValidationFilter', async () => {
      await expect(pipeline.run({ symbol: 'BTC' })).rejects.toThrow(ValidationError);
    });

    it('rechaza un array vacío', async () => {
      await expect(pipeline.run([])).rejects.toThrow(ValidationError);
    });
  });

  describe('AnalysisService', () => {
    it('delega en el pipeline y devuelve el reporte', async () => {
      const service = new AnalysisService(buildAnalyticsPipeline(thresholds));

      const report = await service.analyze([asset()]);

      expect(report.metadata.analyzedCount).toBe(1);
    });
  });
});
