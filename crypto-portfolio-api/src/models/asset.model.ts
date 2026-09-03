/**
 * Representa un activo digital (criptoactivo) dentro del portafolio.
 */
export interface Asset {
  /** Identificador único interno del activo dentro del portafolio */
  id: string;
  /** Símbolo del criptoactivo, ej. "BTC", "ETH" */
  symbol: string;
  /** Nombre del criptoactivo, ej. "Bitcoin" */
  name: string;
  /** Cantidad en posesión del activo */
  amount: number;
  /** Precio de compra (unitario, en USD) */
  purchasePrice: number;
}

/**
 * Payload aceptado al crear un nuevo activo.
 * El id se genera del lado del servidor.
 */
export type CreateAssetDTO = Omit<Asset, 'id'>;

/**
 * Payload aceptado al actualizar un activo existente.
 * Todos los campos son opcionales (actualización parcial).
 */
export type UpdateAssetDTO = Partial<CreateAssetDTO>;
