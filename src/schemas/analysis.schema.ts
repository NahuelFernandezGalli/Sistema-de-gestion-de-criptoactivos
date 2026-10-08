import { z } from 'zod';

/**
 * Esquema de POST /api/assets/analyze: un array de activos a analizar.
 *
 * A diferencia del alta, acá NO se rechazan montos en cero o negativos: el
 * análisis acepta el lote completo y es ScrubbingFilter quien los descarta
 * (e informa cuáles), en lugar de rechazar todo el lote por un solo activo.
 * Lo que sí se rechaza es lo estructuralmente inválido (tipos, campos).
 */
const analysisAssetSchema = z
  .object({
    symbol: z
      .string('El símbolo debe ser un texto.')
      .trim()
      .min(1, 'El símbolo no puede estar vacío.')
      .max(15, 'El símbolo no puede superar los 15 caracteres.')
      .transform((value) => value.toUpperCase()),
    name: z.string('El nombre debe ser un texto.').trim().max(100).optional(),
    amount: z.number('La cantidad debe ser un número.').finite(),
    /** Precio unitario en USD. */
    purchasePrice: z.number('El precio de compra debe ser un número.').finite(),
    /** Volatilidad en % (ej. variación de precio en 24h). Opcional. */
    volatility: z
      .number('La volatilidad debe ser un número.')
      .finite()
      .min(0, 'La volatilidad no puede ser negativa.')
      .optional(),
  })
  .strict();

export const analyzeAssetsSchema = z
  .array(analysisAssetSchema, 'Se espera un array de activos.')
  .min(1, 'Debe enviar al menos un activo para analizar.')
  .max(1000, 'No se pueden analizar más de 1000 activos por petición.');

export type AnalysisAssetInput = z.infer<typeof analysisAssetSchema>;
