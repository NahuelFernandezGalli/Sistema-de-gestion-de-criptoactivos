import { AnalysisReport } from '../models/analysis.model';
import { analyzeAssetsSchema } from '../schemas/analysis.schema';
import { FormattingFilter } from './filters/analytics/formatting.filter';
import { RiskAnalysisFilter, RiskThresholds } from './filters/analytics/risk-analysis.filter';
import { ScrubbingFilter } from './filters/analytics/scrubbing.filter';
import { ValidationFilter } from './filters/validation.filter';
import { Pipeline } from './pipeline';

/** Pipeline de análisis: array crudo del POST -> reporte de riesgo. */
export type AnalyticsPipeline = Pipeline<unknown, AnalysisReport>;

/**
 * Validación -> Scrubbing -> Análisis de riesgo -> Formato.
 *
 * El ValidationFilter es el mismo filtro genérico de la ingesta con otro
 * esquema: los filtros se reutilizan entre pipelines.
 */
export function buildAnalyticsPipeline(thresholds: RiskThresholds): AnalyticsPipeline {
  return Pipeline.create<unknown>('AnalyticsPipeline')
    .pipe(new ValidationFilter(analyzeAssetsSchema))
    .pipe(new ScrubbingFilter())
    .pipe(new RiskAnalysisFilter(thresholds))
    .pipe(new FormattingFilter());
}
