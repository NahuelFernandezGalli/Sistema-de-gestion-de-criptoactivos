import { z } from 'zod';
import { normalizeCurrency, normalizeName, normalizeSymbol } from '../utils/normalize';

/**
 * Esquemas de validación (Zod).
 *
 * Son la única fuente de verdad del contrato de entrada: los tipos de los DTOs
 * se infieren de acá con `z.infer`, así el tipo de TypeScript y la validación
 * en runtime nunca se desincronizan.
 *
 * Desde la Parte 3, el alta (POST) pasa por el pipeline de ingesta, donde
 * validar y normalizar son filtros distintos: `createAssetSchema` solo verifica
 * la ESTRUCTURA y deja el formato (mayúsculas, espacios) a NormalizationFilter.
 * Las reglas de "texto no vacío" y longitud se miden sobre el valor recortado,
 * para que lo que valida acá siga siendo válido después de normalizar.
 */

/** Monedas en las que se puede informar el precio de compra. */
export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'ARS',
  'BRL',
  'CLP',
  'MXN',
  'JPY',
  'CAD',
  'CHF',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const symbolField = z
  .string('El símbolo debe ser un texto.')
  .refine((value) => value.trim().length > 0, 'El símbolo no puede estar vacío.')
  .refine(
    (value) => value.trim().length <= 15,
    'El símbolo no puede superar los 15 caracteres.'
  )
  .refine(
    (value) => !/\s/.test(value.trim()),
    'El símbolo no puede contener espacios intermedios.'
  );

const nameField = z
  .string('El nombre debe ser un texto.')
  .refine((value) => value.trim().length > 0, 'El nombre no puede estar vacío.')
  .refine(
    (value) => value.trim().length <= 100,
    'El nombre no puede superar los 100 caracteres.'
  );

const amountField = z
  .number('La cantidad debe ser un número.')
  .positive('La cantidad debe ser mayor a 0 (no se permiten saldos negativos).')
  .finite('La cantidad debe ser un número finito.');

const purchasePriceField = z
  .number('El precio de compra debe ser un número.')
  .positive('El precio de compra debe ser mayor a 0.')
  .finite('El precio de compra debe ser un número finito.');

const currencyField = z
  .string('La moneda debe ser un texto.')
  .refine(
    (value) => (SUPPORTED_CURRENCIES as readonly string[]).includes(normalizeCurrency(value)),
    `Moneda no soportada. Valores aceptados: ${SUPPORTED_CURRENCIES.join(', ')}.`
  )
  .default('USD');

/** POST /api/assets (primer filtro del pipeline de ingesta). */
export const createAssetSchema = z
  .object({
    symbol: symbolField,
    name: nameField,
    amount: amountField,
    purchasePrice: purchasePriceField,
    /** Moneda de `purchasePrice`. Opcional: si no se envía se asume USD. */
    currency: currencyField,
  })
  .strict();

/**
 * PUT /api/assets/:id - actualización parcial, pero exige al menos un campo.
 *
 * La actualización no pasa por el pipeline de ingesta, así que normaliza acá
 * mismo con las mismas funciones que usa NormalizationFilter.
 */
export const updateAssetSchema = z
  .object({
    symbol: symbolField.transform(normalizeSymbol).optional(),
    name: nameField.transform(normalizeName).optional(),
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

/** Payload de alta tal como sale de ValidationFilter (aún sin normalizar). */
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
/** Alta lista para persistir: normalizada y con `purchasePrice` en USD. */
export type CreateAssetDTO = Omit<CreateAssetInput, 'currency'>;
export type UpdateAssetDTO = z.infer<typeof updateAssetSchema>;
export type AssetIdParam = z.infer<typeof assetIdParamSchema>;
