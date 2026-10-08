import { randomUUID } from 'crypto';
import { config } from '../config/env';
import { Asset } from '../models/asset.model';
import { IAssetRepository, InMemoryAssetRepository } from '../repositories/asset.repository';
import { IAuditRepository, InMemoryAuditRepository } from '../repositories/audit.repository';
import { MongoAuditRepository } from '../repositories/mongo-audit.repository';
import { SequelizeAssetRepository } from '../repositories/sequelize-asset.repository';
import { logger } from '../utils/logger';
import { defineAuditLogModel } from './mongo/audit-log.mongoose-model';
import { connectMongo } from './mongo/mongo';
import { defineAssetModel } from './mysql/asset.sequelize-model';
import { createMigrator } from './mysql/migrator';
import { connectSequelize, createSequelize } from './mysql/sequelize';

/** Repositorios listos para usar + cómo cerrar sus conexiones. */
export interface Persistence {
  assetRepository: IAssetRepository;
  auditRepository: IAuditRepository;
  close(): Promise<void>;
}

/**
 * Arma la capa de persistencia según `PERSISTENCE_DRIVER`.
 *
 * Con `database` conecta a MySQL, aplica las migraciones pendientes y conecta
 * a MongoDB. Si alguna conexión falla, la app no arranca: es preferible a
 * levantar una API que va a fallar en cada request.
 */
export async function initPersistence(
  settings: typeof config.persistence = config.persistence
): Promise<Persistence> {
  if (settings.driver === 'memory') {
    logger.warn('Persistencia EN MEMORIA: los datos se pierden al reiniciar.');
    return {
      assetRepository: new InMemoryAssetRepository(seedAssets()),
      auditRepository: new InMemoryAuditRepository(),
      close: async () => undefined,
    };
  }

  const sequelize = createSequelize(settings.mysqlUri);
  try {
    await connectSequelize(sequelize);
    await createMigrator(sequelize).up();
  } catch (error) {
    await sequelize.close();
    throw error;
  }

  let mongo;
  try {
    mongo = await connectMongo(settings.mongoUri);
  } catch (error) {
    await sequelize.close();
    throw error;
  }

  return {
    assetRepository: new SequelizeAssetRepository(sequelize, defineAssetModel(sequelize)),
    auditRepository: new MongoAuditRepository(defineAuditLogModel(mongo)),
    close: async () => {
      await Promise.allSettled([sequelize.close(), mongo.close()]);
      logger.info('Conexiones a MySQL y MongoDB cerradas');
    },
  };
}

/** Datos de ejemplo para el modo en memoria (la base arranca vacía). */
function seedAssets(): Asset[] {
  const now = new Date().toISOString();
  return [
    {
      id: randomUUID(),
      symbol: 'BTC',
      name: 'Bitcoin',
      amount: 0.5,
      purchasePrice: 42000,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: randomUUID(),
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 3,
      purchasePrice: 2500,
      createdAt: now,
      updatedAt: now,
    },
  ];
}
