# Parte 2: Arquitectura Empresarial y Resiliencia

## Refactorización a Capas, Validación con Zod y Testing con Jest

En esta segunda etapa, el objetivo es transformar el prototipo inicial en una aplicación robusta, resiliente y preparada para entornos de producción.

El desafío consiste en migrar hacia una **Arquitectura en Capas** para separar las responsabilidades de transporte, lógica de negocio y persistencia. Se implementará un **Sistema de Auditoría Inmutable** que garantice la trazabilidad de cada movimiento financiero, asegurando la integridad del portafolio.

Para elevar el estándar de calidad y seguridad, se integrará validación de esquemas estricta con **Zod**, un sistema de logging profesional con **Winston** y políticas de **Rate Limiting** para proteger el consumo de recursos. Finalmente, se asegurará la estabilidad del sistema mediante pruebas unitarias automatizadas con **Jest**.

## 1. Refactorización a Arquitectura en Capas

El estudiante debe reestructurar el proyecto siguiendo este flujo de datos:

- **Routes:** Definición de rutas y mapeo a controladores.
- **Controllers:** Manejo de la interfaz HTTP (extracción de datos de `req`, envío de `res`).
- **Services:** Lógica de negocio pura (cálculos de rentabilidad, reglas de validación de negocio).
- **Repositories:** Capa de acceso a datos (abstracción del array en memoria o base de datos).
- **Models/Entities:** Definición de tipos y esquemas de datos.

## 2. Validación Avanzada con Zod y UUID

Para asegurar la integridad de los datos, se integrarán librerías de estándar industrial:

- **Zod:** Implementar esquemas de validación para los cuerpos de las peticiones (POST y PUT). Si los datos no cumplen el esquema, la API debe retornar un error `400 Bad Request` detallado.
- **UUID:** Sustituir los IDs incrementales o manuales por identificadores únicos universales (v4) generados al crear un nuevo activo.

## 3. Implementación de Testing con Jest

Se debe garantizar que la lógica de negocio funcione independientemente de la red o la base de datos:

- Configurar Jest y ts-jest para el entorno de TypeScript.
- Escribir Tests Unitarios para la capa de Services, asegurando que los cálculos de mercado y las reglas de negocio (ej: no permitir saldos negativos) sean correctos.
- Realizar Mocking de la API externa de precios para que los tests no dependan de internet.

## 4. Implementación del Sistema de Auditoría e Historial

- Crear un repositorio independiente llamado `AuditRepository`.
- **Lógica de Coordinación:** Modificar el `AssetService` para que, ante cada operación (Crear, Actualizar o Eliminar), se genere automáticamente un registro en el log de auditoría.
- El modelo `AuditLog` debe incluir: `id`, `assetId`, `action` (`CREATE`, `UPDATE`, `DELETE`) y un `timestamp`.
- Implementar un nuevo endpoint: `GET /assets/:id/history` que recupere cronológicamente todos los eventos de auditoría asociados a un activo específico.

## 5. Implementación de Logging (Winston o Pino)

- Instalar Winston o Pino y configurar un logger centralizado.
- Reemplazar todos los `console.log` por llamadas al logger (`logger.info`, `logger.error`).
- Configurar dos "transports": uno para la consola y otro para un archivo físico `logs/app.log`.

## 6. Seguridad y Control de Tasa (Rate Limiting)

- Instalar la librería `express-rate-limit`.
- Implementar una política de restricción de peticiones específica para el endpoint de consulta de mercado (`/market/:id`).
- El límite debe ser de **5 peticiones por minuto por IP**.
- Personalizar la respuesta de error para que devuelva un código HTTP `429` con un mensaje claro en formato JSON.
- Asegurar que el evento de "Límite excedido" sea registrado por el Logger (Winston) como una advertencia.
