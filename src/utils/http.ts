import { ExternalServiceError } from '../errors/app-error';
import { logger } from './logger';

/**
 * GET a una API externa que devuelve JSON (fetch nativo de Node).
 *
 * Centraliza lo que todo proveedor externo necesita: timeout para que una API
 * lenta no cuelgue el request, y traducción de fallas de red o HTTP a
 * `ExternalServiceError` (502) con su log correspondiente.
 *
 * @param serviceName Nombre legible del servicio, usado en logs y mensajes.
 * @param context Datos extra para los logs (ej. el símbolo consultado).
 */
export async function fetchJson<T>(
  url: string,
  timeoutMs: number,
  serviceName: string,
  context: Record<string, unknown> = {}
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    logger.error(`Fallo al contactar el ${serviceName}`, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new ExternalServiceError(`No se pudo contactar al ${serviceName}.`);
  }

  if (!response.ok) {
    logger.error(`El ${serviceName} respondió con error`, {
      ...context,
      status: response.status,
    });
    throw new ExternalServiceError(
      `El ${serviceName} respondió con estado ${response.status}.`
    );
  }

  return (await response.json()) as T;
}
