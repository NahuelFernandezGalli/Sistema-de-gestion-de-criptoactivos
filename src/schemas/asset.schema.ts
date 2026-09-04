import { z } from 'zod';

/**
 * Esquemas de validación (Zod).
 *
 * Son la única fuente de verdad del contrato de entrada: los tipos de los DTOs
 * se infieren de acá con `z.infer`, así el tipo de TypeScript y la validación
 * en runtime nunca se desincronizan.
 */

const symbolField = z
  .string()
  .trim()
  .min(1, 'El símbolo no puede estar vacío.')
  .max(15, 'El símbolo no puede superar los 15 caracteres.')
  .transform((value) => value.toUpperCase());

const nameField = z
  .string()
  .trim()
  .min(1, 'El nombre no puede estar vacío.')
  .max(100, 'El nombre no puede superar los 100 caracteres.');

const amountField = z
  .number('La cantidad debe ser un número.')
  .positive('La cantidad debe ser mayor a 0 (no se permiten saldos negativos).')
  .finite('La cantidad debe ser un número finito.');

const purchasePriceField = z
  .number('El precio de compra debe ser un número.')
  .positive('El precio de compra debe ser mayor a 0.')
  .finite('El precio de compra debe ser un número finito.');

/** POST /api/assets */
export const createAssetSchema = z
  .object({
    symbol: symbolField,
    name: nameField,
    amount: amountField,
    purchasePrice: purchasePriceField,
  })
  .strict();

/** PUT /api/assets/:id - actualización parcial, pero exige al menos un campo. */
export const updateAssetSchema = z
  .object({
    symbol: symbolField.optional(),
    name: nameField.optional(),
    amount: amountField.optional(),
    purchasePrice: purchasePriceField.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar.',
  });

/** Parámetro :id de la ruta. */
export const assetIdParamSchema = z.object({
  id: z.uuid('El id debe ser un UUID v4 válido.'),
});

export type CreateAssetDTO = z.infer<typeof createAssetSchema>;
export type UpdateAssetDTO = z.infer<typeof updateAssetSchema>;
export type AssetIdParam = z.infer<typeof assetIdParamSchema>;
