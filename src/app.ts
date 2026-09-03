import express, { Application, Request, Response } from 'express';
import assetsRoutes from './routes/assets.routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  app.use('/api/assets', assetsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
