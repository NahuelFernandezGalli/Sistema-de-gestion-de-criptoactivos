import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { fromZodError } from '../errors/zod-error';

interface ValidationTargets {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

/**
 * Middleware de validación con Zod.
 *
 * Los datos ya validados (y transformados: símbolo en mayúsculas, strings sin
 * espacios sobrantes) quedan en `res.locals`, no en `req.body`. Motivo: en
 * Express 5 `req.params` y `req.query` son getters y reasignarlos es frágil;
 * además así el controller sabe con certeza que lo que lee pasó por Zod.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (targets.params) {
        res.locals.params = targets.params.parse(req.params);
      }
      if (targets.query) {
        res.locals.query = targets.query.parse(req.query);
      }
      if (targets.body) {
        res.locals.body = targets.body.parse(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(fromZodError(error));
        return;
      }
      next(error);
    }
  };
}

/** Acceso tipado a los datos validados del body. */
export function validatedBody<T>(res: Response): T {
  return res.locals.body as T;
}

/** Acceso tipado a los parámetros validados de la ruta. */
export function validatedParams<T>(res: Response): T {
  return res.locals.params as T;
}
