import {
  RiskAssessedAsset,
  RiskAssessedBatch,
  RiskFlag,
  ScrubbedBatch,
} from '../../../models/analysis.model';
import { AnalysisAssetInput } from '../../../schemas/analysis.schema';
import { logger } from '../../../utils/logger';
import { Filter } from '../../pipeline';

export interface RiskThresholds {
  /** Valor de posición en USD a partir del cual hay Whale Alert. */
  whaleThresholdUsd: number;
  /** Volatilidad (%) a partir de la cual el activo es de alto riesgo. */
  volatilityThresholdPct: number;
}

/**
 * Marca cada activo como `high_risk` si su volatilidad o el valor de la
 * posición superan los umbrales (Whale Alert); si no, como `normal`.
 *
 * Además del nivel, guarda en `riskFlags` POR QUÉ se marcó, para que el
 * reporte sea accionable. Los umbrales llegan por constructor (vienen de la
 * configuración), así se pueden testear con valores chicos.
 */
export class RiskAnalysisFilter implements Filter<ScrubbedBatch, RiskAssessedBatch> {
  readonly name = 'RiskAnalysisFilter';

  constructor(private readonly thresholds: RiskThresholds) {}

  process(input: ScrubbedBatch): RiskAssessedBatch {
    const assets = input.assets.map((asset) => this.assess(asset));
    const highRisk = assets.filter((asset) => asset.riskLevel === 'high_risk');

    for (const asset of highRisk) {
      logger.warn(
        `${this.name}: ${asset.symbol} marcado como high_risk (${asset.riskFlags.join(', ')}).`,
        { positionValueUsd: asset.positionValueUsd, volatility: asset.volatility }
      );
    }
    logger.info(
      `${this.name}: ${assets.length} activos analizados, ${highRisk.length} de alto riesgo.`
    );

    return { assets, discarded: input.discarded };
  }

  private assess(asset: AnalysisAssetInput): RiskAssessedAsset {
    const positionValueUsd = asset.amount * asset.purchasePrice;
    const riskFlags: RiskFlag[] = [];

    if (positionValueUsd > this.thresholds.whaleThresholdUsd) {
      riskFlags.push(RiskFlag.WHALE_ALERT);
    }
    if (
      asset.volatility !== undefined &&
      asset.volatility > this.thresholds.volatilityThresholdPct
    ) {
      riskFlags.push(RiskFlag.HIGH_VOLATILITY);
    }

    return {
      ...asset,
      positionValueUsd,
      riskLevel: riskFlags.length > 0 ? 'high_risk' : 'normal',
      riskFlags,
    };
  }
}
