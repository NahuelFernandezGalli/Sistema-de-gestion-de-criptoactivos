# --- Etapa 1: build ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Etapa 2: runtime ---
FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000

# Las variables de entorno se inyectan al correr el contenedor
# (docker run --env-file .env ...), no se copian dentro de la imagen.
CMD ["node", "dist/server.js"]
