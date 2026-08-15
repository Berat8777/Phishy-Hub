import http from 'http';
import type { AddressInfo } from 'net';
import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from '../../src/app';
import { initSockets } from '../../src/sockets';

/** A fresh Express app for REST-only tests — supertest(app) needs no listening socket. */
export function buildApp(): Express {
  return createApp();
}

export interface TestSocketServer {
  app: Express;
  httpServer: http.Server;
  io: SocketIOServer;
  baseUrl: string;
  close: () => Promise<void>;
}

/** A real listening HTTP server with Socket.IO wired up, for socket.io-client tests. */
export async function startTestServer(): Promise<TestSocketServer> {
  const app = createApp();
  const httpServer = http.createServer(app);
  const io = initSockets(httpServer);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;

  return {
    app,
    httpServer,
    io,
    baseUrl: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        io.close();
        httpServer.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}
