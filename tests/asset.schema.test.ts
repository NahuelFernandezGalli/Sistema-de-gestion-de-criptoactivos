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

    it('acepta un payload válido sin normalizarlo (eso es tarea de NormalizationFilter)', () => {
      const parsed = createAssetSchema.parse({ ...valid, name: '  Bitcoin  ' });

      expect(parsed.symbol).toBe('btc');
      expect(parsed.name).toBe('  Bitcoin  ');
    });

    it('asume USD si no se envía la moneda', () => {
      expect(createAssetSchema.parse(valid).currency).toBe('USD');
    });

    it('acepta monedas soportadas sin importar mayúsculas', () => {
      expect(createAssetSchema.parse({ ...valid, currency: 'eur' }).currency).toBe('eur');
    });

    it('rechaza monedas no soportadas', () => {
      expect(() => createAssetSchema.parse({ ...valid, currency: 'XYZ' })).toThrow();
    });

    it('rechaza un símbolo que solo tiene espacios', () => {
      expect(() => createAssetSchema.parse({ ...valid, symbol: '   ' })).toThrow();
    });

    it('rechaza un símbolo con espacios intermedios', () => {
      expect(() => createAssetSchema.parse({ ...valid, symbol: 'B TC' })).toThrow();
    });

    it('mide la longitud del símbolo sin contar los espacios de los extremos', () => {
      expect(() =>
        createAssetSchema.parse({ ...valid, symbol: `  ${'A'.repeat(15)}  ` })
      ).not.toThrow();
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

    it('normaliza símbolo y nombre (el PUT no pasa por el pipeline)', () => {
      const parsed = updateAssetSchema.parse({ symbol: ' eth ', name: ' Ether   Classic ' });

      expect(parsed).toEqual({ symbol: 'ETH', name: 'Ether Classic' });
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
