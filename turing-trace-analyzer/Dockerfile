FROM node:20-alpine
WORKDIR /app

COPY turing-trace-analyzer/package*.json ./
RUN npm install --omit=dev

COPY turing-trace-analyzer/src ./src

EXPOSE 3002
CMD ["node", "src/server.js"]
