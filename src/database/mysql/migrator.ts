import { QueryInterface, Sequelize } from 'sequelize';
import { SequelizeStorage, Umzug } from 'umzug';
import { logger } from '../../utils/logger';
import * as createAssets from './migrations/20261008120000-create-assets';

/**
 * Migraciones en orden de aplicación. Se listan explícitamente (en lugar de
 * buscarlas con un glob) para que funcionen igual desde TypeScript (tests) y
 * desde el `dist/` compilado.
 */
const MIGRATIONS = [{ name: '20261008120000-create-assets', module: createAssets }];

/**
 * Migrador (Umzug, la librería de migraciones que usa sequelize-cli por
 * debajo). Registra las migraciones aplicadas en la tabla `SequelizeMeta`, así
 * que correrlo de nuevo solo aplica las pendientes.
 */
export function createMigrator(sequelize: Sequelize): Umzug<QueryInterface> {
  return new Umzug({
    migrations: MIGRATIONS.map(({ name, module }) => ({
      name,
      up: module.up,
      down: module.down,
    })),
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: {
      info: (event) => logger.info('Migración', event),
      warn: (event) => logger.warn('Migración', event),
      error: (event) => logger.error('Migración', event),
      debug: (event) => logger.debug('Migración', event),
    },
  });
}
