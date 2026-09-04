import { AuditAction } from '../src/models/audit.model';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
} from '../src/errors/app-error';
import { buildAsset, buildAssetService } from './helpers/fakes';

describe('AssetService', () => {
  const validInput = {
    symbol: 'BTC',
    name: 'Bitcoin',
    amount: 1.5,
    purchasePrice: 40000,
  };

  describe('create', () => {
    it('crea el activo con un UUID v4 y marcas de tiempo', () => {
      const { assetService } = buildAssetService();

      const created = assetService.create(validInput);

      expect(created).toMatchObject(validInput);
      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBe(created.createdAt);
    });

    it('persiste el activo en el repositorio', () => {
      const { assetService, assetRepository } = buildAssetService();

      const created = assetService.create(validInput);

      expect(assetRepository.findById(created.id)).toMatchObject(validInput);
      expect(assetService.getAll()).toHaveLength(1);
    });

    it('rechaza cantidades no positivas (regla de saldos negativos)', () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.create({ ...validInput, amount: -1 })).toThrow(
        BusinessRuleError
      );
      expect(() => assetService.create({ ...validInput, amount: 0 })).toThrow(
        BusinessRuleError
      );
    });

    it('rechaza precios de compra no positivos', () => {
      const { assetService } = buildAssetService();

      expect(() =>
        assetService.create({ ...validInput, purchasePrice: 0 })
      ).toThrow(BusinessRuleError);
    });

    it('no permite dos posiciones con el mismo símbolo', () => {
      const { assetService } = buildAssetService();
      assetService.create(validInput);

      expect(() => assetService.create(validInput)).toThrow(ConflictError);
      expect(assetService.getAll()).toHaveLength(1);
    });

    it('no deja rastro en el portafolio cuando la operación es inválida', () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.create({ ...validInput, amount: -5 })).toThrow();
      expect(assetService.getAll()).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('devuelve el activo existente', () => {
      const asset = buildAsset();
      const { assetService } = buildAssetService([asset]);

      expect(assetService.getById(asset.id).symbol).toBe('BTC');
    });

    it('lanza NotFoundError si no existe', () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.getById('inexistente')).toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('aplica cambios parciales y actualiza updatedAt', () => {
      const asset = buildAsset({ updatedAt: '2020-01-01T00:00:00.000Z' });
      const { assetService } = buildAssetService([asset]);

      const updated = assetService.update(asset.id, { amount: 7 });

      expect(updated.amount).toBe(7);
      expect(updated.name).toBe(asset.name); // los demás campos no cambian
      expect(updated.updatedAt).not.toBe(asset.updatedAt);
    });

    it('rechaza dejar el saldo en negativo', () => {
      const asset = buildAsset();
      const { assetService } = buildAssetService([asset]);

      expect(() => assetService.update(asset.id, { amount: -2 })).toThrow(
        BusinessRuleError
      );
      expect(assetService.getById(asset.id).amount).toBe(asset.amount);
    });

    it('rechaza cambiar el símbolo a uno ya presente en el portafolio', () => {
      const btc = buildAsset({ id: 'id-btc', symbol: 'BTC' });
      const eth = buildAsset({ id: 'id-eth', symbol: 'ETH', name: 'Ethereum' });
      const { assetService } = buildAssetService([btc, eth]);

      expect(() => assetService.update('id-eth', { symbol: 'BTC' })).toThrow(
        ConflictError
      );
    });

    it('lanza NotFoundError si el activo no existe', () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.update('inexistente', { amount: 1 })).toThrow(
        NotFoundError
      );
    });
  });

  describe('delete', () => {
    it('elimina el activo del portafolio', () => {
      const asset = buildAsset();
      const { assetService } = buildAssetService([asset]);

      assetService.delete(asset.id);

      expect(assetService.getAll()).toHaveLength(0);
      expect(() => assetService.getById(asset.id)).toThrow(NotFoundError);
    });

    it('lanza NotFoundError si el activo no existe', () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.delete('inexistente')).toThrow(NotFoundError);
    });
  });

  describe('auditoría', () => {
    it('registra un evento CREATE al crear', () => {
      const { assetService, auditRepository } = buildAssetService();

      const created = assetService.create(validInput);
      const history = auditRepository.findByAssetId(created.id);

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        assetId: created.id,
        action: AuditAction.CREATE,
      });
      expect(history[0].timestamp).toBeDefined();
    });

    it('registra un evento UPDATE con el antes y el después', () => {
      const { assetService, auditRepository } = buildAssetService();
      const created = assetService.create(validInput);

      assetService.update(created.id, { amount: 9 });
      const history = auditRepository.findByAssetId(created.id);

      expect(history.map((entry) => entry.action)).toEqual([
        AuditAction.CREATE,
        AuditAction.UPDATE,
      ]);
      expect(history[1].snapshot).toMatchObject({
        before: { amount: validInput.amount },
        after: { amount: 9 },
      });
    });

    it('registra un evento DELETE y conserva el historial del activo borrado', () => {
      const { assetService } = buildAssetService();
      const created = assetService.create(validInput);

      assetService.delete(created.id);

      // El activo ya no existe...
      expect(() => assetService.getById(created.id)).toThrow(NotFoundError);
      // ...pero su historial sigue siendo auditable.
      const history = assetService.getHistory(created.id);
      expect(history.map((entry) => entry.action)).toEqual([
        AuditAction.CREATE,
        AuditAction.DELETE,
      ]);
    });

    it('no registra nada cuando la operación falla', () => {
      const { assetService, auditRepository } = buildAssetService();

      expect(() => assetService.create({ ...validInput, amount: -1 })).toThrow();

      expect(auditRepository.findAll()).toHaveLength(0);
    });

    it('devuelve el historial en orden cronológico', () => {
      const { assetService } = buildAssetService();
      const created = assetService.create(validInput);
      assetService.update(created.id, { amount: 2 });
      assetService.update(created.id, { amount: 3 });

      const history = assetService.getHistory(created.id);
      const timestamps = history.map((entry) => entry.timestamp);

      expect(history).toHaveLength(3);
      expect([...timestamps].sort()).toEqual(timestamps);
    });

    it('lanza NotFoundError si no hay historial para ese id', () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.getHistory('inexistente')).toThrow(NotFoundError);
    });

    it('los registros de auditoría son inmutables', () => {
      const { assetService, auditRepository } = buildAssetService();
      const created = assetService.create(validInput);
      const [entry] = auditRepository.findByAssetId(created.id);

      expect(() => {
        (entry as { action: string }).action = 'HACKEADO';
      }).toThrow();
    });
  });

  describe('encapsulamiento del repositorio', () => {
    it('mutar el objeto devuelto no altera el estado almacenado', () => {
      const { assetService } = buildAssetService();
      const created = assetService.create(validInput);

      created.amount = 999;

      expect(assetService.getById(created.id).amount).toBe(validInput.amount);
    });
  });
});
