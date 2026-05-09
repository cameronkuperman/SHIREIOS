import type { FloorClientMessage, FloorStreamMessage, TableCommand } from '@shire/shared';
import { adaptRealtimeMessage } from './contracts';

type TransportHandlers = {
  onOpen: () => void;
  onClose: (event?: unknown) => void;
  onError: (error: unknown) => void;
  onMessage: (message: FloorStreamMessage) => void;
};

function buildFloorSocketUrl(
  baseUrl: string,
  locationId: string,
  floorId: string,
  accessToken: string | null,
): string {
  try {
    const url = new URL(baseUrl);
    url.pathname = `/ws/locations/${locationId}/floors/${floorId}`;
    if (accessToken) {
      url.searchParams.set('access_token', accessToken);
    }
    return url.toString();
  } catch {
    const suffix = accessToken ? `?access_token=${encodeURIComponent(accessToken)}` : '';
    return `${baseUrl.replace(/\/$/, '')}/ws/locations/${locationId}/floors/${floorId}${suffix}`;
  }
}

export class FloorRealtimeTransport {
  private socket: WebSocket | null = null;
  private locationId: string;
  private floorId: string;

  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string | null,
    locationId: string,
    floorId: string,
    private readonly handlers: TransportHandlers,
  ) {
    this.locationId = locationId;
    this.floorId = floorId;
  }

  connect(): void {
    const socketUrl = buildFloorSocketUrl(
      this.baseUrl,
      this.locationId,
      this.floorId,
      this.accessToken,
    );
    this.socket = new WebSocket(socketUrl);

    this.socket.onopen = () => {
      this.handlers.onOpen();
    };

    this.socket.onclose = (event) => {
      this.handlers.onClose(event);
    };

    this.socket.onerror = (event) => {
      this.handlers.onError(event);
    };

    this.socket.onmessage = (event) => {
      const payload = typeof event.data === 'string' ? event.data : String(event.data);

      try {
        const parsed = JSON.parse(payload) as unknown;
        const message = adaptRealtimeMessage(parsed);
        if (message) {
          this.handlers.onMessage(message);
        }
      } catch (error) {
        this.handlers.onError(error);
      }
    };
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = null;
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  sendCommand(command: TableCommand): void {
    this.send({
      type: 'command',
      command,
    });
  }

  sendPong(timestamp: string): void {
    this.send({
      type: 'connection.pong',
      timestamp,
    });
  }

  sendSubscribe(sinceSequence: number): void {
    this.send({
      type: 'subscribe',
      floorId: this.floorId,
      ...(Number.isFinite(sinceSequence) && sinceSequence > 0 ? { sinceSequence } : {}),
    });
  }

  private send(message: FloorClientMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Floor socket is not connected');
    }

    this.socket.send(JSON.stringify(message));
  }
}

let activeFloorTransport: FloorRealtimeTransport | null = null;

export function setActiveFloorTransport(transport: FloorRealtimeTransport | null): void {
  activeFloorTransport = transport;
}

export function getActiveFloorTransport(): FloorRealtimeTransport | null {
  return activeFloorTransport;
}
