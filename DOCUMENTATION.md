# Crypto Portfolio API — Documentación técnica

API REST para la gestión de un portafolio de criptoactivos, con auditoría inmutable de movimientos y consulta de precios de mercado en tiempo real.

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
| `POST` | `/api/assets` | Crea un activo | — |
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

> El símbolo se normaliza a mayúsculas y los strings se recortan automáticamente (`"  Solana  "` → `"Solana"`).

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
| `400` | `VALIDATION_ERROR` | El body o los parámetros no pasan la validación de Zod |
| `404` | `NOT_FOUND` | El activo o su historial no existen |
| `404` | `ROUTE_NOT_FOUND` | La ruta no existe |
| `409` | `CONFLICT` | Ya hay una posición con ese símbolo en el portafolio |
| `422` | `BUSINESS_RULE_VIOLATION` | Se viola una regla de negocio (ej. saldo no positivo) |
| `429` | `RATE_LIMIT_EXCEEDED` | Se superaron las 5 consultas de mercado por minuto |
| `502` | `EXTERNAL_SERVICE_ERROR` | Falló la comunicación con el servicio de precios |
| `500` | `INTERNAL_SERVER_ERROR` | Error inesperado (el detalle queda solo en los logs) |

### Pruebas con Postman

1. Abrir Postman → **Import** → seleccionar `postman_collection.json`.
2. La colección viene organizada en 6 carpetas (health, CRUD, validación, mercado, auditoría, baja) con **18 requests** y tests automáticos incluidos.
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
│   └── audit.model.ts              # Entidad AuditLog + AuditAction
├── schemas/
│   └── asset.schema.ts             # Esquemas Zod (fuente de verdad de los DTOs)
├── repositories/
│   ├── asset.repository.ts         # IAssetRepository + InMemoryAssetRepository
│   └── audit.repository.ts         # IAuditRepository + InMemoryAuditRepository
├── services/
│   ├── asset.service.ts            # Reglas de negocio + coordinación de auditoría
│   ├── market.service.ts           # Cálculo de valuación y rentabilidad
│   └── price-provider.service.ts   # IPriceProvider + CoinGeckoPriceProvider
├── controllers/
│   ├── asset.controller.ts
│   └── market.controller.ts
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
│   └── app-error.ts                # Jerarquía de errores de dominio
├── utils/
│   ├── logger.ts                   # Winston (consola + archivo)
│   └── cache.ts                    # Caché TTL de precios
├── container.ts                    # Composition root (inyección de dependencias)
├── app.ts                          # Construcción de la app Express
└── server.ts                       # Arranque + apagado ordenado

tests/
├── helpers/fakes.ts                # Dobles de prueba
├── asset.service.test.ts
├── market.service.test.ts
├── price-provider.service.test.ts
└── asset.schema.test.ts
```

### Flujo de una request

`POST /api/assets` paso a paso:

1. **Route** (`asset.routes.ts`) matchea la ruta y encadena los middlewares.
2. **Middleware de validación** parsea el body con el esquema Zod. Si falla, lanza `ValidationError` → `400`. Si pasa, deja el dato ya normalizado en `res.locals`.
3. **Controller** lee el dato validado y llama a `assetService.create()`.
4. **Service** aplica las reglas de negocio (cantidad positiva, símbolo no duplicado), genera el UUID, persiste vía repositorio y **registra el evento de auditoría**.
5. **Repository** guarda la entidad en el array en memoria.
6. El controller responde `201` con el activo creado.
7. Si en cualquier punto se lanza un error, el **middleware de errores** lo traduce al código HTTP correspondiente. El **request logger** registra el resultado.

### Inversión de dependencias

Los services dependen de **interfaces** (`IAssetRepository`, `IAuditRepository`, `IPriceProvider`), no de implementaciones concretas. Las implementaciones se instancian y se inyectan en un único lugar, el *composition root* (`container.ts`).

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

**Por qué:** no es redundancia por descuido. Zod protege el **borde HTTP**; la regla en el service protege el **dominio**, que también podría invocarse desde un script o un test sin pasar por HTTP. Un invariante de negocio tiene que valer siempre, no solo cuando el dato llega por una request.

### 6.6 Los datos validados van en `res.locals`, no en `req.body`

**Decisión:** el middleware de validación deja el resultado en `res.locals` y los controllers lo leen con helpers tipados (`validatedBody<T>(res)`).

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

---

## 7. Testing

### Correr los tests

```bash
npm test                 # toda la suite
npm run test:coverage    # con reporte de cobertura
```

### Estado actual

```
Test Suites: 4 passed, 4 total
Tests:       49 passed, 49 total

Cobertura global: 95.69% statements | 79.41% branches | 96.61% lines
  services/        97.87%
  schemas/          100%
  repositories/    94.44%
```

### Qué se testea

| Archivo | Cubre |
|---------|-------|
| `asset.service.test.ts` | CRUD, reglas de negocio (saldos no negativos, símbolo único), generación de auditoría en cada operación, orden cronológico del historial, inmutabilidad de los registros, encapsulamiento del repositorio |
| `market.service.test.ts` | Cálculo de valor actual, valor invertido, ganancia/pérdida y rentabilidad porcentual (incluyendo pérdidas y redondeo), comportamiento de la caché |
| `price-provider.service.test.ts` | Contrato con la API externa: armado de la URL, parseo, símbolos no soportados, errores HTTP, caídas de red |
| `asset.schema.test.ts` | Validación Zod: normalización, campos faltantes, tipos incorrectos, valores negativos, campos desconocidos |

### Estrategia de mocking

Los tests **no dependen de internet** y hay dos niveles de aislamiento:

1. **Inyección de un doble** (`FakePriceProvider`): implementa `IPriceProvider` con precios fijos. Lo usan los tests de `MarketService`, que se enfocan en los cálculos.
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
- **Múltiples monedas de referencia** además de USD (EUR, UYU).

### Calidad y operación

- **Tests de integración** de la capa HTTP con `supertest`: hoy los tests cubren muy bien services, schemas y repositorios, pero las rutas, los middlewares y el manejo de errores se verificaron manualmente. Es la brecha de testing más relevante.
- **CI/CD** (GitHub Actions) corriendo `typecheck`, `test` y `build` en cada push, y bloqueando el merge si algo falla.
- **ESLint + Prettier** con hooks de pre-commit para unificar estilo.
- **Documentación OpenAPI/Swagger** generada desde los esquemas Zod (con `zod-to-openapi`), sirviendo una UI interactiva en `/api-docs`.
- **Métricas y health checks más ricos** (Prometheus): latencia por endpoint, tasa de errores, estado del proveedor externo.
- **Circuit breaker** para el servicio de precios: si CoinGecko se cae, hoy cada request espera el timeout completo. Un circuit breaker cortaría rápido y devolvería el último precio conocido.
- **Rotación de logs** por fecha (`winston-daily-rotate-file`) en lugar de solo por tamaño.
