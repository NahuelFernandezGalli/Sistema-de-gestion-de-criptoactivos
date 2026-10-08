import { DataTypes, QueryInterface } from 'sequelize';
import { MigrationFn } from 'umzug';
import { ASSET_COLUMN_TYPES } from '../asset.sequelize-model';

/** Crea la tabla de activos digitales con índice único por símbolo. */
export const up: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await queryInterface.createTable('assets', {
    id: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    symbol: { type: DataTypes.STRING(15), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    amount: { type: ASSET_COLUMN_TYPES.amount, allowNull: false },
    purchase_price: { type: ASSET_COLUMN_TYPES.purchasePrice, allowNull: false },
    created_at: { type: DataTypes.DATE(3), allowNull: false },
    updated_at: { type: DataTypes.DATE(3), allowNull: false },
  });

  // La base garantiza la regla "una posición por símbolo" aunque dos requests
  // concurrentes pasen a la vez el chequeo del service.
  await queryInterface.addIndex('assets', ['symbol'], {
    unique: true,
    name: 'assets_symbol_unique',
  });
};

export const down: MigrationFn<QueryInterface> = async ({ context: queryInterface }) => {
  await queryInterface.dropTable('assets');
};
