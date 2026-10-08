import { ConnectionError, Sequelize, Transaction, UniqueConstraintError } from 'sequelize';
import { AssetModel, AssetRow } from '../database/mysql/asset.sequelize-model';
import { ConflictError, ServiceUnavailableError } from '../errors/app-error';
import { Asset } from '../models/asset.model';
import { IAssetRepository } from './asset.repository';

/**
 * Repositorio de activos sobre MySQL (Sequelize).
 *
 * Traduce entre la fila de la base y la entidad de dominio `Asset`, de modo
 * que ninguna otra capa ve tipos de Sequelize. Cada instancia puede estar
 * atada a una transacción: `transaction()` crea una instancia nueva que manda
 * todas sus queries dentro de esa transacción.
 */
export class SequelizeAssetRepository implements IAssetRepository {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly model: AssetModel,
    private readonly currentTransaction?: Transaction
  ) {}

  async findAll(): Promise<Asset[]> {
    const rows = await this.model.findAll({
      order: [['createdAt', 'ASC']],
      transaction: this.currentTransaction,
    });
    return rows.map(toAsset);
  }

  async findById(id: string): Promise<Asset | undefined> {
    const row = await this.model.findByPk(id, { transaction: this.currentTransaction });
    return row ? toAsset(row) : undefined;
  }

  async findBySymbol(symbol: string): Promise<Asset | undefined> {
    const row = await this.model.findOne({
      where: { symbol: symbol.toUpperCase() },
      transaction: this.currentTransaction,
    });
    return row ? toAsset(row) : undefined;
  }

  async create(asset: Asset): Promise<Asset> {
    try {
      const row = await this.model.create(toRow(asset), {
        transaction: this.currentTransaction,
      });
      return toAsset(row);
    } catch (error) {
      throw translateError(error, asset.symbol);
    }
  }

  async update(id: string, changes: Partial<Asset>): Promise<Asset | undefined> {
    const row = await this.model.findByPk(id, { transaction: this.currentTransaction });
    if (!row) return undefined;

    // El id nunca se puede sobrescribir desde afuera.
    const { id: _ignored, createdAt, updatedAt, ...fields } = changes;
    try {
      await row.update(
        {
          ...fields,
          ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
          ...(updatedAt ? { updatedAt: new Date(updatedAt) } : {}),
        },
        { transaction: this.currentTransaction }
      );
    } catch (error) {
      throw translateError(error, changes.symbol ?? row.symbol);
    }
    return toAsset(row);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await this.model.destroy({
      where: { id },
      transaction: this.currentTransaction,
    });
    return deleted > 0;
  }

  /**
   * Transacción administrada de Sequelize: hace COMMIT si `work` termina bien
   * y ROLLBACK si lanza. Si ya estamos dentro de una, se reutiliza.
   */
  async transaction<T>(work: (repository: IAssetRepository) => Promise<T>): Promise<T> {
    if (this.currentTransaction) return work(this);

    try {
      return await this.sequelize.transaction((transaction) =>
        work(new SequelizeAssetRepository(this.sequelize, this.model, transaction))
      );
    } catch (error) {
      throw translateError(error);
    }
  }
}

function toAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    amount: Number(row.amount),
    purchasePrice: Number(row.purchasePrice),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function toRow(asset: Asset) {
  return {
    ...asset,
    createdAt: new Date(asset.createdAt),
    updatedAt: new Date(asset.updatedAt),
  };
}

/**
 * Traduce errores de Sequelize a errores de aplicación.
 *
 * El índice único de `symbol` es la última línea de defensa contra
 * duplicados: si dos altas concurrentes pasan el chequeo del service, la base
 * rechaza la segunda y acá se traduce a un 409 en vez de un 500.
 */
function translateError(error: unknown, symbol?: string): unknown {
  if (error instanceof UniqueConstraintError) {
    return new ConflictError(
      symbol
        ? `El portafolio ya tiene una posición en "${symbol}".`
        : 'Ya existe un activo con ese símbolo.'
    );
  }
  // MySQL caído o inaccesible: 503 en lugar de un 500 genérico.
  if (error instanceof ConnectionError) {
    return new ServiceUnavailableError('La base de datos de activos (MySQL) no está disponible.');
  }
  return error;
}
