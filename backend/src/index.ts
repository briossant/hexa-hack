import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerHandlers } from './ws/handlers';
import type { ServerToClientEvents, ClientToServerEvents } from '@hexa-hack/shared';
import type { SocketData } from './types';

const app = express();
const server = http.createServer(app);

export const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);
  registerHandlers(socket, io);
  socket.on('disconnect', () => console.log(`[-] ${socket.id}`));
});

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => console.log(`Backend listening on :${PORT}`));
