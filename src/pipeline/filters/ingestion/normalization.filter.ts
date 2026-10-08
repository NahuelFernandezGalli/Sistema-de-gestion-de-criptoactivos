import { CreateAssetInput, SupportedCurrency } from '../../../schemas/asset.schema';
import { logger } from '../../../utils/logger';
import { normalizeCurrency, normalizeName, normalizeSymbol } from '../../../utils/normalize';
import { Filter } from '../../pipeline';

/** Alta normalizada: mismos campos, pero con formato canónico. */
export type NormalizedAssetInput = Omit<CreateAssetInput, 'currency'> & {
  currency: SupportedCurrency;
};

/**
 * Lleva el activo a su formato canónico: símbolo en mayúsculas y sin espacios
 * en los extremos, nombre sin espacios extra y código de moneda en mayúsculas.
 *
 * Sin esto " btc" y "BTC" serían dos posiciones distintas y el control de
 * símbolos duplicados del service no las detectaría.
 */
export class NormalizationFilter implements Filter<CreateAssetInput, NormalizedAssetInput> {
  readonly name = 'NormalizationFilter';

  process(input: CreateAssetInput): NormalizedAssetInput {
    const normalized: NormalizedAssetInput = {
      ...input,
      symbol: normalizeSymbol(input.symbol),
      name: normalizeName(input.name),
      // ValidationFilter ya garantizó que es una moneda soportada.
      currency: normalizeCurrency(input.currency) as SupportedCurrency,
    };

    logger.info(`${this.name}: Symbol ${normalized.symbol} normalized.`, {
      original: input.symbol,
    });
    return normalized;
  }
}
