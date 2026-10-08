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

  getAll = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.assetService.getAll());
  };

  getById = async (_req: Request, res: Response): Promise<void> => {
    const { id } = validatedParams<AssetIdParam>(res);
    res.status(200).json(await this.assetService.getById(id));
  };

  /** El body se pasa crudo: lo valida y transforma el pipeline de ingesta. */
  create = async (req: Request, res: Response): Promise<void> => {
    const created = await this.assetService.create(req.body);
    res.status(201).json(created);
  };

  update = async (_req: Request, res: Response): Promise<void> => {
    const { id } = validatedParams<AssetIdParam>(res);
    const changes = validatedBody<UpdateAssetDTO>(res);
    res.status(200).json(await this.assetService.update(id, changes));
  };

  remove = async (_req: Request, res: Response): Promise<void> => {
    const { id } = validatedParams<AssetIdParam>(res);
    await this.assetService.delete(id);
    res.status(204).send();
  };

  getHistory = async (_req: Request, res: Response): Promise<void> => {
    const { id } = validatedParams<AssetIdParam>(res);
    res.status(200).json(await this.assetService.getHistory(id));
  };
}
