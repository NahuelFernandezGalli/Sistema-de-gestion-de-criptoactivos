# --- Etapa 1: build ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
# --ignore-scripts: para compilar no hacen falta binarios nativos (sqlite3 es
# solo para tests y no tiene binario precompilado para Alpine).
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Etapa 2: runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

# Las variables de entorno se inyectan al correr el contenedor
# (docker compose / docker run --env-file .env), no se copian en la imagen.
CMD ["node", "dist/server.js"]
