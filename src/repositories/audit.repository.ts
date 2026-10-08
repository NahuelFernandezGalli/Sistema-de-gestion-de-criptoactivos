import { AuditLog } from '../models/audit.model';

/**
 * Contrato del log de auditoría.
 *
 * A propósito NO expone `update` ni `delete`: un historial de auditoría que se
 * puede editar no sirve como evidencia. Solo se puede agregar (append) y leer.
 * Hay dos implementaciones: MongoDB con Mongoose (`MongoAuditRepository`) y
 * esta en memoria.
 */
export interface IAuditRepository {
  append(entry: AuditLog): Promise<AuditLog>;
  /** Eventos del activo en orden cronológico (más antiguo primero). */
  findByAssetId(assetId: string): Promise<AuditLog[]>;
  findAll(): Promise<AuditLog[]>;
}

/** Implementación en memoria del log inmutable de auditoría. */
export class InMemoryAuditRepository implements IAuditRepository {
  private readonly entries: AuditLog[] = [];

  async append(entry: AuditLog): Promise<AuditLog> {
    // Object.freeze evita mutaciones accidentales del registro ya escrito.
    const frozen = Object.freeze({ ...entry });
    this.entries.push(frozen);
    return frozen;
  }

  async findByAssetId(assetId: string): Promise<AuditLog[]> {
    return this.entries
      .filter((entry) => entry.assetId === assetId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async findAll(): Promise<AuditLog[]> {
    return [...this.entries];
  }
}
