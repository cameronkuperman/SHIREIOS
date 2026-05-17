import axios, { type AxiosError, type AxiosResponse } from 'axios';
import type { BackendFloorSnapshotDto, FloorSnapshot } from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { adaptFloorSnapshot } from './contracts';

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
