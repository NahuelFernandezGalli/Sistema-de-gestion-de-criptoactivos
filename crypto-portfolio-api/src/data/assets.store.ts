import { randomUUID } from 'crypto';
import { Asset } from '../models/asset.model';

/**
 * Almacenamiento en memoria de los activos del portafolio.
 * Se reinicia cada vez que el servidor se reinicia (no persiste en disco/DB).
 */
class AssetsStore {
  private assets: Asset[] = [
    {
      id: randomUUID(),
      symbol: 'BTC',
      name: 'Bitcoin',
      amount: 0.5,
      purchasePrice: 42000,
    },
    {
      id: randomUUID(),
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 3,
      purchasePrice: 2500,
    },
  ];

  findAll(): Asset[] {
    return this.assets;
  }

  findById(id: string): Asset | undefined {
    return this.assets.find((asset) => asset.id === id);
  }

  findBySymbol(symbol: string): Asset | undefined {
    return this.assets.find(
      (asset) => asset.symbol.toLowerCase() === symbol.toLowerCase()
    );
  }

  create(data: Omit<Asset, 'id'>): Asset {
    const newAsset: Asset = { id: randomUUID(), ...data };
    this.assets.push(newAsset);
    return newAsset;
  }

  update(id: string, data: Partial<Omit<Asset, 'id'>>): Asset | undefined {
    const asset = this.findById(id);
    if (!asset) return undefined;
    Object.assign(asset, data);
    return asset;
  }

  delete(id: string): boolean {
    const index = this.assets.findIndex((asset) => asset.id === id);
    if (index === -1) return false;
    this.assets.splice(index, 1);
    return true;
  }
}

// Instancia única (singleton) compartida por toda la app.
export const assetsStore = new AssetsStore();
