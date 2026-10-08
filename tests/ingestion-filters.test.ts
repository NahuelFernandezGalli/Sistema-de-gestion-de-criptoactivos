import { ExternalServiceError, ValidationError } from '../src/errors/app-error';
import { CurrencyConversionFilter } from '../src/pipeline/filters/ingestion/currency-conversion.filter';
import {
  NormalizationFilter,
  NormalizedAssetInput,
} from '../src/pipeline/filters/ingestion/normalization.filter';
import { ValidationFilter } from '../src/pipeline/filters/validation.filter';
import { buildIngestionPipeline } from '../src/pipeline/ingestion.pipeline';
import { createAssetSchema } from '../src/schemas/asset.schema';
import { logger } from '../src/utils/logger';
import { FakeExchangeRateProvider } from './helpers/fakes';

function captureError(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la función lanzara un error');
}

describe('Filtros de ingesta', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ValidationFilter', () => {
    const filter = new ValidationFilter(createAssetSchema);
    const valid = { symbol: 'BTC', name: 'Bitcoin', amount: 1, purchasePrice: 40000 };

    it('devuelve el payload validado (con defaults aplicados)', () => {
      expect(filter.process(valid)).toEqual({ ...valid, currency: 'USD' });
    });

    it('lanza ValidationError con el detalle por campo', () => {
      const error = captureError(() => filter.process({ ...valid, amount: -1 }));

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).details).toEqual([
        expect.objectContaining({ field: 'amount' }),
      ]);
    });

    it('rechaza un body que no es un objeto', () => {
      expect(() => filter.process('no soy un activo')).toThrow(ValidationError);
    });
  });

  describe('NormalizationFilter', () => {
    const filter = new NormalizationFilter();
    const input = {
      symbol: '  btc ',
      name: '  Bitcoin    Core  ',
      amount: 1,
      purchasePrice: 40000,
      currency: ' eur ',
    };

    it('pasa el símbolo a mayúsculas y le quita los espacios', () => {
      expect(filter.process(input).symbol).toBe('BTC');
    });

    it('elimina los espacios extra del nombre', () => {
      expect(filter.process(input).name).toBe('Bitcoin Core');
    });

    it('normaliza el código de moneda', () => {
      expect(filter.process(input).currency).toBe('EUR');
    });

    it('no modifica los valores numéricos ni el objeto de entrada', () => {
      const result = filter.process(input);

      expect(result).toMatchObject({ amount: 1, purchasePrice: 40000 });
      expect(input.symbol).toBe('  btc ');
    });

    it('loguea su actividad con el formato pedido', () => {
      const infoSpy = jest.spyOn(logger, 'info');

      filter.process(input);

      expect(infoSpy).toHaveBeenCalledWith(
        'NormalizationFilter: Symbol BTC normalized.',
        expect.anything()
      );
    });
  });

  describe('CurrencyConversionFilter', () => {
    const input: NormalizedAssetInput = {
      symbol: 'BTC',
      name: 'Bitcoin',
      amount: 1,
      purchasePrice: 1000,
      currency: 'USD',
    };

    it('no convierte ni consulta tasas si ya está en USD', async () => {
      const rates = new FakeExchangeRateProvider();
      const filter = new CurrencyConversionFilter(rates);

      const result = await filter.process(input);

      expect(result.purchasePrice).toBe(1000);
      expect(rates.getUsdRate).not.toHaveBeenCalled();
    });

    it('convierte el precio de compra a USD con la tasa del proveedor', async () => {
      const rates = new FakeExchangeRateProvider({ EUR: 1.1 });
      const filter = new CurrencyConversionFilter(rates);

      const result = await filter.process({ ...input, currency: 'EUR' });

      expect(rates.getUsdRate).toHaveBeenCalledWith('EUR');
      expect(result.purchasePrice).toBe(1100);
    });

    it('elimina la basura de punto flotante de la conversión', async () => {
      const filter = new CurrencyConversionFilter(
        new FakeExchangeRateProvider({ ARS: 0.001 })
      );

      // 0.3 * 0.001 da 0.00030000000000000003 sin redondeo
      const result = await filter.process({ ...input, purchasePrice: 0.3, currency: 'ARS' });

      expect(result.purchasePrice).toBe(0.0003);
    });

    it('quita el campo currency del resultado (ya todo es USD)', async () => {
      const filter = new CurrencyConversionFilter(new FakeExchangeRateProvider());

      const result = await filter.process({ ...input, currency: 'EUR' });

      expect(result).not.toHaveProperty('currency');
    });

    it('propaga el error si no se puede obtener la tasa', async () => {
      const rates = new FakeExchangeRateProvider();
      rates.getUsdRate.mockRejectedValueOnce(new ExternalServiceError('caído'));
      const filter = new CurrencyConversionFilter(rates);

      await expect(filter.process({ ...input, currency: 'EUR' })).rejects.toThrow(
        ExternalServiceError
      );
    });
  });

  describe('Pipeline de ingesta completo', () => {
    it('ejecuta Validación -> Normalización -> Conversión, en ese orden', () => {
      const pipeline = buildIngestionPipeline(new FakeExchangeRateProvider());

      expect(pipeline.filterNames).toEqual([
        'ValidationFilter',
        'NormalizationFilter',
        'CurrencyConversionFilter',
      ]);
    });

    it('transforma un payload crudo en un DTO normalizado en USD', async () => {
      const pipeline = buildIngestionPipeline(new FakeExchangeRateProvider({ EUR: 1.1 }));

      const result = await pipeline.run({
        symbol: ' eth ',
        name: ' Ethereum ',
        amount: 2,
        purchasePrice: 2000,
        currency: 'eur',
      });

      expect(result).toEqual({
        symbol: 'ETH',
        name: 'Ethereum',
        amount: 2,
        purchasePrice: 2200,
      });
    });

    it('fail-fast: un payload inválido no llega a consultar la tasa', async () => {
      const rates = new FakeExchangeRateProvider();
      const pipeline = buildIngestionPipeline(rates);

      await expect(
        pipeline.run({ symbol: 'BTC', name: 'Bitcoin', amount: -1, purchasePrice: 1, currency: 'EUR' })
      ).rejects.toThrow(ValidationError);
      expect(rates.getUsdRate).not.toHaveBeenCalled();
    });
  });
});
