import axios from 'axios';
import type {
  WaiterRoutingState,
  WaiterRoutingUpdatePayload,
} from '@shire/shared';
import { apiClient } from '@/services/api/client';
import { normalizeWaiterRoutingState } from './contracts';

type WaiterRoutingResponse = WaiterRoutingState | { routing: WaiterRoutingState };

function unwrapRoutingResponse(response: WaiterRoutingResponse): WaiterRoutingState {
  if ('routing' in response && response.routing) {
    return normalizeWaiterRoutingState(response.routing);
  }

  return normalizeWaiterRoutingState(response as WaiterRoutingState);
}

export function toWaiterRoutingUpdatePayload(
  state: WaiterRoutingState,
): WaiterRoutingUpdatePayload {
  return {
    mode: state.mode,
    waiters: state.waiters.map((waiter) => ({
      id: waiter.id,
      name: waiter.name,
      isTemporary: waiter.isTemporary,
      status: waiter.status,
      isActive: waiter.isActive,
    })),
    activeWaiterIds: state.activeWaiterIds,
    sectionAssignments: state.sectionAssignments,
    tableAssignments: state.tableAssignments,
    rotationOrder: state.rotationOrder,
    nextWaiterId: state.nextWaiterId,
  };
}

export async function fetchWaiterRouting(locationId: string): Promise<WaiterRoutingState> {
  try {
    const response = await apiClient.get<WaiterRoutingResponse>(`/locations/${locationId}/routing`);
    return unwrapRoutingResponse(response.data);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn('[RoutingAPI] routing unavailable', JSON.stringify({ locationId }));
      return normalizeWaiterRoutingState(null);
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const suffix = status ? ` (${status})` : '';
      throw new Error(`Unable to load waiter routing${suffix}.`);
    }

    throw error instanceof Error ? error : new Error('Unable to load waiter routing.');
  }
}

export async function updateWaiterRouting(
  locationId: string,
  payload: WaiterRoutingUpdatePayload,
): Promise<WaiterRoutingState> {
  const response = await apiClient.put<WaiterRoutingResponse>(
    `/locations/${locationId}/routing`,
    payload,
  );
  return unwrapRoutingResponse(response.data);
}
