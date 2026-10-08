import { Asset } from '../models/asset.model';

/**
 * Contrato de persistencia de activos.
 *
 * Los services dependen de esta interfaz, no de la implementación concreta
 * (inversión de dependencias). Hay dos implementaciones: la de MySQL con
 * Sequelize (`SequelizeAssetRepository`) y esta en memoria, que usan los
 * tests y el modo `PERSISTENCE_DRIVER=memory`.
 *
 * Todos los métodos son asíncronos porque una base de datos real lo es: el
 * contrato tiene que poder cumplirse con cualquier motor.
 */
export interface IAssetRepository {
  findAll(): Promise<Asset[]>;
  findById(id: string): Promise<Asset | undefined>;
  findBySymbol(symbol: string): Promise<Asset | undefined>;
  create(asset: Asset): Promise<Asset>;
  update(id: string, changes: Partial<Asset>): Promise<Asset | undefined>;
  delete(id: string): Promise<boolean>;
  /**
   * Ejecuta `work` como una unidad atómica: si lanza un error, ningún cambio
   * hecho a través del repositorio que recibe por parámetro queda persistido.
   * Dentro de `work` hay que usar ESE repositorio, no `this`.
   */
  transaction<T>(work: (repository: IAssetRepository) => Promise<T>): Promise<T>;
}

/**
 * Implementación en memoria (los datos se pierden al reiniciar el proceso).
 *
 * Devuelve copias de las entidades: si entregara referencias, cualquier capa
 * superior podría mutar el "almacenamiento" sin pasar por el repositorio.
 */
export class InMemoryAssetRepository implements IAssetRepository {
  private assets: Asset[];

  constructor(seed: Asset[] = []) {
    this.assets = seed.map((asset) => ({ ...asset }));
  }

  async findAll(): Promise<Asset[]> {
    return this.assets.map((asset) => ({ ...asset }));
  }

  async findById(id: string): Promise<Asset | undefined> {
    const asset = this.assets.find((item) => item.id === id);
    return asset ? { ...asset } : undefined;
  }

  async findBySymbol(symbol: string): Promise<Asset | undefined> {
    const asset = this.assets.find(
      (item) => item.symbol.toUpperCase() === symbol.toUpperCase()
    );
    return asset ? { ...asset } : undefined;
  }

  async create(asset: Asset): Promise<Asset> {
    this.assets.push({ ...asset });
    return { ...asset };
  }

  async update(id: string, changes: Partial<Asset>): Promise<Asset | undefined> {
    const index = this.assets.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    // El id nunca se puede sobrescribir desde afuera.
    const { id: _ignored, ...safeChanges } = changes;
    const updated: Asset = { ...this.assets[index], ...safeChanges };

    this.assets[index] = updated;
    return { ...updated };
  }

  async delete(id: string): Promise<boolean> {
    const index = this.assets.findIndex((item) => item.id === id);
    if (index === -1) return false;

    this.assets.splice(index, 1);
    return true;
  }

  /**
   * "Transacción" por snapshot: si `work` falla se restaura el estado previo.
   * Alcanza para un único proceso y para los tests; no aísla operaciones
   * concurrentes como lo hace una transacción real de MySQL.
   */
  async transaction<T>(work: (repository: IAssetRepository) => Promise<T>): Promise<T> {
    const snapshot = this.assets.map((asset) => ({ ...asset }));
    try {
      return await work(this);
    } catch (error) {
      this.assets = snapshot;
      throw error;
    }
  }
}
