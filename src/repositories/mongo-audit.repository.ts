import { AuditLogDocument, AuditLogModel } from '../database/mongo/audit-log.mongoose-model';
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
    await this.model.create({
      _id: entry.id,
      assetId: entry.assetId,
      action: entry.action,
      timestamp: new Date(entry.timestamp),
      snapshot: entry.snapshot,
    });
    return Object.freeze({ ...entry });
  }

  async findByAssetId(assetId: string): Promise<AuditLog[]> {
    const documents = await this.model
      .find({ assetId })
      .sort({ timestamp: 1, _id: 1 })
      .lean<AuditLogDocument[]>();
    return documents.map(toAuditLog);
  }

  async findAll(): Promise<AuditLog[]> {
    const documents = await this.model
      .find()
      .sort({ timestamp: 1, _id: 1 })
      .lean<AuditLogDocument[]>();
    return documents.map(toAuditLog);
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
