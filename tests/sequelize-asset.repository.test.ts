import { Sequelize } from 'sequelize';
import { defineAssetModel } from '../src/database/mysql/asset.sequelize-model';
import { createMigrator } from '../src/database/mysql/migrator';
import { ConflictError } from '../src/errors/app-error';
import { SequelizeAssetRepository } from '../src/repositories/sequelize-asset.repository';
import { buildAsset } from './helpers/fakes';

/**
 * Tests de integración del repositorio de Sequelize.
 *
 * Corren contra SQLite en memoria: es otro motor, pero Sequelize abstrae las
 * diferencias, y así se prueban de verdad la migración, el mapeo fila <->
 * entidad, el índice único y las transacciones sin necesitar un MySQL.
 */
describe('SequelizeAssetRepository (SQLite en memoria)', () => {
  let sequelize: Sequelize;
  let repository: SequelizeAssetRepository;

  beforeEach(async () => {
    sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    await createMigrator(sequelize).up();
    repository = new SequelizeAssetRepository(sequelize, defineAssetModel(sequelize));
  });

  afterEach(async () => {
    await sequelize.close();
  });

  it('la migración crea la tabla assets', async () => {
    const tables = await sequelize.getQueryInterface().showAllTables();

    expect(tables).toContain('assets');
  });

  it('la migración se puede revertir', async () => {
    await createMigrator(sequelize).down();

    const tables = await sequelize.getQueryInterface().showAllTables();
    expect(tables).not.toContain('assets');
  });

  it('crea y lee un activo devolviendo la entidad de dominio', async () => {
    const asset = buildAsset({ amount: 0.12345678, purchasePrice: 42000.5 });

    await repository.create(asset);
    const found = await repository.findById(asset.id);

    // Montos como number y fechas como ISO string, igual que el modelo de dominio.
    expect(found).toEqual(asset);
  });

  it('devuelve undefined si el activo no existe', async () => {
    await expect(repository.findById('11111111-1111-4111-8111-999999999999')).resolves
      .toBeUndefined();
  });

  it('busca por símbolo', async () => {
    await repository.create(buildAsset({ symbol: 'ETH' }));

    await expect(repository.findBySymbol('eth')).resolves.toMatchObject({ symbol: 'ETH' });
    await expect(repository.findBySymbol('BTC')).resolves.toBeUndefined();
  });

  it('lista en orden de creación', async () => {
    await repository.create(
      buildAsset({ id: 'b0000000-0000-4000-8000-000000000000', symbol: 'B', createdAt: '2026-01-02T00:00:00.000Z' })
    );
    await repository.create(
      buildAsset({ id: 'a0000000-0000-4000-8000-000000000000', symbol: 'A', createdAt: '2026-01-01T00:00:00.000Z' })
    );

    const symbols = (await repository.findAll()).map((asset) => asset.symbol);
    expect(symbols).toEqual(['A', 'B']);
  });

  it('actualiza parcialmente sin tocar el id', async () => {
    const asset = buildAsset();
    await repository.create(asset);

    const updated = await repository.update(asset.id, {
      id: 'otro-id',
      amount: 7,
      updatedAt: '2030-01-01T00:00:00.000Z',
    });

    expect(updated).toMatchObject({ id: asset.id, amount: 7, name: asset.name });
    expect(updated?.updatedAt).toBe('2030-01-01T00:00:00.000Z');
    await expect(repository.findById(asset.id)).resolves.toMatchObject({ amount: 7 });
  });

  it('update devuelve undefined si el activo no existe', async () => {
    await expect(repository.update(buildAsset().id, { amount: 1 })).resolves.toBeUndefined();
  });

  it('elimina un activo', async () => {
    const asset = buildAsset();
    await repository.create(asset);

    await expect(repository.delete(asset.id)).resolves.toBe(true);
    await expect(repository.delete(asset.id)).resolves.toBe(false);
    await expect(repository.findAll()).resolves.toHaveLength(0);
  });

  it('el índice único de símbolo se traduce a ConflictError (409)', async () => {
    await repository.create(buildAsset({ id: 'a0000000-0000-4000-8000-000000000000' }));

    await expect(
      repository.create(buildAsset({ id: 'b0000000-0000-4000-8000-000000000000' }))
    ).rejects.toThrow(ConflictError);
  });

  describe('transacciones', () => {
    it('hace commit si el trabajo termina bien', async () => {
      await repository.transaction(async (assets) => {
        await assets.create(buildAsset());
      });

      await expect(repository.findAll()).resolves.toHaveLength(1);
    });

    it('hace rollback si el trabajo falla', async () => {
      const asset = buildAsset({ amount: 1 });
      await repository.create(asset);

      await expect(
        repository.transaction(async (assets) => {
          await assets.update(asset.id, { amount: 99 });
          await assets.create(buildAsset({ id: 'b0000000-0000-4000-8000-000000000000', symbol: 'ETH' }));
          throw new Error('falla la auditoría');
        })
      ).rejects.toThrow('falla la auditoría');

      const all = await repository.findAll();
      expect(all).toHaveLength(1);
      expect(all[0].amount).toBe(1);
    });
  });
});
