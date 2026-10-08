import { Filter, Pipeline } from '../src/pipeline/pipeline';
import { logger } from '../src/utils/logger';

/** Filtro de prueba que registra en qué orden se lo invocó. */
function recordingFilter<T>(
  name: string,
  calls: string[],
  transform: (input: T) => T = (input) => input
): Filter<T, T> {
  return {
    name,
    process: (input: T) => {
      calls.push(name);
      return transform(input);
    },
  };
}

describe('Pipeline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ejecuta los filtros en el orden en que se agregaron', async () => {
    const calls: string[] = [];
    const pipeline = Pipeline.create<number>('Test')
      .pipe(recordingFilter('A', calls))
      .pipe(recordingFilter('B', calls))
      .pipe(recordingFilter('C', calls));

    await pipeline.run(1);

    expect(calls).toEqual(['A', 'B', 'C']);
    expect(pipeline.filterNames).toEqual(['A', 'B', 'C']);
  });

  it('pasa la salida de cada filtro como entrada del siguiente', async () => {
    const pipeline = Pipeline.create<number>('Test')
      .pipe({ name: 'Sumar1', process: (n: number) => n + 1 })
      .pipe({ name: 'Duplicar', process: (n: number) => n * 2 })
      .pipe({ name: 'ATexto', process: (n: number) => `resultado=${n}` });

    // (3 + 1) * 2 = 8; el orden importa: (3 * 2) + 1 daría 7.
    await expect(pipeline.run(3)).resolves.toBe('resultado=8');
  });

  it('soporta filtros asíncronos', async () => {
    const pipeline = Pipeline.create<number>('Test').pipe({
      name: 'Async',
      process: async (n: number) => n * 10,
    });

    await expect(pipeline.run(4)).resolves.toBe(40);
  });

  it('un pipeline sin filtros devuelve la entrada intacta', async () => {
    await expect(Pipeline.create<string>('Vacío').run('hola')).resolves.toBe('hola');
  });

  it('fail-fast: si un filtro falla, los siguientes no se ejecutan', async () => {
    const calls: string[] = [];
    const boom = new Error('boom');
    const pipeline = Pipeline.create<number>('Test')
      .pipe(recordingFilter('A', calls))
      .pipe(
        recordingFilter('B', calls, () => {
          throw boom;
        })
      )
      .pipe(recordingFilter('C', calls));

    await expect(pipeline.run(1)).rejects.toBe(boom);
    expect(calls).toEqual(['A', 'B']);
  });

  it('relanza el error original (conserva tipo y código HTTP)', async () => {
    class CustomError extends Error {}
    const pipeline = Pipeline.create<number>('Test').pipe({
      name: 'Falla',
      process: () => {
        throw new CustomError('x');
      },
    });

    await expect(pipeline.run(1)).rejects.toBeInstanceOf(CustomError);
  });

  it('pipe() es inmutable: no modifica el pipeline original', () => {
    const base = Pipeline.create<number>('Test').pipe({ name: 'A', process: (n: number) => n });
    const extended = base.pipe({ name: 'B', process: (n: number) => n });

    expect(base.filterNames).toEqual(['A']);
    expect(extended.filterNames).toEqual(['A', 'B']);
  });

  describe('observabilidad', () => {
    it('loguea cada filtro ejecutado con éxito', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      const pipeline = Pipeline.create<number>('Ingesta')
        .pipe({ name: 'A', process: (n: number) => n })
        .pipe({ name: 'B', process: (n: number) => n });

      await pipeline.run(1);

      const messages = infoSpy.mock.calls.map(([message]) => message);
      expect(messages).toContain('Ingesta: A ejecutado con éxito');
      expect(messages).toContain('Ingesta: B ejecutado con éxito');
      expect(messages).toContain('Ingesta: pipeline completado');
    });

    it('loguea qué filtro falló y cuáles se habían completado', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      const pipeline = Pipeline.create<number>('Ingesta')
        .pipe({ name: 'A', process: (n: number) => n })
        .pipe({
          name: 'B',
          process: () => {
            throw new Error('dato inválido');
          },
        });

      await expect(pipeline.run(1)).rejects.toThrow('dato inválido');

      expect(errorSpy).toHaveBeenCalledWith(
        'Ingesta: falló el filtro B',
        expect.objectContaining({ step: 2, completed: ['A'], error: 'dato inválido' })
      );
    });
  });
});
