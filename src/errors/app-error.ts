/**
 * Jerarquía de errores de aplicación.
 *
 * Las capas de dominio (services) lanzan estos errores sin saber nada de HTTP;
 * el middleware de errores es el único que los traduce a códigos de estado.
 * Así la lógica de negocio queda desacoplada del transporte.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 - El input no cumple el esquema de validación. */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/** 404 - El recurso solicitado no existe. */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, 'NOT_FOUND');
  }
}

/** 409 - La operación choca con el estado actual del recurso. */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

/** 422 - El input es sintácticamente válido pero viola una regla de negocio. */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION');
  }
}

/** 502 - Falló la comunicación con un servicio externo. */
export class ExternalServiceError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode, 'EXTERNAL_SERVICE_ERROR');
  }
}

/** 503 - Una dependencia de infraestructura (base de datos) no está disponible. */
export class ServiceUnavailableError extends AppError {
  constructor(message: string) {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
