import mongoose, { Connection } from 'mongoose';
import {
  AuditLogModel,
  defineAuditLogModel,
  ImmutableAuditLogError,
} from '../src/database/mongo/audit-log.mongoose-model';
import { ServiceUnavailableError } from '../src/errors/app-error';
import { AuditAction } from '../src/models/audit.model';
import { MongoAuditRepository, toAuditLog } from '../src/repositories/mongo-audit.repository';

/**
 * Estos tests no levantan un MongoDB: verifican el mapeo documento <->
 * entidad y las reglas del modelo, que corren antes de llegar a la base. La
 * escritura y lectura real se verifican con docker-compose (ver la doc).
 */
describe('Auditoría en MongoDB', () => {
  describe('modelo AuditLog (inmutabilidad)', () => {
    let connection: Connection;
    let model: AuditLogModel;

    beforeAll(() => {
      // Conexión sin abrir: las operaciones nunca llegan a la red.
      connection = mongoose.createConnection();
      model = defineAuditLogModel(connection);
    });

    afterAll(async () => {
      await connection.close();
    });

    it.each([
      ['updateOne', () => model.updateOne({ _id: 'x' }, { action: 'DELETE' })],
      ['updateMany', () => model.updateMany({}, { action: 'DELETE' })],
      ['findOneAndUpdate', () => model.findOneAndUpdate({ _id: 'x' }, { action: 'DELETE' })],
      ['replaceOne', () => model.replaceOne({ _id: 'x' }, {})],
      ['deleteOne', () => model.deleteOne({ _id: 'x' })],
      ['deleteMany', () => model.deleteMany({})],
      ['findOneAndDelete', () => model.findOneAndDelete({ _id: 'x' })],
    ])('rechaza %s', async (_name, operation) => {
      await expect(operation()).rejects.toThrow(ImmutableAuditLogError);
    });

    it('valida la acción contra los valores permitidos', () => {
      const document = new model({
        _id: 'id',
        assetId: 'asset',
        action: 'HACKEADO',
        timestamp: new Date(),
      });

      expect(document.validateSync()?.errors.action).toBeDefined();
    });
  });

  describe('toAuditLog', () => {
    it('convierte el documento a la entidad de dominio', () => {
      const log = toAuditLog({
        _id: 'audit-1',
        assetId: 'asset-1',
        action: AuditAction.CREATE,
        timestamp: new Date('2026-10-08T12:00:00.000Z'),
        snapshot: { symbol: 'BTC' },
      });

      expect(log).toEqual({
        id: 'audit-1',
        assetId: 'asset-1',
        action: 'CREATE',
        timestamp: '2026-10-08T12:00:00.000Z',
        snapshot: { symbol: 'BTC' },
      });
    });
  });

  describe('MongoAuditRepository', () => {
    function fakeModel(documents: unknown[] = []) {
      const query = {
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(documents),
      };
      return {
        create: jest.fn().mockResolvedValue(undefined),
        find: jest.fn().mockReturnValue(query),
        query,
      };
    }

    it('append guarda el UUID como _id y la fecha como Date', async () => {
      const model = fakeModel();
      const repository = new MongoAuditRepository(model as unknown as AuditLogModel);

      const entry = {
        id: 'audit-1',
        assetId: 'asset-1',
        action: AuditAction.UPDATE,
        timestamp: '2026-10-08T12:00:00.000Z',
        snapshot: { before: {}, after: {} },
      };
      const result = await repository.append(entry);

      expect(model.create).toHaveBeenCalledWith({
        _id: 'audit-1',
        assetId: 'asset-1',
        action: 'UPDATE',
        timestamp: new Date('2026-10-08T12:00:00.000Z'),
        snapshot: { before: {}, after: {} },
      });
      expect(result).toEqual(entry);
      expect(Object.isFrozen(result)).toBe(true);
    });

    it('si MongoDB no está accesible responde 503 (ServiceUnavailableError)', async () => {
      const model = fakeModel();
      const unreachable = Object.assign(new Error('getaddrinfo ENOTFOUND mongo'), {
        name: 'MongoServerSelectionError',
      });
      model.create.mockRejectedValue(unreachable);
      const repository = new MongoAuditRepository(model as unknown as AuditLogModel);

      await expect(
        repository.append({ id: 'a', assetId: 'b', action: AuditAction.CREATE, timestamp: new Date().toISOString() })
      ).rejects.toThrow(ServiceUnavailableError);
    });

    it('otros errores se propagan sin traducir', async () => {
      const model = fakeModel();
      model.create.mockRejectedValue(new Error('validación'));
      const repository = new MongoAuditRepository(model as unknown as AuditLogModel);

      await expect(
        repository.append({ id: 'a', assetId: 'b', action: AuditAction.CREATE, timestamp: new Date().toISOString() })
      ).rejects.toThrow('validación');
    });

    it('findByAssetId filtra por activo y ordena cronológicamente', async () => {
      const model = fakeModel([
        { _id: 'a', assetId: 'asset-1', action: 'CREATE', timestamp: new Date(0) },
      ]);
      const repository = new MongoAuditRepository(model as unknown as AuditLogModel);

      const history = await repository.findByAssetId('asset-1');

      expect(model.find).toHaveBeenCalledWith({ assetId: 'asset-1' });
      expect(model.query.sort).toHaveBeenCalledWith({ timestamp: 1, _id: 1 });
      expect(history).toEqual([
        { id: 'a', assetId: 'asset-1', action: 'CREATE', timestamp: '1970-01-01T00:00:00.000Z' },
      ]);
    });
  });
});
