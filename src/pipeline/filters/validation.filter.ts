import { ZodType } from 'zod';
import { fromZodError } from '../../errors/zod-error';
import { logger } from '../../utils/logger';
import { Filter } from '../pipeline';

/**
 * Verifica la estructura del payload con un esquema Zod.
 *
 * Es genérico (recibe el esquema por constructor), así que lo reusan el
 * pipeline de ingesta y el de análisis. Si el payload no cumple, lanza un
 * ValidationError (400) con el detalle por campo y el pipeline se corta.
 */
export class ValidationFilter<T> implements Filter<unknown, T> {
  readonly name = 'ValidationFilter';

  constructor(private readonly schema: ZodType<T>) {}

  process(input: unknown): T {
    const result = this.schema.safeParse(input);

    if (!result.success) {
      logger.warn(`${this.name}: payload rechazado.`, {
        issues: result.error.issues.length,
      });
      throw fromZodError(result.error);
    }

    logger.info(`${this.name}: payload válido.`);
    return result.data;
  }
}
