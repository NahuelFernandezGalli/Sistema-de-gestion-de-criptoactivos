import { config } from '../config/env';
import { ExternalServiceError } from '../errors/app-error';
import { TtlCache } from '../utils/cache';
import { fetchJson } from '../utils/http';
import { logger } from '../utils/logger';

/**
 * Contrato del proveedor de tasas de cambio fiat.
 *
 * Lo consume `CurrencyConversionFilter`; los tests inyectan uno falso con
 * tasas fijas para no depender de internet.
 */
export interface IExchangeRateProvider {
  /** Cuántos USD vale 1 unidad de `currency` (ej. EUR -> 1.08). */
  getUsdRate(currency: string): Promise<number>;
}

interface CoinGeckoExchangeRates {
  rates?: Record<string, { value?: number }>;
}

const RATES_CACHE_KEY = 'rates';

/**
 * Implementación contra `GET /exchange_rates` de CoinGecko.
 *
 * Ese endpoint no da tasas fiat directas: da cuántas unidades de cada moneda
 * vale 1 BTC. La tasa a USD sale de dividir ambas cotizaciones:
 *   1 EUR = (USD por BTC) / (EUR por BTC) USD
 *
 * Reutiliza la misma base URL que el proveedor de precios (no suma otra API
 * ni otra API key) y cachea la tabla completa, porque una sola llamada trae
 * todas las monedas y las tasas fiat cambian poco en minutos.
 */
export class CoinGeckoExchangeRateProvider implements IExchangeRateProvider {
  constructor(
    private readonly baseUrl: string = config.externalApiBaseUrl,
    private readonly timeoutMs: number = config.externalApiTimeoutMs,
    private readonly cache = new TtlCache<Record<string, number>>(
      config.exchangeRateCacheTtlMs
    )
  ) {}

  async getUsdRate(currency: string): Promise<number> {
    const code = currency.toUpperCase();
    if (code === 'USD') return 1;

    const btcRates = await this.getBtcRates();
    const usdPerBtc = btcRates.usd;
    const currencyPerBtc = btcRates[code.toLowerCase()];

    if (!usdPerBtc || !currencyPerBtc) {
      throw new ExternalServiceError(
        `El servicio externo no devolvió una tasa de cambio para "${code}".`
      );
    }

    return usdPerBtc / currencyPerBtc;
  }

  private async getBtcRates(): Promise<Record<string, number>> {
    const cached = this.cache.get(RATES_CACHE_KEY);
    if (cached) {
      logger.debug('Tasas de cambio servidas desde caché');
      return cached;
    }

    const data = await fetchJson<CoinGeckoExchangeRates>(
      `${this.baseUrl}/exchange_rates`,
      this.timeoutMs,
      'servicio externo de tasas de cambio'
    );

    const rates: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates ?? {})) {
      if (typeof rate.value === 'number' && rate.value > 0) {
        rates[code] = rate.value;
      }
    }

    this.cache.set(RATES_CACHE_KEY, rates);
    logger.info('Tasas de cambio obtenidas del servicio externo', {
      currencies: Object.keys(rates).length,
    });
    return rates;
  }
}
