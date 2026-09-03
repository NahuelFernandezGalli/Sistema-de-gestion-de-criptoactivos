# Creación de una API REST con Node.js, Express.js y TypeScript

## Sistema de gestión de criptoactivos (Fintech)

En este ejercicio, los estudiantes crearán un sistema de gestión de portafolios financieros utilizando Node.js, Express.js y TypeScript. El sistema permitirá realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar) sobre una colección de activos digitales. Además, se utilizará TypeScript para proporcionar tipado estático y mejorar la robustez del código, junto con las capacidades nativas de Node.js para la gestión de variables de entorno.

## Pasos a seguir

### 1. Configuración del entorno

- Crear un nuevo directorio para el proyecto.
- Inicializar un nuevo proyecto de Node.js utilizando npm o yarn.
- Instalar las dependencias necesarias: Express.js y TypeScript.
- Configurar TypeScript para el proyecto (asegurando compatibilidad con las últimas versiones de Node.js).

### 2. Definición del modelo de datos

- Definir una interfaz TypeScript para representar un activo (`Asset`), especificando los campos como símbolo (ej. BTC), nombre, cantidad en posesión y precio de compra.

### 3. Configuración de Express.js

- Configurar un servidor Express básico en TypeScript.
- Definir las rutas necesarias para las operaciones CRUD sobre la colección de activos.

### 4. Implementación de la lógica de la API

- Implementar las funciones de controlador para manejar las operaciones CRUD sobre la colección de activos.
- Utilizar un array en memoria para almacenar temporalmente los datos.

### 5. Gestión de configuración nativa

- Crear un archivo `.env` para gestionar las variables de entorno, como el puerto del servidor y la URL base de servicios externos.
- Utilizar el flag nativo de Node.js `--env-file` para cargar estas variables sin depender de librerías externas.

### 6. Contenedorización con Docker

- Crear un archivo llamado `Dockerfile` en la raíz del proyecto para definir la imagen de la aplicación (usando una imagen base de Node.js).
- Crear un archivo `.dockerignore` para evitar copiar la carpeta `node_modules` al contenedor.
- Construir la imagen del proyecto y ejecutar el contenedor mapeando los puertos para poder acceder a la API desde la máquina host.

### 7. Pruebas con Postman

- Instalar Postman si aún no está instalado.
- Probar las diferentes rutas y métodos de la API utilizando Postman.
- Realizar solicitudes GET, POST, PUT y DELETE para crear, leer, actualizar y eliminar activos respectivamente.

## Integración con servicios externos

- Realizar solicitudes HTTP a un servicio externo de precios de mercado (a elección del estudiante) para obtener datos en tiempo real.
- Implementar una ruta adicional para obtener el precio actual de un activo utilizando este servicio externo.
- Ejemplos de APIs sugeridas:
  - **CoinCap API:** https://api.coincap.io/v2/assets/bitcoin
  - **CoinGecko API:** https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd
  - **CryptoCompare API:** https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD

## Recursos adicionales

- [Documentación de Express.js](https://expressjs.com/es/)
- [Documentación de TypeScript](https://www.typescriptlang.org/docs/)
- [Soporte nativo de archivos .env](https://nodejs.org/en/blog/release/v20.6.0)
