import express, { Application, Request, Response } from 'express';
import { Container } from './container';
import { buildApiRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/request-logger.middleware';

/**
 * Construye la aplicación Express.
 *
 * Recibe el contenedor de dependencias ya armado (ver server.ts): la app no
 * sabe si los repositorios son MySQL/MongoDB o en memoria, y los tests pueden
 * inyectar dobles sin tocar el resto.
 */
export function createApp(container: Container): Application {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
  });

  app.use('/api', buildApiRoutes(container));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
