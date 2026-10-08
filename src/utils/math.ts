/**
 * Redondea a `decimals` decimales evitando la basura del punto flotante
 * (ej. 0.1 + 0.2 = 0.30000000000000004).
 */
export function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
