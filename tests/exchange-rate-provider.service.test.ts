import { CoinGeckoExchangeRateProvider } from '../src/services/exchange-rate-provider.service';
import { ExternalServiceError } from '../src/errors/app-error';
import { TtlCache } from '../src/utils/cache';

/**
 * Igual que con el proveedor de precios, se mockea el `fetch` global para
 * verificar el contrato con CoinGecko sin salir a la red.
 */
describe('CoinGeckoExchangeRateProvider', () => {
  const baseUrl = 'https://api.example.test/api/v3';

  // Formato real de /exchange_rates: cuántas unidades de cada moneda vale 1 BTC.
  const ratesBody = {
    rates: {
      btc: { value: 1 },
      usd: { value: 80000 },
      eur: { value: 64000 },
    },
  };

  function mockFetchResolved(body: unknown, ok = true, status = 200): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue({ ok, status, json: async () => body });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  function buildProvider(cacheTtlMs = 0) {
    return new CoinGeckoExchangeRateProvider(baseUrl, 1000, new TtlCache(cacheTtlMs));
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calcula la tasa a USD cruzando las cotizaciones contra BTC', async () => {
    mockFetchResolved(ratesBody);

    // 1 EUR = 80000 / 64000 = 1.25 USD
    await expect(buildProvider().getUsdRate('EUR')).resolves.toBe(1.25);
  });

  it('consulta el endpoint /exchange_rates', async () => {
    const fetchMock = mockFetchResolved(ratesBody);

    await buildProvider().getUsdRate('eur');

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/exchange_rates`,
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('USD vale 1 y no sale a la red', async () => {
    const fetchMock = mockFetchResolved(ratesBody);

    await expect(buildProvider().getUsdRate('USD')).resolves.toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cachea la tabla de tasas: dos consultas, una sola llamada', async () => {
    const fetchMock = mockFetchResolved(ratesBody);
    const provider = buildProvider(60_000);

    await provider.getUsdRate('EUR');
    await provider.getUsdRate('EUR');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('lanza ExternalServiceError si la moneda no viene en la respuesta', async () => {
    mockFetchResolved(ratesBody);

    await expect(buildProvider().getUsdRate('GBP')).rejects.toThrow(ExternalServiceError);
  });

  it('lanza ExternalServiceError si la API responde con error HTTP', async () => {
    mockFetchResolved({}, false, 503);

    await expect(buildProvider().getUsdRate('EUR')).rejects.toThrow(ExternalServiceError);
  });

  it('lanza ExternalServiceError si la red falla', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(buildProvider().getUsdRate('EUR')).rejects.toThrow(ExternalServiceError);
  });
});
