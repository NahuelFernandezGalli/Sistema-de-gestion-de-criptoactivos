import { createAssetSchema, CreateAssetDTO } from '../schemas/asset.schema';
import { IExchangeRateProvider } from '../services/exchange-rate-provider.service';
import { CurrencyConversionFilter } from './filters/ingestion/currency-conversion.filter';
import { NormalizationFilter } from './filters/ingestion/normalization.filter';
import { ValidationFilter } from './filters/validation.filter';
import { Pipeline } from './pipeline';

/** Pipeline de ingesta: payload crudo del POST -> DTO listo para persistir. */
export type IngestionPipeline = Pipeline<unknown, CreateAssetDTO>;

/**
 * Validación -> Normalización -> Conversión de moneda.
 *
 * El orden importa: normalizar antes de validar dejaría pasar tipos inválidos
 * a `trim()`, y convertir antes de normalizar recibiría monedas en minúscula.
 */
export function buildIngestionPipeline(
  exchangeRateProvider: IExchangeRateProvider
): IngestionPipeline {
  return Pipeline.create<unknown>('IngestionPipeline')
    .pipe(new ValidationFilter(createAssetSchema))
    .pipe(new NormalizationFilter())
    .pipe(new CurrencyConversionFilter(exchangeRateProvider));
}
