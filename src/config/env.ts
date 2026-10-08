/**
 * Configuración centralizada de la aplicación.
 *
 * Las variables se cargan de forma nativa con el flag `--env-file=.env`
 * de Node.js (>= 20.6), sin depender de librerías externas como dotenv.
 * Este módulo es el ÚNICO lugar que lee `process.env`: el resto de la app
 * importa `config`, lo que facilita testear y cambiar el origen de la
 * configuración sin tocar el código de negocio.
 */

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: readNumber(process.env.PORT, 3000),

  /** Servicio externo de precios de mercado (CoinGecko por defecto). */
  externalApiBaseUrl:
    process.env.EXTERNAL_API_BASE_URL ?? 'https://api.coingecko.com/api/v3',

  /** Timeout para las llamadas al servicio externo (ms). */
  externalApiTimeoutMs: readNumber(process.env.EXTERNAL_API_TIMEOUT_MS, 5000),

  /** TTL de la caché de precios de mercado (ms). */
  priceCacheTtlMs: readNumber(process.env.PRICE_CACHE_TTL_MS, 30_000),

  /** TTL de la caché de tasas de cambio fiat (ms). Cambian poco: 10 minutos. */
  exchangeRateCacheTtlMs: readNumber(process.env.EXCHANGE_RATE_CACHE_TTL_MS, 600_000),

  logging: {
    level: process.env.LOG_LEVEL ?? 'info',
    file: process.env.LOG_FILE ?? 'logs/app.log',
    /** En tests silenciamos la salida para no ensuciar el reporte de Jest. */
    silent: process.env.NODE_ENV === 'test',
  },

  /** Rate limiting del endpoint de mercado: 5 peticiones por minuto por IP. */
  rateLimit: {
    windowMs: readNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    max: readNumber(process.env.RATE_LIMIT_MAX, 5),
  },
} as const;
