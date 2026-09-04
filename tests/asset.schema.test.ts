import {
  createAssetSchema,
  updateAssetSchema,
  assetIdParamSchema,
} from '../src/schemas/asset.schema';

describe('Esquemas de validación (Zod)', () => {
  describe('createAssetSchema', () => {
    const valid = {
      symbol: 'btc',
      name: 'Bitcoin',
      amount: 1,
      purchasePrice: 40000,
    };

    it('acepta un payload válido y normaliza el símbolo a mayúsculas', () => {
      const parsed = createAssetSchema.parse(valid);

      expect(parsed.symbol).toBe('BTC');
    });

    it('recorta los espacios sobrantes del nombre', () => {
      const parsed = createAssetSchema.parse({ ...valid, name: '  Bitcoin  ' });

      expect(parsed.name).toBe('Bitcoin');
    });

    it('rechaza campos faltantes', () => {
      expect(() => createAssetSchema.parse({ symbol: 'BTC' })).toThrow();
    });

    it('rechaza tipos incorrectos', () => {
      expect(() =>
        createAssetSchema.parse({ ...valid, amount: '1' })
      ).toThrow();
    });

    it('rechaza cantidades negativas o en cero', () => {
      expect(() => createAssetSchema.parse({ ...valid, amount: -1 })).toThrow();
      expect(() => createAssetSchema.parse({ ...valid, amount: 0 })).toThrow();
    });

    it('rechaza campos desconocidos (schema estricto)', () => {
      expect(() =>
        createAssetSchema.parse({ ...valid, isAdmin: true })
      ).toThrow();
    });

    it('informa el campo exacto que falló', () => {
      const result = createAssetSchema.safeParse({ ...valid, purchasePrice: -5 });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['purchasePrice']);
      }
    });
  });

  describe('updateAssetSchema', () => {
    it('acepta una actualización parcial', () => {
      expect(() => updateAssetSchema.parse({ amount: 3 })).not.toThrow();
    });

    it('rechaza un body vacío', () => {
      expect(() => updateAssetSchema.parse({})).toThrow();
    });

    it('rechaza valores inválidos en los campos enviados', () => {
      expect(() => updateAssetSchema.parse({ amount: -3 })).toThrow();
    });
  });

  describe('assetIdParamSchema', () => {
    it('acepta un UUID válido', () => {
      const id = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

      expect(assetIdParamSchema.parse({ id }).id).toBe(id);
    });

    it('rechaza un id que no es UUID', () => {
      expect(() => assetIdParamSchema.parse({ id: 'abc' })).toThrow();
    });
  });
});
