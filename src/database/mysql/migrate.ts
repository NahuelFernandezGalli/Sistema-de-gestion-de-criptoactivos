import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { createMigrator } from './migrator';
import { connectSequelize, createSequelize } from './sequelize';

/**
 * CLI de migraciones:
 *   npm run db:migrate          aplica las pendientes
 *   npm run db:migrate:undo     revierte la última
 *   npm run db:migrate:status   lista aplicadas y pendientes
 *
 * La API también aplica las pendientes al arrancar (ver persistence.ts), así
 * que en Docker no hace falta correr esto a mano.
 */
async function main(command: string): Promise<void> {
  const sequelize = createSequelize(config.persistence.mysqlUri);
  try {
    await connectSequelize(sequelize);
    const migrator = createMigrator(sequelize);

    if (command === 'up') {
      await migrator.up();
    } else if (command === 'down') {
      await migrator.down();
    } else if (command === 'status') {
      const executed = (await migrator.executed()).map((m) => m.name);
      const pending = (await migrator.pending()).map((m) => m.name);
      logger.info('Estado de las migraciones', { executed, pending });
    } else {
      throw new Error(`Comando desconocido "${command}". Usar: up | down | status`);
    }
  } finally {
    await sequelize.close();
  }
}

main(process.argv[2] ?? 'up').catch((error) => {
  logger.error('Falló la migración', { error: error instanceof Error ? error.message : error });
  process.exitCode = 1;
});
