import { CreateAssetDTO } from '../../../schemas/asset.schema';
import { IExchangeRateProvider } from '../../../services/exchange-rate-provider.service';
import { logger } from '../../../utils/logger';
import { Filter } from '../../pipeline';
import { NormalizedAssetInput } from './normalization.filter';

/**
 * El portafolio guarda todos los precios en USD. Si el precio de compra vino
 * en otra moneda, consulta la tasa y lo convierte; si ya está en USD no sale
 * a la red.
 *
 * Es el último filtro de la ingesta, así que su salida ya es el DTO que
 * persiste el service (sin el campo `currency`).
 */
export class CurrencyConversionFilter implements Filter<NormalizedAssetInput, CreateAssetDTO> {
  readonly name = 'CurrencyConversionFilter';

  constructor(private readonly exchangeRateProvider: IExchangeRateProvider) {}

  async process(input: NormalizedAssetInput): Promise<CreateAssetDTO> {
    const { currency, ...asset } = input;

    if (currency === 'USD') {
      logger.info(`${this.name}: ${asset.symbol} ya está en USD, sin conversión.`);
      return asset;
    }

    const rate = await this.exchangeRateProvider.getUsdRate(currency);
    const purchasePrice = roundPrice(asset.purchasePrice * rate);

    logger.info(
      `${this.name}: ${asset.symbol} ${asset.purchasePrice} ${currency} -> ${purchasePrice} USD.`,
      { rate }
    );
    return { ...asset, purchasePrice };
  }
}

/**
 * 8 decimales: suficiente para monedas de precio muy bajo (ej. SHIB) y elimina
 * la basura del punto flotante de la multiplicación.
 */
function roundPrice(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}
