import { AuditAction } from '../src/models/audit.model';
import {
  BusinessRuleError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../src/errors/app-error';
import { buildAsset, buildAssetService, FakeExchangeRateProvider } from './helpers/fakes';

describe('AssetService', () => {
  const validInput = {
    symbol: 'BTC',
    name: 'Bitcoin',
    amount: 1.5,
    purchasePrice: 40000,
  };

  describe('create', () => {
    it('crea el activo con un UUID v4 y marcas de tiempo', async () => {
      const { assetService } = buildAssetService();

      const created = await assetService.create(validInput);

      expect(created).toMatchObject(validInput);
      expect(created.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBe(created.createdAt);
    });

    it('persiste el activo en el repositorio', async () => {
      const { assetService, assetRepository } = buildAssetService();

      const created = await assetService.create(validInput);

      expect(assetRepository.findById(created.id)).toMatchObject(validInput);
      expect(assetService.getAll()).toHaveLength(1);
    });

    it('rechaza cantidades no positivas (regla de saldos negativos)', async () => {
      const { assetService } = buildAssetService();

      await expect(assetService.create({ ...validInput, amount: -1 })).rejects.toThrow(
        ValidationError
      );
      await expect(assetService.create({ ...validInput, amount: 0 })).rejects.toThrow(
        ValidationError
      );
    });

    it('rechaza precios de compra no positivos', async () => {
      const { assetService } = buildAssetService();

      await expect(
        assetService.create({ ...validInput, purchasePrice: 0 })
      ).rejects.toThrow(ValidationError);
    });

    it('no permite dos posiciones con el mismo símbolo', async () => {
      const { assetService } = buildAssetService();
      await assetService.create(validInput);

      await expect(assetService.create(validInput)).rejects.toThrow(ConflictError);
      expect(assetService.getAll()).toHaveLength(1);
    });

    it('no deja rastro en el portafolio cuando la operación es inválida', async () => {
      const { assetService } = buildAssetService();

      await expect(assetService.create({ ...validInput, amount: -5 })).rejects.toThrow();
      expect(assetService.getAll()).toHaveLength(0);
    });
  });

  describe('create - pipeline de ingesta', () => {
    it('normaliza el símbolo y el nombre antes de guardar', async () => {
      const { assetService } = buildAssetService();

      const created = await assetService.create({
        ...validInput,
        symbol: '  btc ',
        name: '  Bitcoin   Core ',
      });

      expect(created.symbol).toBe('BTC');
      expect(created.name).toBe('Bitcoin Core');
    });

    it('detecta duplicados aunque el símbolo venga con otro formato', async () => {
      const { assetService } = buildAssetService();
      await assetService.create(validInput);

      await expect(
        assetService.create({ ...validInput, symbol: ' btc' })
      ).rejects.toThrow(ConflictError);
    });

    it('guarda el precio de compra convertido a USD', async () => {
      const { assetService } = buildAssetService([], new FakeExchangeRateProvider({ EUR: 1.1 }));

      const created = await assetService.create({
        ...validInput,
        purchasePrice: 1000,
        currency: 'EUR',
      });

      expect(created.purchasePrice).toBe(1100);
      expect(created).not.toHaveProperty('currency');
    });

    it('rechaza payloads con estructura inválida sin llegar al repositorio', async () => {
      const { assetService, auditRepository } = buildAssetService();

      await expect(assetService.create({ symbol: 'BTC' })).rejects.toThrow(ValidationError);
      expect(assetService.getAll()).toHaveLength(0);
      expect(auditRepository.findAll()).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('devuelve el activo existente', async () => {
      const asset = buildAsset();
      const { assetService } = buildAssetService([asset]);

      expect(assetService.getById(asset.id).symbol).toBe('BTC');
    });

    it('lanza NotFoundError si no existe', async () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.getById('inexistente')).toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('aplica cambios parciales y actualiza updatedAt', async () => {
      const asset = buildAsset({ updatedAt: '2020-01-01T00:00:00.000Z' });
      const { assetService } = buildAssetService([asset]);

      const updated = assetService.update(asset.id, { amount: 7 });

      expect(updated.amount).toBe(7);
      expect(updated.name).toBe(asset.name); // los demás campos no cambian
      expect(updated.updatedAt).not.toBe(asset.updatedAt);
    });

    it('rechaza dejar el saldo en negativo', async () => {
      const asset = buildAsset();
      const { assetService } = buildAssetService([asset]);

      expect(() => assetService.update(asset.id, { amount: -2 })).toThrow(
        BusinessRuleError
      );
      expect(assetService.getById(asset.id).amount).toBe(asset.amount);
    });

    it('rechaza cambiar el símbolo a uno ya presente en el portafolio', async () => {
      const btc = buildAsset({ id: 'id-btc', symbol: 'BTC' });
      const eth = buildAsset({ id: 'id-eth', symbol: 'ETH', name: 'Ethereum' });
      const { assetService } = buildAssetService([btc, eth]);

      expect(() => assetService.update('id-eth', { symbol: 'BTC' })).toThrow(
        ConflictError
      );
    });

    it('lanza NotFoundError si el activo no existe', async () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.update('inexistente', { amount: 1 })).toThrow(
        NotFoundError
      );
    });
  });

  describe('delete', () => {
    it('elimina el activo del portafolio', async () => {
      const asset = buildAsset();
      const { assetService } = buildAssetService([asset]);

      assetService.delete(asset.id);

      expect(assetService.getAll()).toHaveLength(0);
      expect(() => assetService.getById(asset.id)).toThrow(NotFoundError);
    });

    it('lanza NotFoundError si el activo no existe', async () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.delete('inexistente')).toThrow(NotFoundError);
    });
  });

  describe('auditoría', () => {
    it('registra un evento CREATE al crear', async () => {
      const { assetService, auditRepository } = buildAssetService();

      const created = await assetService.create(validInput);
      const history = auditRepository.findByAssetId(created.id);

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        assetId: created.id,
        action: AuditAction.CREATE,
      });
      expect(history[0].timestamp).toBeDefined();
    });

    it('registra un evento UPDATE con el antes y el después', async () => {
      const { assetService, auditRepository } = buildAssetService();
      const created = await assetService.create(validInput);

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

    it('registra un evento DELETE y conserva el historial del activo borrado', async () => {
      const { assetService } = buildAssetService();
      const created = await assetService.create(validInput);

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

    it('no registra nada cuando la operación falla', async () => {
      const { assetService, auditRepository } = buildAssetService();

      await expect(assetService.create({ ...validInput, amount: -1 })).rejects.toThrow();

      expect(auditRepository.findAll()).toHaveLength(0);
    });

    it('devuelve el historial en orden cronológico', async () => {
      const { assetService } = buildAssetService();
      const created = await assetService.create(validInput);
      assetService.update(created.id, { amount: 2 });
      assetService.update(created.id, { amount: 3 });

      const history = assetService.getHistory(created.id);
      const timestamps = history.map((entry) => entry.timestamp);

      expect(history).toHaveLength(3);
      expect([...timestamps].sort()).toEqual(timestamps);
    });

    it('lanza NotFoundError si no hay historial para ese id', async () => {
      const { assetService } = buildAssetService();

      expect(() => assetService.getHistory('inexistente')).toThrow(NotFoundError);
    });

    it('los registros de auditoría son inmutables', async () => {
      const { assetService, auditRepository } = buildAssetService();
      const created = await assetService.create(validInput);
      const [entry] = auditRepository.findByAssetId(created.id);

      expect(() => {
        (entry as { action: string }).action = 'HACKEADO';
      }).toThrow();
    });
  });

  describe('encapsulamiento del repositorio', () => {
    it('mutar el objeto devuelto no altera el estado almacenado', async () => {
      const { assetService } = buildAssetService();
      const created = await assetService.create(validInput);

      created.amount = 999;

      expect(assetService.getById(created.id).amount).toBe(validInput.amount);
    });
  });
});
