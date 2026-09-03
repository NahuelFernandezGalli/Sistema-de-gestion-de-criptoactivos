import { Router } from 'express';
import {
  createAsset,
  deleteAsset,
  getAllAssets,
  getAssetById,
  getAssetCurrentPrice,
  updateAsset,
} from '../controllers/assets.controller';

const router = Router();

// Ruta específica de precio externo declarada antes de "/:id"
// para que Express no la confunda con un id.
router.get('/:id/price', getAssetCurrentPrice);

router.get('/', getAllAssets);
router.get('/:id', getAssetById);
router.post('/', createAsset);
router.put('/:id', updateAsset);
router.delete('/:id', deleteAsset);

export default router;
