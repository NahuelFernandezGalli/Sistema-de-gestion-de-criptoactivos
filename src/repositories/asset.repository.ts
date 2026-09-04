import { Asset } from '../models/asset.model';

/**
 * Contrato de persistencia de activos.
 *
 * Los services dependen de esta interfaz, no de la implementación concreta
 * (inversión de dependencias). Cambiar el array en memoria por PostgreSQL o
 * MongoDB implica escribir una nueva clase que implemente `IAssetRepository`,
 * sin tocar una línea de lógica de negocio.
 */
export interface IAssetRepository {
  findAll(): Asset[];
  findById(id: string): Asset | undefined;
  findBySymbol(symbol: string): Asset | undefined;
  create(asset: Asset): Asset;
  update(id: string, changes: Partial<Asset>): Asset | undefined;
  delete(id: string): boolean;
}

/**
 * Implementación en memoria (los datos se pierden al reiniciar el proceso).
 *
 * Devuelve copias de las entidades: si entregara referencias, cualquier capa
 * superior podría mutar el "almacenamiento" sin pasar por el repositorio.
 */
export class InMemoryAssetRepository implements IAssetRepository {
  private readonly assets: Asset[];

  constructor(seed: Asset[] = []) {
    this.assets = seed.map((asset) => ({ ...asset }));
  }

  findAll(): Asset[] {
    return this.assets.map((asset) => ({ ...asset }));
  }

  findById(id: string): Asset | undefined {
    const asset = this.assets.find((item) => item.id === id);
    return asset ? { ...asset } : undefined;
  }

  findBySymbol(symbol: string): Asset | undefined {
    const asset = this.assets.find(
      (item) => item.symbol.toUpperCase() === symbol.toUpperCase()
    );
    return asset ? { ...asset } : undefined;
  }

  create(asset: Asset): Asset {
    this.assets.push({ ...asset });
    return { ...asset };
  }

  update(id: string, changes: Partial<Asset>): Asset | undefined {
    const index = this.assets.findIndex((item) => item.id === id);
    if (index === -1) return undefined;

    // El id nunca se puede sobrescribir desde afuera.
    const { id: _ignored, ...safeChanges } = changes;
    const updated: Asset = { ...this.assets[index], ...safeChanges };

    this.assets[index] = updated;
    return { ...updated };
  }

  delete(id: string): boolean {
    const index = this.assets.findIndex((item) => item.id === id);
    if (index === -1) return false;

    this.assets.splice(index, 1);
    return true;
  }
}
