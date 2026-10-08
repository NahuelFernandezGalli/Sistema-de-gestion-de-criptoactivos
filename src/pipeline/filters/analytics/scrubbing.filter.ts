import { ScrubbedBatch } from '../../../models/analysis.model';
import { AnalysisAssetInput } from '../../../schemas/analysis.schema';
import { logger } from '../../../utils/logger';
import { Filter } from '../../pipeline';

/**
 * Descarta los activos con montos en cero o negativos (cantidad o precio),
 * que no tienen sentido en un análisis de riesgo y distorsionarían totales.
 *
 * No corta el pipeline: los descartados se informan en el reporte final con
 * su motivo, así el cliente sabe qué quedó afuera y por qué.
 */
export class ScrubbingFilter implements Filter<AnalysisAssetInput[], ScrubbedBatch> {
  readonly name = 'ScrubbingFilter';

  process(input: AnalysisAssetInput[]): ScrubbedBatch {
    const batch: ScrubbedBatch = { assets: [], discarded: [] };

    for (const asset of input) {
      const reason = discardReason(asset);
      if (reason) {
        batch.discarded.push({ symbol: asset.symbol, reason });
        logger.info(`${this.name}: ${asset.symbol} descartado (${reason}).`);
      } else {
        batch.assets.push(asset);
      }
    }

    logger.info(
      `${this.name}: ${batch.assets.length} activos válidos, ${batch.discarded.length} descartados.`
    );
    return batch;
  }
}

function discardReason(asset: AnalysisAssetInput): string | undefined {
  if (asset.amount <= 0) return 'cantidad en cero o negativa';
  if (asset.purchasePrice <= 0) return 'precio en cero o negativo';
  return undefined;
}
