import { NextFunction, Request, Response } from 'express';

/** Middleware para rutas no encontradas (404). */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
}

/** Middleware de manejo de errores centralizado. */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor.' });
}
