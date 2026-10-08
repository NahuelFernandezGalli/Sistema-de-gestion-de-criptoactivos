import { randomUUID } from 'crypto';
import { Asset } from '../models/asset.model';
import { AuditAction, AuditLog } from '../models/audit.model';
import { IAssetRepository } from '../repositories/asset.repository';
import { IAuditRepository } from '../repositories/audit.repository';
import { UpdateAssetDTO } from '../schemas/asset.schema';
import { BusinessRuleError, ConflictError, NotFoundError } from '../errors/app-error';
import { IngestionPipeline } from '../pipeline/ingestion.pipeline';
import { logger } from '../utils/logger';

/**
 * Lógica de negocio del portafolio.
 *
 * No sabe nada de HTTP (no recibe `req` ni `res`) ni de cómo se persisten los
 * datos: recibe sus dependencias por constructor, lo que permite testearlo con
 * repositorios falsos y sin levantar el servidor.
 *
 * Es también el único punto donde se coordina la auditoría: cualquier alta,
 * modificación o baja pasa por acá, así que ninguna operación puede quedar sin
 * registrar (si la auditoría viviera en el controller, bastaría con llamar al
 * repositorio desde otro lado para saltearla).
 *
 * Desde la Parte 4 los activos viven en MySQL y la auditoría en MongoDB. Cada
 * escritura corre dentro de una transacción de activos que incluye el append
 * de auditoría: si MongoDB falla, el cambio en MySQL se deshace, así que no
 * puede quedar un movimiento sin su registro histórico.
 */
export class AssetService {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly ingestionPipeline: IngestionPipeline
  ) {}

  async getAll(): Promise<Asset[]> {
    return this.assetRepository.findAll();
  }

  async getById(id: string): Promise<Asset> {
    return this.findExisting(this.assetRepository, id);
  }

  /**
   * Alta de un activo. Recibe el payload CRUDO: validarlo, normalizarlo y
   * pasarlo a USD es trabajo del pipeline de ingesta. Que el pipeline viva
   * dentro del service (y no en el controller) garantiza que no haya forma de
   * dar de alta un activo salteándolo.
   */
  async create(input: unknown): Promise<Asset> {
    // El pipeline puede consultar una API externa: corre ANTES de abrir la
    // transacción para no tener la conexión a MySQL tomada mientras tanto.
    const data = await this.ingestionPipeline.run(input);

    // Las reglas de negocio se siguen verificando acá aunque Zod ya las haya
    // chequeado: el service no confía en que lo llamen con datos validados.
    this.assertPositiveAmounts(data.amount, data.purchasePrice);

    const created = await this.assetRepository.transaction(async (assets) => {
      const duplicated = await assets.findBySymbol(data.symbol);
      if (duplicated) {
        throw new ConflictError(
          `El portafolio ya tiene una posición en "${data.symbol}". Actualizá la existente (id ${duplicated.id}) en lugar de duplicarla.`
        );
      }

      const now = new Date().toISOString();
      const asset = await assets.create({
        id: randomUUID(),
        symbol: data.symbol,
        name: data.name,
        amount: data.amount,
        purchasePrice: data.purchasePrice,
        createdAt: now,
        updatedAt: now,
      });

      await this.recordAudit(asset.id, AuditAction.CREATE, asset);
      return asset;
    });

    logger.info('Activo creado', { assetId: created.id, symbol: created.symbol });
    return created;
  }

  async update(id: string, changes: UpdateAssetDTO): Promise<Asset> {
    const updated = await this.assetRepository.transaction(async (assets) => {
      const current = await this.findExisting(assets, id);

      this.assertPositiveAmounts(
        changes.amount ?? current.amount,
        changes.purchasePrice ?? current.purchasePrice
      );

      if (changes.symbol && changes.symbol !== current.symbol) {
        const duplicated = await assets.findBySymbol(changes.symbol);
        if (duplicated && duplicated.id !== id) {
          throw new ConflictError(
            `El portafolio ya tiene una posición en "${changes.symbol}".`
          );
        }
      }

      const result = await assets.update(id, {
        ...changes,
        updatedAt: new Date().toISOString(),
      });

      // Defensivo: findExisting ya garantizó que existe, pero otra conexión
      // podría haberlo borrado en el medio.
      if (!result) {
        throw new NotFoundError(`No existe un activo con id "${id}".`);
      }

      await this.recordAudit(result.id, AuditAction.UPDATE, {
        before: current,
        after: result,
      });
      return result;
    });

    logger.info('Activo actualizado', { assetId: updated.id, changes });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.assetRepository.transaction(async (assets) => {
      const asset = await this.findExisting(assets, id);

      if (!(await assets.delete(id))) {
        throw new NotFoundError(`No existe un activo con id "${id}".`);
      }

      await this.recordAudit(asset.id, AuditAction.DELETE, asset);
      return asset;
    });

    logger.info('Activo eliminado', { assetId: deleted.id, symbol: deleted.symbol });
  }

  /**
   * Historial de auditoría de un activo.
   *
   * A diferencia del resto de los métodos, esto NO exige que el activo siga
   * existiendo: el sentido de un log inmutable es poder auditar justamente lo
   * que se borró. Solo devuelve 404 si nunca hubo ningún evento con ese id.
   */
  async getHistory(assetId: string): Promise<AuditLog[]> {
    const history = await this.auditRepository.findByAssetId(assetId);

    if (history.length === 0) {
      throw new NotFoundError(
        `No hay historial de auditoría para el activo "${assetId}".`
      );
    }

    return history;
  }

  private async findExisting(assets: IAssetRepository, id: string): Promise<Asset> {
    const asset = await assets.findById(id);
    if (!asset) {
      throw new NotFoundError(`No existe un activo con id "${id}".`);
    }
    return asset;
  }

  /** Regla de negocio: el portafolio nunca acepta saldos o precios no positivos. */
  private assertPositiveAmounts(amount: number, purchasePrice: number): void {
    if (amount <= 0) {
      throw new BusinessRuleError(
        'La cantidad debe ser mayor a 0: no se permiten saldos negativos ni en cero.'
      );
    }
    if (purchasePrice <= 0) {
      throw new BusinessRuleError('El precio de compra debe ser mayor a 0.');
    }
  }

  private async recordAudit(
    assetId: string,
    action: AuditAction,
    snapshot: unknown
  ): Promise<void> {
    await this.auditRepository.append({
      id: randomUUID(),
      assetId,
      action,
      timestamp: new Date().toISOString(),
      snapshot,
    });
  }
}
