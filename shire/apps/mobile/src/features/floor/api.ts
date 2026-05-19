import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type {
  BackendFloorSnapshotDto,
  FloorTableStateMode,
  FloorSnapshot,
  FloorStreamMessage,
  TableCommand,
} from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { adaptFloorSnapshot, adaptRealtimeMessage } from './contracts';

export class FloorSnapshotUnavailableError extends Error {}

function truncate(value: unknown, max = 2000): string {
  let str: string;
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    str = String(value);
  }
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max)}…(${str.length - max} more chars)` : str;
}

function describeAxiosError(error: AxiosError): Record<string, unknown> {
  const config = error.config;
  const response = error.response as AxiosResponse | undefined;
  const baseURL = config?.baseURL ?? '';
  const url = config?.url ?? '';
  const fullUrl = baseURL && url && !/^https?:/.test(url) ? `${baseURL}${url}` : url;

  return {
    message: error.message,
    code: error.code,
    method: config?.method?.toUpperCase(),
    url,
    baseURL,
    fullUrl,
    timeoutMs: config?.timeout,
    status: response?.status,
    statusText: response?.statusText,
    responseHeaders: response?.headers,
    responseBody: response ? truncate(response.data) : undefined,
    requestParams: config?.params,
    hasAuthHeader: Boolean(
      (config?.headers as Record<string, unknown> | undefined)?.Authorization ??
        (config?.headers as Record<string, unknown> | undefined)?.authorization,
    ),
  };
}

export async function fetchFloorSnapshot(
  locationId: string,
  floorId: string,
): Promise<FloorSnapshot> {
  const path = `/locations/${locationId}/floors/${floorId}/snapshot`;
  const startedAt = Date.now();
  try {
    const response = await apiClient.get<BackendFloorSnapshotDto>(path);
    return adaptFloorSnapshot(response.data);
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;

    if (axios.isAxiosError(error)) {
      const details = describeAxiosError(error);
      const status = error.response?.status;

      if (status === 404) {
        console.warn('[FloorAPI] snapshot unavailable (404)', {
          locationId,
          floorId,
          elapsedMs,
          ...details,
        });
        throw new FloorSnapshotUnavailableError(
          'Live floor sync is not provisioned for this location yet. The saved floor map will stay available.',
        );
      }

      console.error('[FloorAPI] snapshot fetch failed', {
        locationId,
        floorId,
        elapsedMs,
        ...details,
      });

      const suffix = status ? ` (${status})` : '';
      const serverDetail =
        (error.response?.data as { message?: string; error?: string } | undefined)?.message ??
        (error.response?.data as { error?: string } | undefined)?.error;
      const reason = serverDetail
        ? `: ${truncate(serverDetail, 160)}`
        : error.code === 'ECONNABORTED'
          ? ' (request timed out)'
          : error.code === 'ERR_NETWORK'
            ? ' (network unreachable)'
            : '';
      throw new Error(`Unable to load live floor snapshot${suffix}${reason}.`);
    }

    console.error('[FloorAPI] snapshot fetch threw non-axios error', {
      locationId,
      floorId,
      elapsedMs,
      error,
    });
    throw error instanceof Error ? error : new Error('Unable to load live floor snapshot.');
  }
}

export async function sendFloorCommandHttp(
  locationId: string,
  floorId: string,
  command: TableCommand,
): Promise<FloorStreamMessage[]> {
  const response = await apiClient.post<unknown>(
    `/locations/${locationId}/floors/${floorId}/commands`,
    command,
  );
  const payload = response.data;
  const rawMessages =
    payload && typeof payload === 'object' && 'messages' in payload
      ? (payload as { messages?: unknown }).messages
      : payload;
  const messages = Array.isArray(rawMessages) ? rawMessages : [rawMessages];

  return messages.flatMap((message) => {
    const adapted = adaptRealtimeMessage(message);
    return adapted ? [adapted] : [];
  });
}

export async function updateFloorTableStateMode(
  locationId: string,
  floorId: string,
  tableStateMode: FloorTableStateMode,
): Promise<FloorSnapshot> {
  const response = await apiClient.patch<{ snapshot: BackendFloorSnapshotDto }>(
    `/locations/${locationId}/floors/${floorId}/table-state-mode`,
    { tableStateMode },
  );
  return adaptFloorSnapshot(response.data.snapshot);
}

export async function startFloorServiceDay(
  locationId: string,
  floorId: string,
): Promise<{ didReset: boolean; snapshot: FloorSnapshot; messages: FloorStreamMessage[] }> {
  const response = await apiClient.post<{
    didReset?: boolean;
    snapshot: BackendFloorSnapshotDto;
    messages?: unknown[];
  }>(`/locations/${locationId}/floors/${floorId}/service-day/start`);
  const messages = (response.data.messages ?? []).flatMap((message) => {
    const adapted = adaptRealtimeMessage(message);
    return adapted ? [adapted] : [];
  });
  return {
    didReset: Boolean(response.data.didReset),
    snapshot: adaptFloorSnapshot(response.data.snapshot),
    messages,
  };
}
