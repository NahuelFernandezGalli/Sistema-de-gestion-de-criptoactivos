/**
 * Caché en memoria con expiración por tiempo (TTL).
 *
 * Se usa para los precios de mercado: evita golpear la API externa en cada
 * request, lo que reduce latencia y protege la cuota gratuita del proveedor.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(key: string, value: T): void {
    if (this.ttlMs <= 0) return; // TTL 0 => caché deshabilitada (útil en tests)
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.entries.clear();
  }
}
