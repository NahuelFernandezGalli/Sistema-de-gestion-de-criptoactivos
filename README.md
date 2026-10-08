# Crypto Portfolio API

API REST para la gestión de un portafolio de criptoactivos, con **arquitectura en capas**, **auditoría inmutable** de movimientos, consulta de **precios de mercado en tiempo real** procesamiento con **Pipes & Filters** (ingesta y análisis de riesgo) y persistencia en **MySQL** (activos, Sequelize) y **MongoDB** (auditoría, Mongoose).

Materia: Arquitectura de Software — Universidad ORT Uruguay.

> **Documentación completa en [`DOCUMENTATION.md`](./DOCUMENTATION.md)**: instalación, configuración, endpoints, stack, arquitectura, decisiones de diseño y mejoras futuras.

---

## Arranque rápido

```bash
cp .env.example .env      # Windows (CMD): copy .env.example .env
docker compose up --build # API + MySQL + MongoDB
```

O con la API local y solo las bases en Docker:

```bash
npm install
cp .env.example .env
docker compose up -d mysql mongo
npm run build
npm start                 # aplica las migraciones pendientes al arrancar
```

Para probar sin bases de datos: `PERSISTENCE_DRIVER=memory` en el `.env`.

```bash
curl http://localhost:3000/health
# {"status":"ok","uptimeSeconds":1}
```

Requiere **Node.js >= 20.6** (usa el flag nativo `--env-file` y `fetch` global).

## Tests

```bash
npm test                 # 144 tests (no necesitan MySQL ni MongoDB)
npm run test:coverage    # cobertura (~96%)
```

## Base de datos

```bash
npm run db:migrate          # aplica migraciones pendientes
npm run db:migrate:undo     # revierte la última
npm run db:migrate:status   # aplicadas y pendientes
```

`docker compose down` conserva los datos (volúmenes); `docker compose down -v` los borra.

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

Node.js · TypeScript · Express 5 · Zod · Winston · express-rate-limit · MySQL + Sequelize + Umzug · MongoDB + Mongoose · Jest · Docker Compose

## Estructura

```
src/
├── routes/          # Definición de rutas
├── controllers/     # Interfaz HTTP
├── services/        # Lógica de negocio
├── repositories/    # Acceso a datos (MySQL, MongoDB y en memoria)
├── database/        # Conexiones, modelos, migraciones y armado de la persistencia
├── models/          # Entidades de dominio
├── schemas/         # Validación (Zod)
├── pipeline/        # Pipes & Filters: runner, filtros y armado de pipelines
├── middlewares/     # Validación, errores, rate limit, logging
├── errors/          # Jerarquía de errores
├── utils/           # Logger, caché, HTTP, normalización y redondeo
└── container.ts     # Inyección de dependencias
```
