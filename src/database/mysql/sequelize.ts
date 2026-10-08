import { Options, Sequelize } from 'sequelize';
import { logger } from '../../utils/logger';

/**
 * Crea la conexión de Sequelize a partir de una cadena de conexión
 * (ej. `mysql://user:pass@host:3306/db`). Las queries SQL se loguean en nivel
 * debug, así no ensucian la salida normal pero se pueden ver con LOG_LEVEL=debug.
 */
export function createSequelize(uri: string, options: Options = {}): Sequelize {
  return new Sequelize(uri, {
    logging: (sql) => logger.debug(sql),
    ...options,
  });
}

/** Verifica la conexión (falla rápido si MySQL no está disponible). */
export async function connectSequelize(sequelize: Sequelize): Promise<void> {
  await sequelize.authenticate();
  logger.info('Conectado a MySQL', {
    database: sequelize.getDatabaseName(),
    dialect: sequelize.getDialect(),
  });
}
