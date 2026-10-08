import { logger } from '../utils/logger';

/**
 * Patrón Pipes & Filters.
 *
 * Un Filter hace UNA sola transformación: recibe un objeto, lo procesa y
 * devuelve el resultado para el siguiente filtro. Si algo está mal, lanza un
 * error y el pipeline se corta ahí (fail-fast).
 *
 * Los tipos de entrada y salida pueden ser distintos (ej. `unknown` -> DTO
 * validado), así cada etapa documenta en su firma qué garantiza.
 */
export interface Filter<TIn, TOut> {
  /** Nombre legible del filtro; se usa en los logs del pipeline. */
  readonly name: string;
  process(input: TIn): TOut | Promise<TOut>;
}

/**
 * Pipe (Pipeline Runner): ejecuta una secuencia ordenada de filtros.
 *
 * Se arma con un builder tipado (`Pipeline.create<T>(...).pipe(a).pipe(b)`),
 * de modo que el compilador rechaza conectar un filtro cuya entrada no coincide
 * con la salida del anterior. Es inmutable: `pipe` devuelve un pipeline nuevo.
 */
export class Pipeline<TIn, TOut> {
  private constructor(
    readonly name: string,
    private readonly filters: ReadonlyArray<Filter<unknown, unknown>>
  ) {}

  static create<T>(name: string): Pipeline<T, T> {
    return new Pipeline<T, T>(name, []);
  }

  pipe<TNext>(filter: Filter<TOut, TNext>): Pipeline<TIn, TNext> {
    return new Pipeline<TIn, TNext>(this.name, [
      ...this.filters,
      filter as Filter<unknown, unknown>,
    ]);
  }

  /** Nombres de los filtros en el orden en que se ejecutan. */
  get filterNames(): string[] {
    return this.filters.map((filter) => filter.name);
  }

  /**
   * Corre los filtros en orden. Si uno falla se loguea cuál fue y se relanza
   * el error ORIGINAL, para que el middleware de errores conserve el código
   * HTTP que corresponde (400, 422, 502...).
   */
  async run(input: TIn): Promise<TOut> {
    logger.info(`${this.name}: iniciando pipeline`, { filters: this.filterNames });

    let current: unknown = input;
    for (const [index, filter] of this.filters.entries()) {
      try {
        current = await filter.process(current);
      } catch (error) {
        logger.error(`${this.name}: falló el filtro ${filter.name}`, {
          step: index + 1,
          completed: this.filterNames.slice(0, index),
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
      logger.info(`${this.name}: ${filter.name} ejecutado con éxito`, {
        step: index + 1,
      });
    }

    logger.info(`${this.name}: pipeline completado`);
    return current as TOut;
  }
}
