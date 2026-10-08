import { Request, Response } from 'express';
import { AssetService } from '../services/asset.service';
import { validatedBody, validatedParams } from '../middlewares/validate.middleware';
import { AssetIdParam, UpdateAssetDTO } from '../schemas/asset.schema';

/**
 * Capa de transporte HTTP: extrae datos de la request, delega en el service y
 * arma la response. No contiene lógica de negocio ni accede a los repositorios.
 *
 * Los errores no se capturan acá: se dejan propagar al middleware de errores,
 * que es el único que decide el código HTTP.
 */
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  getAll = (_req: Request, res: Response): void => {
    const assets = this.assetService.getAll();
    res.status(200).json(assets);
  };

  getById = (_req: Request, res: Response): void => {
    const { id } = validatedParams<AssetIdParam>(res);
    res.status(200).json(this.assetService.getById(id));
  };

  /** El body se pasa crudo: lo valida y transforma el pipeline de ingesta. */
  create = async (req: Request, res: Response): Promise<void> => {
    const created = await this.assetService.create(req.body);
    res.status(201).json(created);
  };

  update = (_req: Request, res: Response): void => {
    const { id } = validatedParams<AssetIdParam>(res);
    const changes = validatedBody<UpdateAssetDTO>(res);
    res.status(200).json(this.assetService.update(id, changes));
  };

  remove = (_req: Request, res: Response): void => {
    const { id } = validatedParams<AssetIdParam>(res);
    this.assetService.delete(id);
    res.status(204).send();
  };

  getHistory = (_req: Request, res: Response): void => {
    const { id } = validatedParams<AssetIdParam>(res);
    res.status(200).json(this.assetService.getHistory(id));
  };
}
