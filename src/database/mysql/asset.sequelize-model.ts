import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  ModelStatic,
  Sequelize,
} from 'sequelize';

/**
 * Fila de la tabla `assets` tal como la maneja Sequelize.
 *
 * `amount` y `purchasePrice` son DECIMAL: los motores SQL no tienen errores de
 * punto flotante con ese tipo, que es lo correcto para montos financieros. El
 * driver de MySQL los devuelve como string para no perder precisión, por eso
 * el tipo admite ambos y el repositorio los convierte al leer.
 */
export interface AssetRow
  extends Model<InferAttributes<AssetRow>, InferCreationAttributes<AssetRow>> {
  id: string;
  symbol: string;
  name: string;
  amount: number | string;
  purchasePrice: number | string;
  createdAt: Date;
  updatedAt: Date;
}

export type AssetModel = ModelStatic<AssetRow>;

/** Precisión de las columnas, compartida por el modelo y la migración. */
export const ASSET_COLUMN_TYPES = {
  /** Hasta 18 decimales: la unidad mínima de ETH (wei) es 10^-18. */
  amount: DataTypes.DECIMAL(38, 18),
  /** 12 decimales: alcanza para precios muy bajos (ej. SHIB). */
  purchasePrice: DataTypes.DECIMAL(36, 12),
} as const;

/**
 * Define el modelo `Asset` sobre una instancia de Sequelize.
 *
 * Es una función (y no una clase con `init` global) para poder tener varias
 * instancias a la vez: la app usa MySQL y los tests usan SQLite en memoria.
 *
 * El esquema de la tabla lo crean las migraciones, NO `sequelize.sync()`: así
 * cada cambio de esquema queda versionado y es reproducible en cualquier
 * entorno.
 */
export function defineAssetModel(sequelize: Sequelize): AssetModel {
  return sequelize.define<AssetRow>(
    'Asset',
    {
      id: { type: DataTypes.UUID, primaryKey: true },
      symbol: { type: DataTypes.STRING(15), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      amount: { type: ASSET_COLUMN_TYPES.amount, allowNull: false },
      purchasePrice: {
        type: ASSET_COLUMN_TYPES.purchasePrice,
        allowNull: false,
        field: 'purchase_price',
      },
      createdAt: { type: DataTypes.DATE(3), allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE(3), allowNull: false, field: 'updated_at' },
    },
    {
      tableName: 'assets',
      // Las fechas las fija el service (son parte de la entidad de dominio).
      timestamps: false,
    }
  );
}
