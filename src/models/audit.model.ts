/** Acciones auditables sobre un activo del portafolio. */
export const AuditAction = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;

export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

/**
 * Registro inmutable de auditoría.
 *
 * Cada movimiento del portafolio genera uno de estos. El repositorio de
 * auditoría solo expone operaciones de escritura por append y de lectura:
 * no hay update ni delete, que es lo que hace al historial confiable.
 */
export interface AuditLog {
  /** Identificador único del registro (UUID v4). */
  id: string;
  /** Activo afectado. Se conserva aunque el activo haya sido eliminado. */
  assetId: string;
  /** Tipo de operación registrada. */
  action: AuditAction;
  /** Momento del evento (ISO 8601). */
  timestamp: string;
  /**
   * Estado relevante del activo en el momento del evento.
   * Permite reconstruir qué cambió sin consultar el estado actual.
   * Su forma depende de la acción: el activo completo en CREATE y DELETE,
   * un par `{ before, after }` en UPDATE.
   */
  snapshot?: unknown;
}
