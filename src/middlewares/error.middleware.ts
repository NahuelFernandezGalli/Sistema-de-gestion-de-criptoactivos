import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { logger } from '../utils/logger';

/** Ruta inexistente: se delega al manejador de errores como un AppError 404. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    },
  });
}

/**
 * Manejador centralizado de errores.
 *
 * Es el único lugar de la app que traduce errores de dominio a códigos HTTP.
 * Los errores esperados (AppError) se responden con su código y mensaje; los
 * inesperados se loguean completos pero al cliente se le devuelve un mensaje
 * genérico, para no filtrar detalles internos.
 *
 * Nota: Express 5 propaga automáticamente los rechazos de promesas de los
 * handlers async hasta acá, así que no hace falta envolverlos en try/catch.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    logger.warn('Error controlado', {
      code: err.code,
      statusCode: err.statusCode,
      message: err.message,
      path: req.originalUrl,
    });

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  logger.error('Error no controlado', {
    message: err.message,
    stack: err.stack,
    path: req.originalUrl,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error interno del servidor.',
    },
  });
}
