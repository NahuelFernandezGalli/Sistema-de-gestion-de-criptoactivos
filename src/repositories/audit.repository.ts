import { AuditLog } from '../models/audit.model';

/**
 * Contrato del log de auditoría.
 *
 * A propósito NO expone `update` ni `delete`: un historial de auditoría que se
 * puede editar no sirve como evidencia. Solo se puede agregar (append) y leer.
 */
export interface IAuditRepository {
  append(entry: AuditLog): AuditLog;
  findByAssetId(assetId: string): AuditLog[];
  findAll(): AuditLog[];
}

/** Implementación en memoria del log inmutable de auditoría. */
export class InMemoryAuditRepository implements IAuditRepository {
  private readonly entries: AuditLog[] = [];

  append(entry: AuditLog): AuditLog {
    // Object.freeze evita mutaciones accidentales del registro ya escrito.
    const frozen = Object.freeze({ ...entry });
    this.entries.push(frozen);
    return frozen;
  }

  /** Devuelve los eventos del activo ordenados cronológicamente (más antiguo primero). */
  findByAssetId(assetId: string): AuditLog[] {
    return this.entries
      .filter((entry) => entry.assetId === assetId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  findAll(): AuditLog[] {
    return [...this.entries];
  }
}
