import { randomUUID } from 'crypto';
import {
  AnalysisReport,
  RiskAssessedAsset,
  RiskAssessedBatch,
} from '../../../models/analysis.model';
import { logger } from '../../../utils/logger';
import { round } from '../../../utils/math';
import { Filter } from '../../pipeline';

/**
 * Último filtro del análisis: redondea los valores numéricos a dos decimales y
 * arma el reporte con metadatos de auditoría (id del análisis, fecha y
 * conteos), para poder rastrear cada análisis en los logs.
 *
 * Excepción: `amount` se redondea a 8 decimales y no a 2. Una cantidad de
 * cripto como 0.0005 BTC (unos USD 40) quedaría en 0.00 y el reporte mostraría
 * una posición vacía. 8 decimales es la precisión de un satoshi.
 */
export class FormattingFilter implements Filter<RiskAssessedBatch, AnalysisReport> {
  readonly name = 'FormattingFilter';

  process(input: RiskAssessedBatch): AnalysisReport {
    const assets = input.assets.map(formatAsset);

    const report: AnalysisReport = {
      metadata: {
        analysisId: randomUUID(),
        analyzedAt: new Date().toISOString(),
        receivedCount: assets.length + input.discarded.length,
        analyzedCount: assets.length,
        discardedCount: input.discarded.length,
        highRiskCount: assets.filter((asset) => asset.riskLevel === 'high_risk').length,
        totalValueUsd: round(
          input.assets.reduce((total, asset) => total + asset.positionValueUsd, 0)
        ),
      },
      assets,
      discarded: input.discarded,
    };

    logger.info(`${this.name}: reporte ${report.metadata.analysisId} formateado.`);
    return report;
  }
}

function formatAsset(asset: RiskAssessedAsset): RiskAssessedAsset {
  return {
    ...asset,
    amount: round(asset.amount, 8),
    purchasePrice: round(asset.purchasePrice),
    positionValueUsd: round(asset.positionValueUsd),
    ...(asset.volatility !== undefined ? { volatility: round(asset.volatility) } : {}),
  };
}
