export { DEFAULT_FLOOR_ID, DEFAULT_FLOOR_MAP } from '@shire/shared';
import { DEFAULT_FLOOR_MAP } from '@shire/shared';

export const FLOOR_FILTERS = ['All Rooms', ...DEFAULT_FLOOR_MAP.rooms.map((room) => room.filterLabel)];
