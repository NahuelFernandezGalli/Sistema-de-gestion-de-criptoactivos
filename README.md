# Crypto Portfolio API

API REST para la gestión de un portafolio de criptoactivos, con **arquitectura en capas**, **auditoría inmutable** de movimientos, consulta de **precios de mercado en tiempo real** y procesamiento con **Pipes & Filters** (ingesta y análisis de riesgo).

Materia: Arquitectura de Software — Universidad ORT Uruguay.

> **Documentación completa en [`DOCUMENTATION.md`](./DOCUMENTATION.md)**: instalación, configuración, endpoints, stack, arquitectura, decisiones de diseño y mejoras futuras.

---

## Arranque rápido

```bash
npm install
cp .env.example .env      # Windows (CMD): copy .env.example .env
npm run build
npm start
```

```bash
curl http://localhost:3000/health
# {"status":"ok","uptimeSeconds":1}
```

Requiere **Node.js >= 20.6** (usa el flag nativo `--env-file` y `fetch` global).

## Tests

```bash
npm test                 # 113 tests
npm run test:coverage    # cobertura (~98%)
```

## Docker

```bash
docker build -t crypto-portfolio-api .
docker run --env-file .env -p 3000:3000 crypto-portfolio-api
```

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/health` | Estado del servidor |
| `GET` | `/api/assets` | Lista todos los activos |
| `GET` | `/api/assets/:id` | Obtiene un activo |
| `POST` | `/api/assets` | Crea un activo (pipeline de ingesta: validación → normalización → conversión a USD) |
| `POST` | `/api/assets/analyze` | Análisis de riesgo de un lote de activos (pipeline de análisis) |
| `PUT` | `/api/assets/:id` | Actualiza un activo |
| `DELETE` | `/api/assets/:id` | Elimina un activo |
| `GET` | `/api/assets/:id/history` | Historial de auditoría |
| `GET` | `/api/market/:id` | Valuación de mercado (5 req/min por IP) |

Colección de Postman lista para importar: [`postman_collection.json`](./postman_collection.json) (23 requests con tests automáticos).

## Stack

Node.js · TypeScript · Express 5 · Zod · Winston · express-rate-limit · Jest · Docker

## Estructura

```
src/
├── routes/          # Definición de rutas
├── controllers/     # Interfaz HTTP
├── services/        # Lógica de negocio
├── repositories/    # Acceso a datos
├── models/          # Entidades de dominio
├── schemas/         # Validación (Zod)
├── pipeline/        # Pipes & Filters: runner, filtros y armado de pipelines
├── middlewares/     # Validación, errores, rate limit, logging
├── errors/          # Jerarquía de errores
├── utils/           # Logger, caché, HTTP, normalización y redondeo
└── container.ts     # Inyección de dependencias
```
