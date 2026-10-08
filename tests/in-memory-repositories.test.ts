import { InMemoryAssetRepository } from '../src/repositories/asset.repository';
import { buildAsset } from './helpers/fakes';

describe('InMemoryAssetRepository.transaction', () => {
  it('confirma los cambios si el trabajo termina bien', async () => {
    const repository = new InMemoryAssetRepository();

    await repository.transaction(async (assets) => {
      await assets.create(buildAsset());
    });

    expect(await repository.findAll()).toHaveLength(1);
  });

  it('deshace todos los cambios si el trabajo falla', async () => {
    const existing = buildAsset({ id: 'a', symbol: 'BTC', amount: 1 });
    const repository = new InMemoryAssetRepository([existing]);

    await expect(
      repository.transaction(async (assets) => {
        await assets.update('a', { amount: 99 });
        await assets.create(buildAsset({ id: 'b', symbol: 'ETH' }));
        throw new Error('falla a mitad de camino');
      })
    ).rejects.toThrow('falla a mitad de camino');

    expect(await repository.findAll()).toEqual([existing]);
  });

  it('devuelve el resultado del trabajo', async () => {
    const repository = new InMemoryAssetRepository();

    await expect(repository.transaction(async () => 42)).resolves.toBe(42);
  });
});
