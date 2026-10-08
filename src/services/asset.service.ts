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
 */
export class AssetService {
  constructor(
    private readonly assetRepository: IAssetRepository,
    private readonly auditRepository: IAuditRepository,
    private readonly ingestionPipeline: IngestionPipeline
  ) {}

  getAll(): Asset[] {
    return this.assetRepository.findAll();
  }

  getById(id: string): Asset {
    const asset = this.assetRepository.findById(id);
    if (!asset) {
      throw new NotFoundError(`No existe un activo con id "${id}".`);
    }
    return asset;
  }

  /**
   * Alta de un activo. Recibe el payload CRUDO: validarlo, normalizarlo y
   * pasarlo a USD es trabajo del pipeline de ingesta. Que el pipeline viva
   * dentro del service (y no en el controller) garantiza que no haya forma de
   * dar de alta un activo salteándolo.
   */
  async create(input: unknown): Promise<Asset> {
    const data = await this.ingestionPipeline.run(input);

    // Las reglas de negocio se siguen verificando acá aunque Zod ya las haya
    // chequeado: el service no confía en que lo llamen con datos validados.
    this.assertPositiveAmounts(data.amount, data.purchasePrice);

    const duplicated = this.assetRepository.findBySymbol(data.symbol);
    if (duplicated) {
      throw new ConflictError(
        `El portafolio ya tiene una posición en "${data.symbol}". Actualizá la existente (id ${duplicated.id}) en lugar de duplicarla.`
      );
    }

    const now = new Date().toISOString();
    const asset: Asset = {
      id: randomUUID(),
      symbol: data.symbol,
      name: data.name,
      amount: data.amount,
      purchasePrice: data.purchasePrice,
      createdAt: now,
      updatedAt: now,
    };

    const created = this.assetRepository.create(asset);
    this.recordAudit(created.id, AuditAction.CREATE, created);
    logger.info('Activo creado', { assetId: created.id, symbol: created.symbol });

    return created;
  }

  update(id: string, changes: UpdateAssetDTO): Asset {
    const current = this.getById(id);

    this.assertPositiveAmounts(
      changes.amount ?? current.amount,
      changes.purchasePrice ?? current.purchasePrice
    );

    if (changes.symbol && changes.symbol !== current.symbol) {
      const duplicated = this.assetRepository.findBySymbol(changes.symbol);
      if (duplicated && duplicated.id !== id) {
        throw new ConflictError(
          `El portafolio ya tiene una posición en "${changes.symbol}".`
        );
      }
    }

    const updated = this.assetRepository.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });

    // Defensivo: getById ya garantizó que existe, pero el repositorio podría
    // devolver undefined ante una condición de carrera en otra implementación.
    if (!updated) {
      throw new NotFoundError(`No existe un activo con id "${id}".`);
    }

    this.recordAudit(updated.id, AuditAction.UPDATE, {
      before: current,
      after: updated,
    });
    logger.info('Activo actualizado', { assetId: updated.id, changes });

    return updated;
  }

  delete(id: string): void {
    const asset = this.getById(id);
    const deleted = this.assetRepository.delete(id);

    if (!deleted) {
      throw new NotFoundError(`No existe un activo con id "${id}".`);
    }

    this.recordAudit(asset.id, AuditAction.DELETE, asset);
    logger.info('Activo eliminado', { assetId: asset.id, symbol: asset.symbol });
  }

  /**
   * Historial de auditoría de un activo.
   *
   * A diferencia del resto de los métodos, esto NO exige que el activo siga
   * existiendo: el sentido de un log inmutable es poder auditar justamente lo
   * que se borró. Solo devuelve 404 si nunca hubo ningún evento con ese id.
   */
  getHistory(assetId: string): AuditLog[] {
    const history = this.auditRepository.findByAssetId(assetId);

    if (history.length === 0) {
      throw new NotFoundError(
        `No hay historial de auditoría para el activo "${assetId}".`
      );
    }

    return history;
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

  private recordAudit(assetId: string, action: AuditAction, snapshot: unknown): void {
    this.auditRepository.append({
      id: randomUUID(),
      assetId,
      action,
      timestamp: new Date().toISOString(),
      snapshot,
    });
  }
}
