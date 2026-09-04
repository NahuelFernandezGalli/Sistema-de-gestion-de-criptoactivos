import { createApp } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info('Servidor iniciado', {
    port: config.port,
    env: config.env,
    url: `http://localhost:${config.port}`,
  });
});

/**
 * Apagado ordenado: deja de aceptar conexiones nuevas y espera a que terminen
 * las en curso antes de salir. Sin esto, `docker stop` corta requests a la mitad.
 */
function shutdown(signal: string): void {
  logger.info('Señal de apagado recibida, cerrando servidor', { signal });

  server.close(() => {
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });

  // Red de seguridad: si algo queda colgado, no esperamos para siempre.
  setTimeout(() => {
    logger.error('Cierre forzado: el servidor no terminó a tiempo');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Promesa rechazada sin manejar', { reason: String(reason) });
});
