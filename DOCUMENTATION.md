# Crypto Portfolio API — Documentación técnica

API REST para la gestión de un portafolio de criptoactivos, con auditoría inmutable de movimientos, consulta de precios de mercado en tiempo real y procesamiento de datos con el patrón **Pipes & Filters**.

Proyecto de la materia **Arquitectura de Software** (Universidad ORT Uruguay).

---

## Índice

1. [Instalación](#1-instalación)
2. [Configuración](#2-configuración)
3. [Uso de la API](#3-uso-de-la-api)
4. [Stack tecnológico](#4-stack-tecnológico)
5. [Arquitectura](#5-arquitectura)
6. [Decisiones de diseño](#6-decisiones-de-diseño)
7. [Testing](#7-testing)
8. [Docker](#8-docker)
9. [Posibles mejoras para la próxima versión](#9-posibles-mejoras-para-la-próxima-versión)

---

## 1. Instalación

### Requisitos previos

| Requisito | Versión mínima | Por qué |
|-----------|----------------|---------|
| Node.js   | **20.6**       | Se usa el flag nativo `--env-file` (disponible desde 20.6) y `fetch` global |
| npm       | 10             | Gestor de paquetes |
| Docker    | (opcional)     | Solo si se quiere correr contenerizado |

Verificar la versión instalada:

```bash
node --version   # debe ser >= v20.6
```

### Pasos

```bash
# 1. Posicionarse en la carpeta del proyecto
cd crypto-portfolio-api

# 2. Instalar dependencias
npm install

# 3. Crear el archivo de variables de entorno a partir del ejemplo
cp .env.example .env        # en Windows (CMD): copy .env.example .env

# 4. Compilar TypeScript
npm run build

# 5. Levantar el servidor
npm start
```

Si todo salió bien, en consola aparece:

```
2026-09-04 00:36:26 [info] Servidor iniciado {"port":3000,"env":"development","url":"http://localhost:3000"}
```

Verificación rápida:

```bash
curl http://localhost:3000/health
# {"status":"ok","uptimeSeconds":3}
```

### Scripts disponibles

| Script | Comando | Qué hace |
|--------|---------|----------|
| `npm run build` | `tsc` | Compila TypeScript a `dist/` |
| `npm start` | `node --env-file=.env dist/server.js` | Levanta el servidor ya compilado |
| `npm run dev` | `build` + `start` | Compila y levanta en un solo paso |
| `npm test` | `jest` | Corre la suite de tests |
| `npm run test:watch` | `jest --watch` | Tests en modo watch |
| `npm run test:coverage` | `jest --coverage` | Tests + reporte de cobertura |
| `npm run typecheck` | `tsc --noEmit` | Chequeo de tipos sin generar archivos |

---

## 2. Configuración

Toda la configuración se maneja por variables de entorno en el archivo `.env`, que se carga con el **flag nativo de Node.js `--env-file`** (sin la librería `dotenv`).

### Variables disponibles

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto donde escucha el servidor |
| `EXTERNAL_API_BASE_URL` | `https://api.coingecko.com/api/v3` | Base URL del servicio externo de precios |
| `EXTERNAL_API_TIMEOUT_MS` | `5000` | Timeout de las llamadas al servicio externo |
| `PRICE_CACHE_TTL_MS` | `30000` | Tiempo de vida de la caché de precios (0 = deshabilitada) |
| `EXCHANGE_RATE_CACHE_TTL_MS` | `600000` | Tiempo de vida de la caché de tasas de cambio fiat (`CurrencyConversionFilter`) |
| `ANALYTICS_WHALE_THRESHOLD_USD` | `100000` | Valor de posición (USD) por encima del cual se dispara la Whale Alert |
| `ANALYTICS_VOLATILITY_THRESHOLD_PCT` | `10` | Volatilidad (%) por encima de la cual un activo es `high_risk` |
| `LOG_LEVEL` | `info` | Nivel mínimo de log (`error`, `warn`, `info`, `debug`) |
| `LOG_FILE` | `logs/app.log` | Ruta del archivo de log |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Ventana de tiempo del rate limiting |
| `RATE_LIMIT_MAX` | `5` | Peticiones permitidas por ventana por IP |
| `NODE_ENV` | `development` | Entorno de ejecución (`test` silencia los logs) |

### Ejemplo de `.env`

```env
PORT=3000
EXTERNAL_API_BASE_URL=https://api.coingecko.com/api/v3
```

> El resto de las variables tienen defaults razonables, así que solo hace falta declarar las que se quieran cambiar.

Todas las variables se leen en **un único módulo** (`src/config/env.ts`). Ningún otro archivo accede a `process.env` directamente, lo que evita que la configuración quede desparramada por el código.

---

## 3. Uso de la API

**Base URL:** `http://localhost:3000`

### Tabla de endpoints

| Método | Ruta | Descripción | Rate limit |
|--------|------|-------------|------------|
| `GET` | `/health` | Estado del servidor | — |
| `GET` | `/api/assets` | Lista todos los activos | — |
| `GET` | `/api/assets/:id` | Obtiene un activo por id | — |
| `POST` | `/api/assets` | Crea un activo (pasa por el **pipeline de ingesta**) | — |
| `POST` | `/api/assets/analyze` | Analiza el riesgo de un lote de activos (**pipeline de análisis**) | — |
| `PUT` | `/api/assets/:id` | Actualiza un activo (parcial) | — |
| `DELETE` | `/api/assets/:id` | Elimina un activo | — |
| `GET` | `/api/assets/:id/history` | Historial de auditoría del activo | — |
| `GET` | `/api/market/:id` | Valuación de mercado (precio actual + rentabilidad) | **5/min por IP** |
| `GET` | `/api/assets/:id/price` | Alias de la anterior (compatibilidad con la v1) | **5/min por IP** |

### Modelo de datos

**Asset**

```ts
{
  id: string;            // UUID v4 generado por el servidor
  symbol: string;        // "BTC" — único en el portafolio, se normaliza a mayúsculas
  name: string;          // "Bitcoin"
  amount: number;        // cantidad en posesión, siempre > 0
  purchasePrice: number; // precio de compra unitario en USD, siempre > 0
  createdAt: string;     // ISO 8601
  updatedAt: string;     // ISO 8601
}
```

Al crear un activo se puede enviar además `currency` (`USD`, `EUR`, `GBP`, `ARS`, `BRL`, `CLP`, `MXN`, `JPY`, `CAD` o `CHF`; por defecto `USD`). El precio se convierte a USD antes de guardarse, así que `currency` no forma parte de la entidad.

**AuditLog**

```ts
{
  id: string;         // UUID v4 del registro
  assetId: string;    // activo afectado
  action: "CREATE" | "UPDATE" | "DELETE";
  timestamp: string;  // ISO 8601
  snapshot: unknown;  // el activo completo (CREATE/DELETE) o {before, after} (UPDATE)
}
```

### Ejemplos

#### Crear un activo

```bash
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"symbol":"sol","name":"Solana","amount":10,"purchasePrice":90}'
```

```json
{
  "id": "8a5e19a5-c22a-46e0-acec-5bce502f98f9",
  "symbol": "SOL",
  "name": "Solana",
  "amount": 10,
  "purchasePrice": 90,
  "createdAt": "2026-09-04T00:35:42.379Z",
  "updatedAt": "2026-09-04T00:35:42.379Z"
}
```

> El símbolo se normaliza a mayúsculas y los strings se recortan automáticamente (`"  Solana  "` → `"Solana"`). Lo hace `NormalizationFilter` dentro del pipeline de ingesta.

#### Crear un activo con el precio en otra moneda

```bash
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"symbol":"  sol ","name":"  Solana   Coin ","amount":10,"purchasePrice":100,"currency":"eur"}'
```

```json
{
  "id": "98e7e89e-1418-4e22-80f0-be2e9db916f4",
  "symbol": "SOL",
  "name": "Solana Coin",
  "amount": 10,
  "purchasePrice": 111.88973879,
  "createdAt": "2026-10-08T13:28:55.021Z",
  "updatedAt": "2026-10-08T13:28:55.021Z"
}
```

> Los 100 EUR se guardaron como 111.89 USD con la tasa del momento (`CurrencyConversionFilter`).

#### Analizar el riesgo de un lote de activos

```bash
curl -X POST http://localhost:3000/api/assets/analyze \
  -H "Content-Type: application/json" \
  -d '[
    {"symbol":"btc","name":"Bitcoin","amount":3,"purchasePrice":40000.456},
    {"symbol":"doge","amount":1000,"purchasePrice":0.08123,"volatility":18.456},
    {"symbol":"eth","amount":0.0005123456789,"purchasePrice":2500,"volatility":3},
    {"symbol":"scam","amount":0,"purchasePrice":1}
  ]'
```

```json
{
  "metadata": {
    "analysisId": "5949d080-dfe1-4dd0-97c1-edec1d836979",
    "analyzedAt": "2026-10-08T13:31:47.007Z",
    "receivedCount": 4,
    "analyzedCount": 3,
    "discardedCount": 1,
    "highRiskCount": 2,
    "totalValueUsd": 120083.88
  },
  "assets": [
    { "symbol": "BTC", "name": "Bitcoin", "amount": 3, "purchasePrice": 40000.46, "positionValueUsd": 120001.37, "riskLevel": "high_risk", "riskFlags": ["WHALE_ALERT"] },
    { "symbol": "DOGE", "amount": 1000, "purchasePrice": 0.08, "volatility": 18.46, "positionValueUsd": 81.23, "riskLevel": "high_risk", "riskFlags": ["HIGH_VOLATILITY"] },
    { "symbol": "ETH", "amount": 0.00051235, "purchasePrice": 2500, "volatility": 3, "positionValueUsd": 1.28, "riskLevel": "normal", "riskFlags": [] }
  ],
  "discarded": [{ "symbol": "SCAM", "reason": "cantidad en cero o negativa" }]
}
```

Cada activo del array lleva `symbol`, `amount` y `purchasePrice` (en USD), y opcionalmente `name` y `volatility` (en %, por ejemplo la variación de 24 h). El endpoint no persiste nada: solo devuelve el reporte.

#### Actualizar (parcial)

```bash
curl -X PUT http://localhost:3000/api/assets/8a5e19a5-... \
  -H "Content-Type: application/json" \
  -d '{"amount":15}'
```

#### Consultar valuación de mercado

```bash
curl http://localhost:3000/api/market/8a5e19a5-...
```

```json
{
  "assetId": "8a5e19a5-c22a-46e0-acec-5bce502f98f9",
  "symbol": "SOL",
  "name": "Solana",
  "amount": 15,
  "purchasePrice": 90,
  "currentPrice": 142.35,
  "currentValue": 2135.25,
  "purchaseValue": 1350,
  "profitLoss": 785.25,
  "profitLossPercentage": 58.17,
  "pricedAt": "2026-09-04T00:35:50.326Z"
}
```

#### Consultar el historial de auditoría

```bash
curl http://localhost:3000/api/assets/8a5e19a5-.../history
```

```json
[
  {
    "id": "2d48dc8e-1e44-4c5c-ab7c-e3abcb9ffbd9",
    "assetId": "8a5e19a5-c22a-46e0-acec-5bce502f98f9",
    "action": "CREATE",
    "timestamp": "2026-09-04T00:35:42.380Z",
    "snapshot": { "symbol": "SOL", "amount": 10, "purchasePrice": 90, "...": "..." }
  },
  {
    "action": "UPDATE",
    "timestamp": "2026-09-04T00:35:42.497Z",
    "snapshot": { "before": { "amount": 10 }, "after": { "amount": 15 } },
    "...": "..."
  }
]
```

### Formato de errores

Todas las respuestas de error usan el mismo sobre:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos.",
    "details": [
      { "field": "amount", "message": "La cantidad debe ser mayor a 0 (no se permiten saldos negativos).", "code": "too_small" }
    ]
  }
}
```

| Código HTTP | `code` | Cuándo ocurre |
|-------------|--------|---------------|
| `400` | `VALIDATION_ERROR` | El body o los parámetros no pasan la validación de Zod (middleware o `ValidationFilter`) |
| `404` | `NOT_FOUND` | El activo o su historial no existen |
| `404` | `ROUTE_NOT_FOUND` | La ruta no existe |
| `409` | `CONFLICT` | Ya hay una posición con ese símbolo en el portafolio |
| `422` | `BUSINESS_RULE_VIOLATION` | Se viola una regla de negocio (ej. saldo no positivo) |
| `429` | `RATE_LIMIT_EXCEEDED` | Se superaron las 5 consultas de mercado por minuto |
| `502` | `EXTERNAL_SERVICE_ERROR` | Falló la comunicación con el servicio de precios o de tasas de cambio |
| `500` | `INTERNAL_SERVER_ERROR` | Error inesperado (el detalle queda solo en los logs) |

### Pruebas con Postman

1. Abrir Postman → **Import** → seleccionar `postman_collection.json`.
2. La colección viene organizada en 7 carpetas (health, CRUD, validación, mercado, auditoría, baja y Pipes & Filters) con **23 requests** y tests automáticos incluidos.
3. Correrlas en orden: la request *Crear activo* guarda el `id` generado en la variable `assetId` y el resto la reutiliza.
4. Para probar el rate limiting, ejecutar la request *Rate limit* 6 veces seguidas (o usar el **Collection Runner** con 6 iteraciones): a partir de la sexta dentro del mismo minuto responde `429`.

---

## 4. Stack tecnológico

| Capa | Tecnología | Versión | Rol |
|------|-----------|---------|-----|
| Runtime | Node.js | ≥ 20.6 | Motor de ejecución; aporta `--env-file` y `fetch` nativos |
| Lenguaje | TypeScript | 5.9 | Tipado estático en modo `strict` |
| Framework HTTP | Express.js | 5.x | Ruteo y middlewares |
| Validación | Zod | 4.x | Esquemas de validación + inferencia de tipos |
| Logging | Winston | 3.x | Logger con múltiples transports |
| Seguridad | express-rate-limit | 8.x | Control de tasa por IP |
| Testing | Jest + ts-jest | 30.x / 29.x | Tests unitarios sobre TypeScript |
| Contenedores | Docker | — | Imagen multi-stage |

**Dependencias de producción:** solo 4 (`express`, `zod`, `winston`, `express-rate-limit`). No se usan `dotenv` (reemplazado por `--env-file`), `axios` (reemplazado por `fetch` nativo) ni `uuid` (reemplazado por `crypto.randomUUID()`).

---

## 5. Arquitectura

### Arquitectura en capas

El proyecto sigue una **arquitectura en capas** con dependencias en una sola dirección: cada capa conoce solo a la de abajo y nunca al revés.

```
   HTTP request
        │
        ▼
┌───────────────────┐
│      Routes       │  Definen las rutas y encadenan middlewares
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Middlewares     │  Validación (Zod), rate limiting, logging, errores
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│    Controllers    │  Traducen HTTP ↔ dominio. Sin lógica de negocio
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│     Services      │  Lógica de negocio pura: reglas, cálculos, auditoría
└─────────┬─────────┘
          │  (el alta y el análisis pasan por un pipeline)
          ▼
┌───────────────────┐
│ Pipelines/Filters │  Validación, normalización, conversión, análisis
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│   Repositories    │  Acceso a datos (hoy: arrays en memoria)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│  Models / Schemas │  Entidades de dominio y esquemas de validación
└───────────────────┘
```

### Estructura de carpetas

```
src/
├── config/
│   └── env.ts                      # Única lectura de process.env
├── models/
│   ├── asset.model.ts              # Entidad Asset + AssetValuation
│   ├── audit.model.ts              # Entidad AuditLog + AuditAction
│   └── analysis.model.ts           # Tipos de cada etapa del pipeline de análisis
├── schemas/
│   ├── asset.schema.ts             # Esquemas Zod (fuente de verdad de los DTOs)
│   └── analysis.schema.ts          # Esquema del array de POST /assets/analyze
├── pipeline/
│   ├── pipeline.ts                 # Interfaz Filter + Pipeline runner
│   ├── ingestion.pipeline.ts       # Armado del pipeline de ingesta
│   ├── analytics.pipeline.ts       # Armado del pipeline de análisis
│   └── filters/
│       ├── validation.filter.ts    # Genérico (Zod), lo usan ambos pipelines
│       ├── ingestion/
│       │   ├── normalization.filter.ts
│       │   └── currency-conversion.filter.ts
│       └── analytics/
│           ├── scrubbing.filter.ts
│           ├── risk-analysis.filter.ts
│           └── formatting.filter.ts
├── repositories/
│   ├── asset.repository.ts         # IAssetRepository + InMemoryAssetRepository
│   └── audit.repository.ts         # IAuditRepository + InMemoryAuditRepository
├── services/
│   ├── asset.service.ts            # Reglas de negocio + coordinación de auditoría
│   ├── market.service.ts           # Cálculo de valuación y rentabilidad
│   ├── analysis.service.ts         # Punto de entrada del análisis de riesgo
│   ├── price-provider.service.ts   # IPriceProvider + CoinGeckoPriceProvider
│   └── exchange-rate-provider.service.ts  # IExchangeRateProvider + CoinGecko
├── controllers/
│   ├── asset.controller.ts
│   ├── market.controller.ts
│   └── analysis.controller.ts
├── routes/
│   ├── asset.routes.ts
│   ├── market.routes.ts
│   └── index.ts
├── middlewares/
│   ├── validate.middleware.ts      # Validación con Zod
│   ├── error.middleware.ts         # Manejo centralizado de errores
│   ├── rate-limit.middleware.ts    # 5 req/min por IP
│   └── request-logger.middleware.ts
├── errors/
│   ├── app-error.ts                # Jerarquía de errores de dominio
│   └── zod-error.ts                # ZodError -> ValidationError (400)
├── utils/
│   ├── logger.ts                   # Winston (consola + archivo)
│   ├── cache.ts                    # Caché TTL de precios y tasas
│   ├── http.ts                     # fetchJson: timeout + errores de APIs externas
│   ├── normalize.ts                # Reglas de normalización de texto
│   └── math.ts                     # Redondeo sin basura de punto flotante
├── container.ts                    # Composition root (inyección de dependencias)
├── app.ts                          # Construcción de la app Express
└── server.ts                       # Arranque + apagado ordenado

tests/
├── helpers/fakes.ts                # Dobles de prueba
├── asset.service.test.ts
├── market.service.test.ts
├── price-provider.service.test.ts
├── exchange-rate-provider.service.test.ts
├── asset.schema.test.ts
├── pipeline.test.ts                # Runner: orden, fail-fast, logging
├── ingestion-filters.test.ts       # Cada filtro de ingesta + pipeline completo
└── analytics-filters.test.ts       # Cada filtro de análisis + pipeline completo
```

### Flujo de una request

`POST /api/assets` paso a paso:

1. **Route** (`asset.routes.ts`) matchea la ruta. El alta no tiene middleware de validación: valida el pipeline.
2. **Controller** pasa el body crudo a `assetService.create()`.
3. **Service** corre el **pipeline de ingesta** (ver más abajo): validación → normalización → conversión a USD. Si un filtro falla, el pipeline se corta y el error sigue de largo (ej. `ValidationError` → `400`).
4. Con el DTO ya limpio, el **service** aplica las reglas de negocio (cantidad positiva, símbolo no duplicado), genera el UUID, persiste vía repositorio y **registra el evento de auditoría**.
5. **Repository** guarda la entidad en el array en memoria.
6. El controller responde `201` con el activo creado.
7. Si en cualquier punto se lanza un error, el **middleware de errores** lo traduce al código HTTP correspondiente. El **request logger** registra el resultado.

### Pipes & Filters

El alta de activos y el análisis de riesgo se procesan con el patrón **Pipes & Filters**: en vez de un método largo que hace todo, cada paso es un **filtro** independiente que hace una sola cosa, y un **pipe** (`Pipeline`) los ejecuta en orden pasándole a cada uno la salida del anterior.

```ts
interface Filter<TIn, TOut> {
  readonly name: string;
  process(input: TIn): TOut | Promise<TOut>;
}
```

**Pipeline de ingesta** (`POST /api/assets`):

```
body crudo ─▶ ValidationFilter ─▶ NormalizationFilter ─▶ CurrencyConversionFilter ─▶ AssetService
              estructura (Zod)    " btc " → "BTC"         EUR/ARS/... → USD           (reglas, persistencia,
                                                                                       auditoría)
```

**Pipeline de análisis** (`POST /api/assets/analyze`):

```
array crudo ─▶ ValidationFilter ─▶ ScrubbingFilter ─▶ RiskAnalysisFilter ─▶ FormattingFilter ─▶ reporte
               estructura (Zod)    descarta montos     high_risk por         redondeo +
                                   en cero o           Whale Alert o         metadatos de
                                   negativos           volatilidad           auditoría
```

Características del runner:

- **Fail-fast:** si un filtro lanza un error, los siguientes no se ejecutan y se relanza el error **original**, así el middleware de errores responde con el código que corresponde (400, 422, 502...).
- **Tipado de punta a punta:** el builder `Pipeline.create<T>().pipe(a).pipe(b)` hace que el compilador rechace conectar un filtro cuya entrada no coincide con la salida del anterior.
- **Observabilidad:** el pipeline loguea con Winston el inicio, cada filtro ejecutado con éxito y, si algo falla, **qué filtro falló y cuáles se habían completado**. Además cada filtro loguea su propia actividad:

```
[info] IngestionPipeline: iniciando pipeline {"filters":["ValidationFilter","NormalizationFilter","CurrencyConversionFilter"]}
[info] ValidationFilter: payload válido.
[info] IngestionPipeline: ValidationFilter ejecutado con éxito {"step":1}
[info] NormalizationFilter: Symbol BTC normalized. {"original":" btc"}
[info] IngestionPipeline: NormalizationFilter ejecutado con éxito {"step":2}
[info] CurrencyConversionFilter: BTC ya está en USD, sin conversión.
[info] IngestionPipeline: CurrencyConversionFilter ejecutado con éxito {"step":3}
[info] IngestionPipeline: pipeline completado
```

Y ante un payload inválido:

```
[warn]  ValidationFilter: payload rechazado. {"issues":2}
[error] IngestionPipeline: falló el filtro ValidationFilter {"step":1,"completed":[],"error":"Los datos enviados no son válidos."}
```

### Inversión de dependencias

Los services dependen de **interfaces** (`IAssetRepository`, `IAuditRepository`, `IPriceProvider`, `IExchangeRateProvider`), no de implementaciones concretas. Las implementaciones se instancian y se inyectan en un único lugar, el *composition root* (`container.ts`).

Esto tiene dos consecuencias prácticas:

- **Cambiar de infraestructura es barato.** Migrar de array en memoria a PostgreSQL es escribir una clase `PostgresAssetRepository implements IAssetRepository` y cambiar una línea en `container.ts`. Ni los services ni los controllers se enteran.
- **Los tests no necesitan infraestructura.** Se inyecta un `FakePriceProvider` y los tests corren sin red, sin base de datos y sin levantar Express.

---

## 6. Decisiones de diseño

### 6.1 La auditoría vive en el service, no en el controller

**Decisión:** `AssetService` es el único responsable de escribir en el log de auditoría, y lo hace dentro de la misma operación que modifica el activo.

**Por qué:** si la auditoría se disparara desde el controller, cualquier código que llamara al service por otro camino (un job, un comando de CLI, otro service) dejaría movimientos sin registrar. Poniéndola en el service, **es imposible modificar el portafolio sin dejar rastro**.

**Costo:** el service tiene una responsabilidad extra además de las reglas de negocio. Es un trade-off consciente: la alternativa "más pura" (eventos de dominio) agrega infraestructura que este proyecto todavía no justifica.

### 6.2 El repositorio de auditoría no expone `update` ni `delete`

**Decisión:** `IAuditRepository` solo tiene `append`, `findByAssetId` y `findAll`. Además cada registro se congela con `Object.freeze`.

**Por qué:** un historial de auditoría que se puede editar no sirve como evidencia. La inmutabilidad se garantiza *por diseño de la interfaz*, no por disciplina del programador: no existe el método para borrar, así que nadie lo puede llamar por error. Hay un test que verifica que intentar mutar un registro lanza excepción.

### 6.3 El historial sobrevive al borrado del activo

**Decisión:** `GET /api/assets/:id/history` sigue respondiendo `200` aunque el activo haya sido eliminado. Solo devuelve `404` si nunca existió ningún evento con ese id.

**Por qué:** el caso más importante para auditar es justamente el que se borró. Si el historial desapareciera junto con el activo, el sistema de auditoría no cumpliría su función. Está cubierto por un test explícito.

### 6.4 Zod como única fuente de verdad de los DTOs

**Decisión:** los tipos `CreateAssetDTO` y `UpdateAssetDTO` no se declaran a mano: se infieren con `z.infer` de los esquemas Zod.

**Por qué:** si el tipo se escribiera por separado, tarde o temprano el esquema y el tipo se desincronizan — el compilador queda contento y la validación en runtime hace otra cosa. Con `z.infer` hay **una sola definición** y es imposible que difieran.

Además los esquemas son `.strict()`: un body con campos desconocidos se rechaza en vez de ignorarse en silencio, lo que evita que un typo del cliente (`ammount` en vez de `amount`) pase desapercibido.

### 6.5 Validación duplicada: Zod en el borde, reglas en el service

**Decisión:** que `amount > 0` se valida dos veces: en el esquema Zod y en `AssetService`.

**Por qué:** no es redundancia por descuido. Zod protege la **entrada** (en el alta, desde el primer filtro del pipeline de ingesta); la regla en el service protege el **dominio**, que también podría invocarse desde un script o un test sin pasar por HTTP. Un invariante de negocio tiene que valer siempre, no solo cuando el dato llega por una request.

### 6.6 Los datos validados van en `res.locals`, no en `req.body`

**Decisión:** el middleware de validación deja el resultado en `res.locals` y los controllers lo leen con helpers tipados (`validatedBody<T>(res)`). Aplica a las rutas que siguen usando el middleware (`PUT` y los parámetros `:id`); el alta y el análisis validan dentro de su pipeline.

**Por qué:** en Express 5, `req.params` y `req.query` son getters y reasignarlos es frágil. Además, leer de `res.locals` deja explícito que **ese dato pasó por Zod**: si un controller leyera `req.body` directamente, no habría forma de saber a simple vista si fue validado.

### 6.7 `crypto.randomUUID()` en lugar de la librería `uuid`

**Decisión:** los ids se generan con `randomUUID()` del módulo `crypto` nativo.

**Por qué:** genera exactamente el mismo UUID v4 que la librería `uuid`, pero sin agregar una dependencia. Está en el core de Node desde la 14.17 y es criptográficamente seguro. Es la misma lógica que llevó a usar `--env-file` en vez de `dotenv` y `fetch` en vez de `axios`: **si el runtime ya lo trae, no se suma una dependencia**.

> Si la consigna exigiera literalmente el paquete `uuid`, el cambio es de una línea: `npm i uuid` y reemplazar el import en `asset.service.ts` y `container.ts`.

### 6.8 Errores de dominio desacoplados de HTTP

**Decisión:** los services lanzan `NotFoundError`, `ConflictError`, `BusinessRuleError`, etc. — no códigos HTTP. El middleware de errores es el único que traduce a status codes.

**Por qué:** el service no debería saber que existe HTTP. Si mañana la misma lógica se expone por gRPC, WebSocket o CLI, las reglas de negocio no cambian: solo se escribe otro traductor. Es también lo que permite testear los services afirmando sobre *tipos de error* en vez de sobre números.

Los errores inesperados se loguean completos pero al cliente se le devuelve un mensaje genérico, para no filtrar stack traces ni detalles internos.

### 6.9 Rate limiting solo en los endpoints de mercado

**Decisión:** el límite de 5 req/min se aplica a `/api/market/:id` y a `/api/assets/:id/price`, no a todo el CRUD.

**Por qué:** son las rutas que consumen la API externa. Son las caras (latencia de red) y las que pueden agotar la cuota gratuita de CoinGecko. Limitar el CRUD en memoria al mismo nivel penalizaría al usuario sin ningún beneficio.

Se usa `standardHeaders: 'draft-7'` para exponer los headers `RateLimit-*` del estándar IETF, así el cliente sabe cuántas peticiones le quedan sin tener que adivinar.

### 6.10 Caché TTL de precios

**Decisión:** los precios se cachean 30 segundos (configurable) en `MarketService`.

**Por qué:** complementa al rate limiting desde el otro lado. El rate limit protege *a la API* del abuso del cliente; la caché protege *al proveedor externo* del volumen de la API. Con 30 segundos de TTL el precio sigue siendo suficientemente actual para un portafolio, y N usuarios consultando el mismo símbolo generan una sola llamada externa.

Es inyectable, así que los tests la desactivan pasando TTL 0.

### 6.11 Los repositorios devuelven copias

**Decisión:** `InMemoryAssetRepository` devuelve `{ ...asset }` en vez de la referencia interna.

**Por qué:** con un array en memoria, devolver la referencia significa que cualquier capa superior puede mutar el "almacenamiento" sin pasar por el repositorio — y sin generar auditoría. Devolver copias hace que el repositorio en memoria se comporte como se comportaría uno contra una base de datos real, y evita bugs que aparecerían recién al migrar. Hay un test que lo verifica.

### 6.12 Un endpoint de mercado nuevo y un alias

**Decisión:** se agregó `GET /api/market/:id` (el que pide la consigna de la Parte 2) y se mantuvo `GET /api/assets/:id/price` de la Parte 1 como alias, apuntando al mismo controller.

**Por qué:** romper una ruta publicada obliga a actualizar a todos los clientes. Mantener el alias no cuesta nada (una línea de ruteo, mismo handler) y respeta la compatibilidad hacia atrás. Ambas comparten el mismo rate limiter.

### 6.13 Apagado ordenado (graceful shutdown)

**Decisión:** `server.ts` escucha `SIGTERM`/`SIGINT` y cierra el servidor esperando a que terminen las requests en curso, con un timeout de 10 s como red de seguridad.

**Por qué:** sin esto, `docker stop` o un `Ctrl+C` cortan las requests a la mitad. Es un detalle que no se nota en desarrollo pero que en un despliegue real evita errores durante cada deploy.

### 6.14 El pipeline de ingesta vive dentro del service

**Decisión:** `AssetService.create()` recibe el payload **crudo** y es él quien corre el pipeline de ingesta, en lugar de que el controller lo corra y le pase el DTO ya procesado.

**Por qué:** es el mismo argumento que la auditoría (6.1). Si el pipeline viviera en el controller, cualquier otro camino de alta (un script, un job de importación) podría saltearse la normalización o la conversión de moneda y guardar `" btc"` con un precio en pesos. Con el pipeline adentro del service **no hay forma de dar de alta un activo sin pasar por él**.

**Costo:** `create()` pasó a ser `async` (la conversión consulta una API). Es un cambio que igual iba a llegar con la persistencia en base de datos (Parte 4).

### 6.15 Validar y normalizar son filtros separados

**Decisión:** `createAssetSchema` solo verifica la **estructura** y ya no transforma (antes pasaba el símbolo a mayúsculas). La normalización la hace `NormalizationFilter`.

**Por qué:** si Zod siguiera normalizando, `NormalizationFilter` no tendría nada que hacer y el pipeline mentiría sobre quién hace qué. Para que lo que valida Zod siga siendo válido después de normalizar, las reglas de "no vacío" y longitud se miden sobre el texto recortado (`"   "` se rechaza; `"  BTC  "` pasa y después queda `"BTC"`).

El `PUT` no pasa por el pipeline (la consigna lo pide solo para el alta), así que su esquema normaliza con **las mismas funciones** (`utils/normalize.ts`) que usa el filtro. Un activo queda con el mismo formato, entre por donde entre.

### 6.16 Un único `ValidationFilter` genérico

**Decisión:** `ValidationFilter<T>` recibe el esquema Zod por constructor y lo usan los dos pipelines.

**Por qué:** muestra la principal ventaja del patrón: los filtros son piezas **reutilizables**. Además comparte con el middleware `validate` la traducción de errores (`fromZodError`), así que un `400` tiene el mismo formato venga de donde venga.

### 6.17 Tasas de cambio desde CoinGecko, con caché

**Decisión:** `CurrencyConversionFilter` depende de `IExchangeRateProvider`, implementado contra `GET /exchange_rates` de CoinGecko. La tabla completa se cachea 10 minutos.

**Por qué:** reutiliza el proveedor que ya usa la app (misma base URL, sin otra API ni API key). Ese endpoint da cuántas unidades de cada moneda vale 1 BTC, así que la tasa sale de cruzar dos cotizaciones: `1 EUR = (USD por BTC) / (EUR por BTC)`. Una sola llamada trae todas las monedas y las tasas fiat se mueven poco en minutos, por eso conviene cachear la tabla entera. Si el precio ya viene en USD, el filtro no sale a la red.

Las monedas aceptadas son una lista cerrada en el esquema Zod (`SUPPORTED_CURRENCIES`). Una moneda desconocida se rechaza en el primer filtro con un `400` claro, en vez de fallar más adelante con un `502` confuso. UYU no está porque CoinGecko no la cotiza.

### 6.18 El Scrubbing descarta, no rechaza

**Decisión:** en el análisis, un activo con monto en cero o negativo no hace fallar la request: `ScrubbingFilter` lo saca del lote y el reporte lo informa en `discarded` con el motivo.

**Por qué:** es la diferencia entre *validar* y *depurar*. Un dato estructuralmente roto (un string donde va un número) es un error del cliente y corta el pipeline con `400`. Un monto en cero es un dato válido pero irrelevante para el análisis: rechazar un lote de 500 activos por uno solo sería poco práctico. Informar los descartados evita que desaparezcan en silencio.

### 6.19 Redondeo: 2 decimales, salvo la cantidad

**Decisión:** `FormattingFilter` redondea precios, valores y volatilidad a 2 decimales, pero `amount` a **8**.

**Por qué:** una cantidad como `0.0005 BTC` (unos USD 40) redondeada a 2 decimales queda en `0.00`, y el reporte mostraría una posición vacía. 8 decimales es la precisión de un satoshi, la unidad mínima de Bitcoin. Por el mismo motivo `CurrencyConversionFilter` guarda el precio convertido con 8 decimales: un precio de `0.00002 USD` no puede quedar en cero.

Los cálculos (valor de la posición, umbrales de riesgo) se hacen con los valores sin redondear: redondear es lo **último** que pasa, justamente para no arrastrar error.

---

## 7. Testing

### Correr los tests

```bash
npm test                 # toda la suite
npm run test:coverage    # con reporte de cobertura
```

### Estado actual

```
Test Suites: 8 passed, 8 total
Tests:       113 passed, 113 total

Cobertura global: 97.83% statements | 81.41% branches | 98.3% lines
  pipeline/         100%
  services/        97.61%
  schemas/          100%
  repositories/    94.44%
```

### Qué se testea

| Archivo | Cubre |
|---------|-------|
| `asset.service.test.ts` | CRUD, pipeline de ingesta integrado (normalización, conversión, duplicados con otro formato), reglas de negocio (saldos no negativos, símbolo único), generación de auditoría en cada operación, orden cronológico del historial, inmutabilidad de los registros, encapsulamiento del repositorio |
| `market.service.test.ts` | Cálculo de valor actual, valor invertido, ganancia/pérdida y rentabilidad porcentual (incluyendo pérdidas y redondeo), comportamiento de la caché |
| `price-provider.service.test.ts` | Contrato con la API externa: armado de la URL, parseo, símbolos no soportados, errores HTTP, caídas de red |
| `asset.schema.test.ts` | Validación Zod: estructura sin normalizar, monedas soportadas, campos faltantes, tipos incorrectos, valores negativos, campos desconocidos, normalización del `PUT` |
| `exchange-rate-provider.service.test.ts` | Contrato con `/exchange_rates`: cálculo de la tasa cruzada, USD sin red, caché, monedas faltantes, errores HTTP y de red |
| `pipeline.test.ts` | El runner: orden de ejecución, paso de datos entre filtros, filtros async, **fail-fast**, error original, inmutabilidad y logs de éxito/fallo |
| `ingestion-filters.test.ts` | Cada filtro de ingesta por separado (incluido el log `NormalizationFilter: Symbol BTC normalized.`) y el pipeline completo: orden, resultado y que un payload inválido no llegue a consultar la tasa |
| `analytics-filters.test.ts` | Cada filtro de análisis por separado (descartes, umbrales, redondeo, metadatos) y el pipeline completo: orden y que lo descartado no sume al total |

### Estrategia de mocking

Los tests **no dependen de internet** y hay dos niveles de aislamiento:

1. **Inyección de un doble** (`FakePriceProvider`, `FakeExchangeRateProvider`): implementan `IPriceProvider` e `IExchangeRateProvider` con valores fijos. Los usan los tests de `MarketService`, `AssetService` y de los filtros, que se enfocan en los cálculos.
2. **Mock del `fetch` global** (`jest.fn()`): lo usan los tests de `CoinGeckoPriceProvider`, que verifican la integración con la API externa (URL, parseo, manejo de errores) sin salir a la red.

Esta separación es posible gracias a la inversión de dependencias: la lógica de cálculo y la de comunicación con el proveedor están en clases distintas y se testean por separado.

---

## 8. Docker

```bash
# Construir la imagen
docker build -t crypto-portfolio-api .

# Correr el contenedor
docker run --env-file .env -p 3000:3000 crypto-portfolio-api
```

### Sobre el Dockerfile

- **Build multi-stage:** una etapa compila TypeScript (con las devDependencies) y otra corre la app solo con las dependencias de producción y el `dist/` ya compilado. La imagen final no incluye ni el compilador ni el código fuente.
- **Las variables de entorno no se copian dentro de la imagen.** Se inyectan al correr el contenedor con `--env-file`. Meter un `.env` dentro de una imagen es un antipatrón: la imagen es inmutable y suele terminar en un registry, así que cualquier secreto quedaría ahí adentro para siempre.
- **`.dockerignore`** excluye `node_modules`, `dist` y `logs` del contexto de build.

---

## 9. Posibles mejoras para la próxima versión

### Persistencia

- **Base de datos real** (PostgreSQL + Prisma o TypeORM). La arquitectura ya está preparada: alcanza con implementar `IAssetRepository` e `IAuditRepository` contra la base y cambiar el `container.ts`. Hoy los datos se pierden al reiniciar.
- **Migraciones versionadas** para poder evolucionar el esquema sin perder datos.

### Seguridad

- **Autenticación y autorización** (JWT u OAuth2). Hoy la API es completamente pública: cualquiera puede modificar el portafolio. Es la carencia más importante de cara a producción.
- **Portafolios por usuario:** hoy hay un único portafolio global. Con autenticación, cada activo debería pertenecer a un usuario y las consultas filtrarse por él.
- **Helmet** para las cabeceras de seguridad HTTP y **CORS** configurado explícitamente.
- **`trust proxy` configurado** si se despliega detrás de un reverse proxy o load balancer: sin eso, `req.ip` devuelve la IP del proxy y el rate limiting se aplicaría a todos los clientes como si fueran uno.
- **Rate limiting distribuido** con Redis: el límite actual vive en la memoria del proceso, así que con varias instancias cada una llevaría su propia cuenta.

### Funcionalidad

- **Endpoint de resumen del portafolio** (`GET /api/portfolio/summary`): valor total, inversión total y rentabilidad global en una sola llamada, resolviendo los precios en paralelo con `Promise.all`.
- **Historial de precios y gráficos de evolución**, aprovechando los endpoints de series temporales de CoinGecko.
- **Registrar más operaciones de negocio en la auditoría** (compras y ventas parciales como eventos propios, en vez de un `UPDATE` genérico).
- **Paginación y filtros** en `GET /api/assets` y en el historial: hoy devuelven todo, lo que no escala con un portafolio grande.
- **Soporte de más criptomonedas:** hoy el mapeo símbolo → id de CoinGecko es un diccionario fijo de 12 monedas. Se podría resolver dinámicamente contra `/coins/list` y cachear el resultado.
- **Moneda de visualización** configurable: hoy se puede *ingresar* un precio en EUR, ARS, etc., pero todo se muestra en USD. UYU requeriría otro proveedor de tasas, porque CoinGecko no la cotiza.
- **Volatilidad calculada por la API:** hoy `POST /assets/analyze` usa la volatilidad que envía el cliente. Se podría obtener de CoinGecko (`include_24hr_change`) con un filtro más en el pipeline de análisis.
- **Guardar la moneda y el precio originales** del alta: hoy solo se guarda el valor en USD y la conversión queda en los logs.

### Calidad y operación

- **Tests de integración** de la capa HTTP con `supertest`: hoy los tests cubren muy bien services, schemas y repositorios, pero las rutas, los middlewares y el manejo de errores se verificaron manualmente. Es la brecha de testing más relevante.
- **CI/CD** (GitHub Actions) corriendo `typecheck`, `test` y `build` en cada push, y bloqueando el merge si algo falla.
- **ESLint + Prettier** con hooks de pre-commit para unificar estilo.
- **Documentación OpenAPI/Swagger** generada desde los esquemas Zod (con `zod-to-openapi`), sirviendo una UI interactiva en `/api-docs`.
- **Métricas y health checks más ricos** (Prometheus): latencia por endpoint, tasa de errores, estado del proveedor externo.
- **Circuit breaker** para el servicio de precios: si CoinGecko se cae, hoy cada request espera el timeout completo. Un circuit breaker cortaría rápido y devolvería el último precio conocido.
- **Rotación de logs** por fecha (`winston-daily-rotate-file`) en lugar de solo por tamaño.
