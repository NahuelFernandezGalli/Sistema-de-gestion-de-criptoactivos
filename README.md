# Crypto Portfolio API

API REST para la gestión de un portafolio de criptoactivos, con **arquitectura en capas**, **auditoría inmutable** de movimientos y consulta de **precios de mercado en tiempo real**.

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
npm test                 # 49 tests
npm run test:coverage    # cobertura (~96%)
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
| `POST` | `/api/assets` | Crea un activo |
| `PUT` | `/api/assets/:id` | Actualiza un activo |
| `DELETE` | `/api/assets/:id` | Elimina un activo |
| `GET` | `/api/assets/:id/history` | Historial de auditoría |
| `GET` | `/api/market/:id` | Valuación de mercado (5 req/min por IP) |

Colección de Postman lista para importar: [`postman_collection.json`](./postman_collection.json) (18 requests con tests automáticos).

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
├── middlewares/     # Validación, errores, rate limit, logging
├── errors/          # Jerarquía de errores
├── utils/           # Logger y caché
└── container.ts     # Inyección de dependencias
```
