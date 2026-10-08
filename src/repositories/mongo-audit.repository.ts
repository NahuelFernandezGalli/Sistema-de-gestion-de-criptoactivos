import { AuditLogDocument, AuditLogModel } from '../database/mongo/audit-log.mongoose-model';
import { ServiceUnavailableError } from '../errors/app-error';
import { AuditLog } from '../models/audit.model';
import { IAuditRepository } from './audit.repository';

/**
 * Log de auditoría sobre MongoDB (Mongoose).
 *
 * Igual que la versión en memoria, solo permite agregar y leer. Las lecturas
 * usan `lean()`: devuelven objetos planos en vez de documentos de Mongoose,
 * que es más liviano y evita que se filtren tipos de Mongoose a otras capas.
 */
export class MongoAuditRepository implements IAuditRepository {
  constructor(private readonly model: AuditLogModel) {}

  async append(entry: AuditLog): Promise<AuditLog> {
    await withConnectionCheck(() =>
      this.model.create({
        _id: entry.id,
        assetId: entry.assetId,
        action: entry.action,
        timestamp: new Date(entry.timestamp),
        snapshot: entry.snapshot,
      })
    );
    return Object.freeze({ ...entry });
  }

  async findByAssetId(assetId: string): Promise<AuditLog[]> {
    const documents = await withConnectionCheck(() =>
      this.model.find({ assetId }).sort({ timestamp: 1, _id: 1 }).lean<AuditLogDocument[]>()
    );
    return documents.map(toAuditLog);
  }

  async findAll(): Promise<AuditLog[]> {
    const documents = await withConnectionCheck(() =>
      this.model.find().sort({ timestamp: 1, _id: 1 }).lean<AuditLogDocument[]>()
    );
    return documents.map(toAuditLog);
  }
}

/** Errores del driver que indican que MongoDB no está accesible. */
const CONNECTION_ERRORS = new Set([
  'MongoServerSelectionError',
  'MongooseServerSelectionError',
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
]);

/**
 * Si MongoDB está caído, la operación se rechaza con un 503 explícito en vez
 * de un 500 genérico: el cliente sabe que puede reintentar y que el cambio NO
 * se aplicó (AssetService deshace la transacción de MySQL).
 */
async function withConnectionCheck<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error && CONNECTION_ERRORS.has(error.name)) {
      throw new ServiceUnavailableError(
        'El sistema de auditoría (MongoDB) no está disponible. La operación no se realizó.'
      );
    }
    throw error;
  }
}

export function toAuditLog(document: AuditLogDocument): AuditLog {
  return {
    id: document._id,
    assetId: document.assetId,
    action: document.action,
    timestamp: new Date(document.timestamp).toISOString(),
    ...(document.snapshot !== undefined ? { snapshot: document.snapshot } : {}),
  };
}
