import { Connection, Model, Schema } from 'mongoose';
import { AuditAction } from '../../models/audit.model';

/**
 * Documento de auditoría en MongoDB (colección `audit_logs`).
 *
 * MongoDB encaja con la auditoría: es un log que solo crece, se consulta por
 * activo y su `snapshot` cambia de forma según la acción (activo completo en
 * CREATE/DELETE, `{ before, after }` en UPDATE), algo incómodo en una tabla
 * con columnas fijas.
 */
export interface AuditLogDocument {
  /** El UUID que genera el service se usa como `_id` del documento. */
  _id: string;
  assetId: string;
  action: AuditAction;
  timestamp: Date;
  snapshot?: unknown;
}

export class ImmutableAuditLogError extends Error {
  constructor() {
    super('El log de auditoría es inmutable: no se pueden modificar ni borrar registros.');
  }
}

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    _id: { type: String, required: true },
    assetId: { type: String, required: true },
    action: { type: String, required: true, enum: Object.values(AuditAction) },
    timestamp: { type: Date, required: true },
    snapshot: { type: Schema.Types.Mixed },
  },
  {
    collection: 'audit_logs',
    versionKey: false,
    // Un campo que no está en el esquema es un error, no se ignora en silencio.
    strict: 'throw',
  }
);

// Cubre la consulta de historial: filtra por activo y ordena por fecha.
auditLogSchema.index({ assetId: 1, timestamp: 1 });

/*
 * Inmutabilidad reforzada en el modelo: además de que el repositorio no expone
 * update ni delete, cualquier intento de modificar o borrar por Mongoose falla.
 */
auditLogSchema.pre(
  [
    'updateOne',
    'updateMany',
    'findOneAndUpdate',
    'replaceOne',
    'findOneAndReplace',
    'deleteOne',
    'deleteMany',
    'findOneAndDelete',
  ],
  () => {
    throw new ImmutableAuditLogError();
  }
);

auditLogSchema.pre('save', function () {
  if (!this.isNew) throw new ImmutableAuditLogError();
});

export type AuditLogModel = Model<AuditLogDocument>;

/** Registra el modelo sobre una conexión concreta (no la global de mongoose). */
export function defineAuditLogModel(connection: Connection): AuditLogModel {
  return connection.model<AuditLogDocument>('AuditLog', auditLogSchema);
}
