FROM node:20-alpine AS build
WORKDIR /app

# Shared package must be available before frontend deps are installed
COPY packages/shared ./packages/shared

COPY frontend/package*.json ./frontend/
WORKDIR /app/frontend
RUN npm install

COPY frontend/ .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
