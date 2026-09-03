/**
 * Configuración centralizada leída de variables de entorno.
 * Las variables se cargan de forma nativa con el flag `--env-file=.env`
 * de Node.js (>=20.6), sin depender de librerías externas como dotenv.
 */
export const config = {
  port: process.env.PORT ? Number(process.env.PORT) : 3000,
  externalApiBaseUrl:
    process.env.EXTERNAL_API_BASE_URL ?? 'https://api.coingecko.com/api/v3',
};
