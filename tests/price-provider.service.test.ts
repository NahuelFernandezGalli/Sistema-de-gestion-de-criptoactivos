import {
  CoinGeckoPriceProvider,
} from '../src/services/price-provider.service';
import { ExternalServiceError, NotFoundError } from '../src/errors/app-error';

/**
 * Acá se mockea directamente el `fetch` global: los tests verifican el contrato
 * con la API externa (URL, parseo, manejo de errores) sin tocar la red.
 */
describe('CoinGeckoPriceProvider', () => {
  const baseUrl = 'https://api.example.test/api/v3';
  let provider: CoinGeckoPriceProvider;

  beforeEach(() => {
    provider = new CoinGeckoPriceProvider(baseUrl, 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockFetchResolved(body: unknown, ok = true, status = 200): jest.Mock {
    const fetchMock = jest.fn().mockResolvedValue({
      ok,
      status,
      json: async () => body,
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('devuelve el precio en USD del símbolo', async () => {
    mockFetchResolved({ bitcoin: { usd: 64250.5 } });

    await expect(provider.getPriceUsd('BTC')).resolves.toBe(64250.5);
  });

  it('traduce el símbolo al id de CoinGecko en la URL', async () => {
    const fetchMock = mockFetchResolved({ ethereum: { usd: 3000 } });

    await provider.getPriceUsd('eth');

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseUrl}/simple/price?ids=ethereum&vs_currencies=usd`,
      expect.objectContaining({ signal: expect.anything() })
    );
  });

  it('lanza NotFoundError para un símbolo no mapeado, sin llamar a la API', async () => {
    const fetchMock = mockFetchResolved({});

    await expect(provider.getPriceUsd('NOEXISTE')).rejects.toThrow(NotFoundError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lanza ExternalServiceError si la API responde con error HTTP', async () => {
    mockFetchResolved({}, false, 429);

    await expect(provider.getPriceUsd('BTC')).rejects.toThrow(ExternalServiceError);
  });

  it('lanza ExternalServiceError si la red falla', async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    await expect(provider.getPriceUsd('BTC')).rejects.toThrow(ExternalServiceError);
  });

  it('lanza ExternalServiceError si la respuesta no trae un precio válido', async () => {
    mockFetchResolved({ bitcoin: {} });

    await expect(provider.getPriceUsd('BTC')).rejects.toThrow(ExternalServiceError);
  });
});
