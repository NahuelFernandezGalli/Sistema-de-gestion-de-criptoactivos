/**
 * Entidad de dominio: un activo digital (criptoactivo) del portafolio.
 *
 * Los DTOs de entrada NO se definen acá: se infieren de los esquemas Zod
 * (`src/schemas/asset.schema.ts`) para que el tipo y la validación en runtime
 * no puedan quedar desincronizados.
 */
export interface Asset {
  /** Identificador único (UUID v4) generado por el servidor. */
  id: string;
  /** Símbolo del criptoactivo, ej. "BTC". Único dentro del portafolio. */
  symbol: string;
  /** Nombre del criptoactivo, ej. "Bitcoin". */
  name: string;
  /** Cantidad en posesión. Siempre > 0. */
  amount: number;
  /** Precio de compra unitario en USD. Siempre > 0. */
  purchasePrice: number;
  /** Fecha de alta del activo en el portafolio (ISO 8601). */
  createdAt: string;
  /** Fecha de la última modificación (ISO 8601). */
  updatedAt: string;
}

/**
 * Valuación de un activo contra el precio de mercado actual.
 * Es un objeto de lectura calculado por `MarketService`, no una entidad.
 */
export interface AssetValuation {
  assetId: string;
  symbol: string;
  name: string;
  amount: number;
  purchasePrice: number;
  currentPrice: number;
  /** amount * currentPrice */
  currentValue: number;
  /** amount * purchasePrice */
  purchaseValue: number;
  /** currentValue - purchaseValue */
  profitLoss: number;
  /** Rentabilidad porcentual respecto de la inversión inicial. */
  profitLossPercentage: number;
  /** Momento en que se tomó el precio (ISO 8601). */
  pricedAt: string;
}
