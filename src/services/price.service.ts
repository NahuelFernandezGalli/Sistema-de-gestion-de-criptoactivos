import { config } from '../config/env';

/**
 * Mapa de símbolos comunes a los IDs que utiliza la API de CoinGecko.
 * CoinGecko no identifica los activos por símbolo (ej. "BTC") sino por
 * un id propio (ej. "bitcoin"), por eso se necesita esta traducción.
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

export class ExternalPriceServiceError extends Error {
  constructor(message: string, public readonly statusCode = 502) {
    super(message);
    this.name = 'ExternalPriceServiceError';
  }
}

/**
 * Consulta el precio actual (en USD) de un criptoactivo a un servicio
 * externo de precios de mercado (CoinGecko), usando el fetch nativo de
 * Node.js (sin librerías externas tipo axios).
 */
export async function getCurrentPrice(symbol: string): Promise<number> {
  const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol.toUpperCase()];

  if (!coingeckoId) {
    throw new ExternalPriceServiceError(
      `No se encontró un mapeo para el símbolo "${symbol}". Símbolos soportados: ${Object.keys(
        SYMBOL_TO_COINGECKO_ID
      ).join(', ')}`,
      404
    );
  }

  const url = `${config.externalApiBaseUrl}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    throw new ExternalPriceServiceError(
      'No se pudo contactar al servicio externo de precios de mercado.'
    );
  }

  if (!response.ok) {
    throw new ExternalPriceServiceError(
      `El servicio externo respondió con estado ${response.status}.`,
      response.status
    );
  }

  const data = (await response.json()) as Record<string, { usd: number }>;
  const price = data[coingeckoId]?.usd;

  if (price === undefined) {
    throw new ExternalPriceServiceError(
      `El servicio externo no devolvió un precio para "${symbol}".`
    );
  }

  return price;
}
