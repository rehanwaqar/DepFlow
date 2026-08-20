# syntax=docker/dockerfile:1

FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package*.json ./backend/
RUN npm ci --prefix backend
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000
CMD ["sh", "-c", "node scripts/prepare.js && node src/index.js"]
