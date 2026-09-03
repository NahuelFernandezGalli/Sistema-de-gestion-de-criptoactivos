import { Request, Response } from 'express';
import { assetsStore } from '../data/assets.store';
import { CreateAssetDTO, UpdateAssetDTO } from '../models/asset.model';
import { ExternalPriceServiceError, getCurrentPrice } from '../services/price.service';

/** Extrae el parámetro ":id" de la ruta como string (Express 5 lo tipa como string | string[]). */
function getIdParam(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

/** GET /api/assets - lista todos los activos del portafolio */
export function getAllAssets(_req: Request, res: Response): void {
  res.status(200).json(assetsStore.findAll());
}

/** GET /api/assets/:id - obtiene un activo por id */
export function getAssetById(req: Request, res: Response): void {
  const id = getIdParam(req);
  const asset = assetsStore.findById(id);

  if (!asset) {
    res.status(404).json({ message: `Activo con id "${id}" no encontrado.` });
    return;
  }

  res.status(200).json(asset);
}

/** POST /api/assets - crea un nuevo activo */
export function createAsset(req: Request, res: Response): void {
  const { symbol, name, amount, purchasePrice } = req.body as Partial<CreateAssetDTO>;

  if (
    typeof symbol !== 'string' ||
    typeof name !== 'string' ||
    typeof amount !== 'number' ||
    typeof purchasePrice !== 'number'
  ) {
    res.status(400).json({
      message:
        'Payload inválido. Se requieren: symbol (string), name (string), amount (number) y purchasePrice (number).',
    });
    return;
  }

  const newAsset = assetsStore.create({ symbol: symbol.toUpperCase(), name, amount, purchasePrice });
  res.status(201).json(newAsset);
}

/** PUT /api/assets/:id - actualiza un activo existente */
export function updateAsset(req: Request, res: Response): void {
  const id = getIdParam(req);
  const { symbol, name, amount, purchasePrice } = req.body as UpdateAssetDTO;

  const updates: UpdateAssetDTO = {};
  if (symbol !== undefined) updates.symbol = symbol.toUpperCase();
  if (name !== undefined) updates.name = name;
  if (amount !== undefined) updates.amount = amount;
  if (purchasePrice !== undefined) updates.purchasePrice = purchasePrice;

  const updated = assetsStore.update(id, updates);

  if (!updated) {
    res.status(404).json({ message: `Activo con id "${id}" no encontrado.` });
    return;
  }

  res.status(200).json(updated);
}

/** DELETE /api/assets/:id - elimina un activo */
export function deleteAsset(req: Request, res: Response): void {
  const id = getIdParam(req);
  const deleted = assetsStore.delete(id);

  if (!deleted) {
    res.status(404).json({ message: `Activo con id "${id}" no encontrado.` });
    return;
  }

  res.status(204).send();
}

/** GET /api/assets/:id/price - obtiene el precio actual del activo desde un servicio externo */
export async function getAssetCurrentPrice(req: Request, res: Response): Promise<void> {
  const id = getIdParam(req);
  const asset = assetsStore.findById(id);

  if (!asset) {
    res.status(404).json({ message: `Activo con id "${id}" no encontrado.` });
    return;
  }

  try {
    const currentPrice = await getCurrentPrice(asset.symbol);
    const currentValue = currentPrice * asset.amount;
    const purchaseValue = asset.purchasePrice * asset.amount;

    res.status(200).json({
      symbol: asset.symbol,
      name: asset.name,
      amount: asset.amount,
      purchasePrice: asset.purchasePrice,
      currentPrice,
      currentValue,
      purchaseValue,
      profitLoss: currentValue - purchaseValue,
    });
  } catch (error) {
    if (error instanceof ExternalPriceServiceError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }
    res.status(500).json({ message: 'Error inesperado al obtener el precio actual.' });
  }
}
