import express, { Application, Request, Response } from 'express';
import { buildContainer, Container } from './container';
import { buildApiRoutes } from './routes';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/request-logger.middleware';

/**
 * Construye la aplicación Express.
 *
 * Recibe el contenedor de dependencias por parámetro (con un default para uso
 * normal) para que los tests puedan inyectar repositorios o proveedores falsos
 * sin tocar el resto de la app.
 */
export function createApp(container: Container = buildContainer()): Application {
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
