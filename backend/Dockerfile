FROM node:20-alpine AS build
WORKDIR /app

# Shared package must be available before backend deps are installed
COPY packages/shared ./packages/shared

COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install

COPY backend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/index.js"]
