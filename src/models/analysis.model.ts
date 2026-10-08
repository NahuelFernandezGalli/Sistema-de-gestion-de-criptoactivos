import { AnalysisAssetInput } from '../schemas/analysis.schema';

/**
 * Tipos del pipeline de análisis (POST /api/assets/analyze).
 *
 * Cada etapa tiene su propio tipo de salida, así la firma de cada filtro dice
 * qué garantiza: después del Scrubbing no hay montos inválidos, después del
 * RiskAnalysis cada activo tiene su nivel de riesgo, etc.
 */

/** Activo descartado por ScrubbingFilter y el motivo. */
export interface DiscardedAsset {
  symbol: string;
  reason: string;
}

/** Salida de ScrubbingFilter: activos válidos para analizar + descartados. */
export interface ScrubbedBatch {
  assets: AnalysisAssetInput[];
  discarded: DiscardedAsset[];
}

export type RiskLevel = 'high_risk' | 'normal';

/** Motivos por los que un activo se marca como `high_risk`. */
export enum RiskFlag {
  /** El valor de la posición supera el umbral de "ballena". */
  WHALE_ALERT = 'WHALE_ALERT',
  /** La volatilidad informada supera el umbral. */
  HIGH_VOLATILITY = 'HIGH_VOLATILITY',
}

export interface RiskAssessedAsset extends AnalysisAssetInput {
  /** amount * purchasePrice, en USD. */
  positionValueUsd: number;
  riskLevel: RiskLevel;
  riskFlags: RiskFlag[];
}

/** Salida de RiskAnalysisFilter. */
export interface RiskAssessedBatch {
  assets: RiskAssessedAsset[];
  discarded: DiscardedAsset[];
}

/** Resultado final del pipeline, armado por FormattingFilter. */
export interface AnalysisReport {
  metadata: {
    /** Identificador del análisis, para poder rastrearlo en los logs. */
    analysisId: string;
    analyzedAt: string;
    receivedCount: number;
    analyzedCount: number;
    discardedCount: number;
    highRiskCount: number;
    totalValueUsd: number;
  };
  assets: RiskAssessedAsset[];
  discarded: DiscardedAsset[];
}
