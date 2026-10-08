# Parte 4: Persistencia y Gestión de Datos Real

## Integración de Bases de Datos con Sequelize y Mongoose

En esta cuarta etapa, eliminaremos el almacenamiento en memoria para implementar una solución de persistencia profesional. El desafío consiste en integrar dos motores de base de datos distintos, asignando a cada uno el rol que mejor desempeña según la naturaleza de los datos.

### Pasos a seguir

1. **Persistencia Relacional con MySQL y Sequelize**
   - Implementar MySQL a través del ORM Sequelize para gestionar la entidad principal `Asset`.
   - Configurar las migraciones necesarias para definir la tabla de activos digitales.
   - **Relaciones (Opcional):** Si el estudiante lo desea, puede crear una entidad `User` para que cada activo pertenezca a un propietario específico.

2. **Persistencia Documental con MongoDB y Mongoose**
   - Implementar MongoDB a través de Mongoose para gestionar el Sistema de Auditoría e Historial (`AuditLog`).
   - Debido a que los logs de auditoría pueden crecer exponencialmente y no requieren una estructura rígida, MongoDB es ideal para esta tarea.
   - Cada vez que el `AssetService` realice una operación en MySQL, deberá disparar el guardado del registro histórico en MongoDB.

3. **Refactorización de Repositorios**
   - Adaptar los repositorios existentes (`AssetRepository` y `AuditRepository`) para que utilicen los modelos de Sequelize y Mongoose respectivamente.
   - El resto de las capas (Services, Controllers, Pipes) no deberían sufrir cambios significativos, demostrando el poder de la Arquitectura en Capas.

4. **Docker Compose: Orquestación de Servicios**
   - Crear un archivo `docker-compose.yml` para levantar simultáneamente:
     - El contenedor de la API (Node.js).
     - El contenedor de la base de datos MySQL.
     - El contenedor de la base de datos MongoDB.
   - Configurar las variables de entorno nativas (`.env`) para las cadenas de conexión de ambas bases de datos.
