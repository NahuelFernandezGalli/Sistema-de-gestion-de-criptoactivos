import mongoose, { Connection } from 'mongoose';
import { logger } from '../../utils/logger';

/**
 * Abre una conexión propia a MongoDB (en lugar de usar la conexión global de
 * mongoose) para poder cerrarla explícitamente en el apagado ordenado.
 *
 * Los eventos de la conexión se loguean: si MongoDB se cae, la auditoría no se
 * puede escribir y las operaciones sobre activos fallan (ver AssetService),
 * así que es importante que quede registrado.
 */
export async function connectMongo(uri: string): Promise<Connection> {
  const connection = mongoose.createConnection(uri, {
    // Falla rápido al arrancar si MongoDB no responde, en vez de colgarse.
    serverSelectionTimeoutMS: 5000,
  });

  connection.on('disconnected', () => logger.warn('Se perdió la conexión con MongoDB'));
  connection.on('reconnected', () => logger.info('Reconectado a MongoDB'));
  connection.on('error', (error: Error) =>
    logger.error('Error en la conexión con MongoDB', { error: error.message })
  );

  await connection.asPromise();
  logger.info('Conectado a MongoDB', { database: connection.name });
  return connection;
}
