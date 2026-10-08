import { ZodError } from 'zod';
import { ValidationError } from './app-error';

/**
 * Traduce un ZodError a nuestro ValidationError (400) con el detalle campo a
 * campo. Lo comparten el middleware `validate` y `ValidationFilter`, así la
 * respuesta de error es idéntica venga de donde venga la validación.
 */
export function fromZodError(error: ZodError): ValidationError {
  return new ValidationError(
    'Los datos enviados no son válidos.',
    error.issues.map((issue) => ({
      field: issue.path.join('.') || '(raíz)',
      message: issue.message,
      code: issue.code,
    }))
  );
}
