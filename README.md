# Crypto Portfolio API

API REST para gestionar un portafolio de criptoactivos, construida con **Node.js**, **Express.js** y **TypeScript**. Permite operaciones CRUD sobre una colección de activos (almacenada en memoria) y expone una ruta que consulta el precio de mercado actual de un activo contra un servicio externo (**CoinGecko**).

## Estructura del proyecto

```
src/
  app.ts                     # configuración de la app Express
  server.ts                  # punto de entrada (levanta el servidor)
  config/env.ts               # lectura de variables de entorno
  models/asset.model.ts       # interfaz Asset (símbolo, nombre, cantidad, precio de compra)
  data/assets.store.ts        # almacenamiento en memoria (array)
  controllers/assets.controller.ts  # lógica de los endpoints CRUD
  routes/assets.routes.ts     # definición de rutas
  services/price.service.ts   # integración con CoinGecko (fetch nativo)
  middlewares/error.middleware.ts   # 404 y manejo de errores
.env / .env.example           # variables de entorno (PORT, EXTERNAL_API_BASE_URL)
Dockerfile / .dockerignore    # contenedorización
postman_collection.json       # colección de Postman lista para importar
```

## Requisitos

- Node.js 20.6 o superior (usa el flag nativo `--env-file`, sin `dotenv`)
- npm

## Instalación y ejecución local

```bash
npm install
npm run build   # compila TypeScript -> dist/
npm run start   # node --env-file=.env dist/server.js
```

o en un solo paso:

```bash
npm run dev      # build + start
```

El servidor queda escuchando en `http://localhost:3000` (puerto configurable en `.env`).

Chequeo rápido:

```bash
curl http://localhost:3000/health
```

## Variables de entorno (`.env`)

```
PORT=3000
EXTERNAL_API_BASE_URL=https://api.coingecko.com/api/v3
```

Se cargan con el flag nativo de Node `--env-file=.env` (ver `package.json`, script `start`), sin depender de librerías como `dotenv`.

## Modelo de datos

```ts
interface Asset {
  id: string;            // generado por el servidor (UUID)
  symbol: string;        // ej. "BTC"
  name: string;          // ej. "Bitcoin"
  amount: number;        // cantidad en posesión
  purchasePrice: number; // precio de compra unitario (USD)
}
```

El array en memoria arranca con dos activos de ejemplo (BTC y ETH) para poder probar la API inmediatamente.

## Endpoints

| Método | Ruta                        | Descripción                                              |
|--------|-----------------------------|------------------------------------------------------------|
| GET    | `/health`                   | Chequeo de salud del servidor                              |
| GET    | `/api/assets`                | Lista todos los activos                                    |
| GET    | `/api/assets/:id`            | Obtiene un activo por id                                    |
| POST   | `/api/assets`                | Crea un activo (`symbol`, `name`, `amount`, `purchasePrice`)|
| PUT    | `/api/assets/:id`            | Actualiza un activo (campos parciales)                      |
| DELETE | `/api/assets/:id`            | Elimina un activo                                            |
| GET    | `/api/assets/:id/price`      | Consulta el precio actual del activo en CoinGecko y calcula valor actual / ganancia-pérdida |

### Ejemplo: crear un activo

```bash
curl -X POST http://localhost:3000/api/assets \
  -H "Content-Type: application/json" \
  -d '{"symbol":"SOL","name":"Solana","amount":10,"purchasePrice":90}'
```

### Ejemplo: precio actual + ganancia/pérdida

```bash
curl http://localhost:3000/api/assets/<id>/price
```

```json
{
  "symbol": "BTC",
  "name": "Bitcoin",
  "amount": 0.5,
  "purchasePrice": 42000,
  "currentPrice": 65432.1,
  "currentValue": 32716.05,
  "purchaseValue": 21000,
  "profitLoss": 11716.05
}
```

Símbolos soportados por el mapeo a CoinGecko: `BTC, ETH, USDT, BNB, SOL, XRP, ADA, DOGE, DOT, MATIC, LTC, AVAX` (se puede ampliar el diccionario en `src/services/price.service.ts`).

## Pruebas con Postman

1. Abrir Postman → **Import** → seleccionar `postman_collection.json`.
2. La colección incluye: health check, listar, crear (guarda automáticamente el `id` creado en la variable `assetId`), obtener por id, actualizar, consultar precio y eliminar.
3. Con el servidor corriendo en `localhost:3000`, ejecutar las requests en orden (Crear → las demás usan el `id` generado).

## Docker

```bash
docker build -t crypto-portfolio-api .
docker run --env-file .env -p 3000:3000 crypto-portfolio-api
```

- El build es multi-stage: una etapa compila TypeScript, la otra corre solo con dependencias de producción y el `dist/` ya compilado.
- Las variables de entorno **no** se copian dentro de la imagen; se inyectan al correr el contenedor con `--env-file .env` (o `-e PORT=3000 ...`), siguiendo la práctica estándar de Docker.
- `.dockerignore` excluye `node_modules`, `dist` y otros archivos que no deben copiarse al contexto de build.

> Nota: el Dockerfile fue construido y revisado siguiendo las prácticas estándar de multi-stage build, pero no pudo probarse `docker build` en este entorno porque no tiene salida a Docker Hub. Se recomienda correr `docker build` localmente para confirmar antes de la entrega.

## Servicio externo de precios

`src/services/price.service.ts` usa el `fetch` nativo de Node.js (sin `axios` ni otras librerías) para consultar:

```
GET {EXTERNAL_API_BASE_URL}/simple/price?ids=<id-coingecko>&vs_currencies=usd
```

Errores del servicio externo (símbolo no soportado, timeout, respuesta no-OK) se traducen a respuestas HTTP claras (`404`/`502`) en vez de propagar un error crudo.
