import { config } from '../config/env';
import { ExternalServiceError, NotFoundError } from '../errors/app-error';
import { fetchJson } from '../utils/http';

/**
 * Contrato del proveedor de precios de mercado.
 *
 * Gracias a esta abstracción, los tests inyectan un proveedor falso y no
 * dependen de internet, y cambiar CoinGecko por CoinCap o CryptoCompare es
 * escribir otra clase sin tocar la lógica de valuación.
 */
export interface IPriceProvider {
  /** Precio actual en USD del símbolo indicado (ej. "BTC"). */
  getPriceUsd(symbol: string): Promise<number>;
}

/**
 * CoinGecko no identifica los activos por símbolo ("BTC") sino por un id
 * propio ("bitcoin"), por eso hace falta esta traducción.
 */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDT: 'tether',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
};

export const SUPPORTED_SYMBOLS = Object.keys(SYMBOL_TO_COINGECKO_ID);

/** Implementación real contra la API pública de CoinGecko (fetch nativo de Node). */
export class CoinGeckoPriceProvider implements IPriceProvider {
  constructor(
    private readonly baseUrl: string = config.externalApiBaseUrl,
    private readonly timeoutMs: number = config.externalApiTimeoutMs
  ) {}

  async getPriceUsd(symbol: string): Promise<number> {
    const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];

    if (!coingeckoId) {
      throw new NotFoundError(
        `El símbolo "${symbol}" no está mapeado al proveedor de precios. Soportados: ${SUPPORTED_SYMBOLS.join(', ')}.`
      );
    }

    const url = `${this.baseUrl}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
    const data = await fetchJson<Record<string, { usd?: number }>>(
      url,
      this.timeoutMs,
      'servicio externo de precios de mercado',
      { symbol }
    );
    const price = data[coingeckoId]?.usd;

    if (typeof price !== 'number') {
      throw new ExternalServiceError(
        `El servicio externo no devolvió un precio válido para "${symbol}".`
      );
    }

    return price;
  }
}
