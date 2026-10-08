import { Request, Response } from 'express';
import { AnalysisService } from '../services/analysis.service';

/** Capa HTTP del análisis de activos (POST /api/assets/analyze). */
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /** El body se pasa crudo: lo valida el primer filtro del pipeline. */
  analyze = async (req: Request, res: Response): Promise<void> => {
    const report = await this.analysisService.analyze(req.body);
    res.status(200).json(report);
  };
}
