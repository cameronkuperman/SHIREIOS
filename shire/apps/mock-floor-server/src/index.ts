import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import type { Duplex } from 'node:stream';
import { URL } from 'node:url';
import type { BackendFloorStreamMessage, FloorClientMessage } from '@shire/shared';
import {
  applyTableCommand,
  createRuntime,
  createSnapshot,
  createSnapshotMessage,
  runDeterministicScenarioStep,
  runRandomAiStep,
} from './runtime.ts';

type WsConnection = {
  readyState: number;
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  on: ((
    event: 'message',
    listener: (data: Buffer | string) => void,
  ) => void) &
    ((event: 'close', listener: () => void) => void) &
    ((event: 'error', listener: (error: Error) => void) => void);
};

type WsServer = {
  on: (event: 'connection', listener: (socket: WsConnection, request: IncomingMessage) => void) => void;
  emit: (event: 'connection', socket: WsConnection, request: IncomingMessage) => void;
  handleUpgrade: (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    callback: (socket: WsConnection, request: IncomingMessage) => void,
  ) => void;
};

type WsModule = {
  OPEN: number;
  Server: new (options: { noServer: boolean }) => WsServer;
};

const require = createRequire(import.meta.url);
const WebSocket = require('ws') as WsModule;

const PORT = Number(process.env.MOCK_FLOOR_SERVER_PORT ?? '3000');
const HOST = process.env.MOCK_FLOOR_SERVER_HOST ?? '127.0.0.1';
const clients = new Set<WsConnection>();
const wss = new WebSocket.Server({ noServer: true });
let runtime = createRuntime();

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function sendMessage(socket: WsConnection, message: BackendFloorStreamMessage): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(message: BackendFloorStreamMessage): void {
  for (const client of clients) {
    sendMessage(client, message);
  }
}

function parseClientMessage(raw: Buffer | string): FloorClientMessage | null {
  try {
    const parsed = JSON.parse(raw.toString()) as FloorClientMessage;
    return parsed;
  } catch {
    return null;
  }
}

function handleHttp(request: IncomingMessage, response: ServerResponse): void {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);
  const snapshotMatch =
    requestUrl.pathname.match(/^\/api\/floors\/([^/]+)\/snapshot$/) ??
    requestUrl.pathname.match(/^\/api\/v1\/locations\/[^/]+\/floors\/([^/]+)\/snapshot$/);

  if (request.method === 'GET' && snapshotMatch?.[1]) {
    if (snapshotMatch[1] !== runtime.floorId) {
      sendJson(response, 404, { error: 'Unknown floor.' });
      return;
    }

    sendJson(response, 200, createSnapshot(runtime));
    return;
  }

  if (request.method === 'GET' && requestUrl.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      floorId: runtime.floorId,
      sequence: runtime.sequence,
    });
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

function handleClientMessage(socket: WsConnection, message: FloorClientMessage | null): void {
  if (!message) {
    return;
  }

  if (message.type === 'subscribe') {
    sendMessage(socket, createSnapshotMessage(runtime));
    return;
  }

  if (message.type === 'connection.pong') {
    return;
  }

  const result = applyTableCommand(runtime, message.command);
  runtime = result.runtime;

  if (result.message.type === 'command.rejected') {
    sendMessage(socket, result.message);
    return;
  }

  broadcast(result.message);
}

const server = createServer(handleHttp);

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `${HOST}:${PORT}`}`);
  const isLegacyPath = requestUrl.pathname.startsWith('/ws/floors/');
  const isLocationPath = /^\/ws\/locations\/[^/]+\/floors\/[^/]+$/.test(requestUrl.pathname);
  if (!isLegacyPath && !isLocationPath) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws, upgradedRequest) => {
    wss.emit('connection', ws, upgradedRequest);
  });
});

wss.on('connection', (socket) => {
  clients.add(socket);
  sendMessage(socket, createSnapshotMessage(runtime));

  socket.on('message', (data) => {
    handleClientMessage(socket, parseClientMessage(data));
  });

  socket.on('close', () => {
    clients.delete(socket);
  });

  socket.on('error', () => {
    clients.delete(socket);
  });
});

setInterval(() => {
  broadcast({
    type: 'connection.ping',
    timestamp: new Date().toISOString(),
  });
}, 15_000);

setInterval(() => {
  const result = runDeterministicScenarioStep(runtime);
  runtime = result.runtime;
  broadcast(result.message);
}, 10_000);

setInterval(() => {
  const result = runRandomAiStep(runtime);
  runtime = result.runtime;
  broadcast(result.message);
}, 18_000);

server.listen(PORT, HOST, () => {
  process.stdout.write(`Mock floor server listening on http://${HOST}:${PORT}\n`);
});
