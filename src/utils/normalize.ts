/**
 * Reglas de normalización de texto, compartidas por `NormalizationFilter`
 * (alta de activos) y el esquema de actualización (PUT), para que un activo
 * quede con el mismo formato sin importar por dónde entró.
 */

/** " btc " -> "BTC" */
export function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

/** "  Bitcoin   Cash " -> "Bitcoin Cash" */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** " eur " -> "EUR" */
export function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}
