import { Server } from 'http';
import { createApp } from './app';
import { config } from './config/env';
import { buildContainer } from './container';
import { initPersistence, Persistence } from './database/persistence';
import { logger } from './utils/logger';

/**
 * Arranque: primero las conexiones a MySQL y MongoDB (con migraciones), y
 * recién después se abre el puerto. Así la API nunca acepta requests que no
 * puede atender.
 */
async function main(): Promise<void> {
  const persistence = await initPersistence();
  const app = createApp(buildContainer(persistence));

  const server = app.listen(config.port, () => {
    logger.info('Servidor iniciado', {
      port: config.port,
      env: config.env,
      persistence: config.persistence.driver,
      url: `http://localhost:${config.port}`,
    });
  });

  process.on('SIGTERM', () => shutdown('SIGTERM', server, persistence));
  process.on('SIGINT', () => shutdown('SIGINT', server, persistence));
}

/**
 * Apagado ordenado: deja de aceptar conexiones nuevas, espera a que terminen
 * las en curso y recién ahí cierra las conexiones a las bases. Sin esto,
 * `docker stop` corta requests a la mitad.
 */
function shutdown(signal: string, server: Server, persistence: Persistence): void {
  logger.info('Señal de apagado recibida, cerrando servidor', { signal });

  server.close(async () => {
    await persistence.close();
    logger.info('Servidor cerrado correctamente');
    process.exit(0);
  });

  // Red de seguridad: si algo queda colgado, no esperamos para siempre.
  setTimeout(() => {
    logger.error('Cierre forzado: el servidor no terminó a tiempo');
    process.exit(1);
  }, 10_000).unref();
}

process.on('unhandledRejection', (reason) => {
  logger.error('Promesa rechazada sin manejar', { reason: String(reason) });
});

main().catch((error) => {
  // Algunos errores de conexión de Sequelize traen el mensaje vacío y el
  // detalle real en `parent`/`cause` (ej. ECONNREFUSED).
  const cause = error?.parent ?? error?.cause;
  logger.error('No se pudo iniciar la aplicación', {
    error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    ...(cause ? { cause: cause.code ?? cause.message ?? String(cause) } : {}),
  });
  process.exit(1);
});
