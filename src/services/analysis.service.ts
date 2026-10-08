import { AnalysisReport } from '../models/analysis.model';
import { AnalyticsPipeline } from '../pipeline/analytics.pipeline';
import { logger } from '../utils/logger';

/**
 * Análisis de riesgo de un lote de activos.
 *
 * Toda la lógica vive en los filtros del pipeline; el service es el punto de
 * entrada de la capa de negocio para el controller, que así no sabe que por
 * debajo hay un pipeline (podría cambiarse sin tocar la capa HTTP).
 */
export class AnalysisService {
  constructor(private readonly analyticsPipeline: AnalyticsPipeline) {}

  async analyze(input: unknown): Promise<AnalysisReport> {
    const report = await this.analyticsPipeline.run(input);

    logger.info('Análisis de activos completado', {
      analysisId: report.metadata.analysisId,
      analyzed: report.metadata.analyzedCount,
      highRisk: report.metadata.highRiskCount,
    });
    return report;
  }
}
