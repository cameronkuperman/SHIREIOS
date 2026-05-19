import type {
  FloorMap,
  FloorMapRoom,
  FloorMapSectionPlan,
  FloorMapTable,
  TableShape,
  TableType,
} from '@shire/shared';
import { DEFAULT_FLOOR_MAP } from './floorMap';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function humanizeRoomId(roomId: string): string {
  return roomId
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeShape(shape: unknown): TableShape {
  return shape === 'square' || shape === 'horizontal' ? shape : 'circle';
}

function normalizeType(type: unknown): TableType {
  switch (type) {
    case 'high-top':
    case 'counter':
    case 'bar':
    case 'outdoor':
    case 'booth':
      return type;
    default:
      return 'regular';
  }
}

type NormalizedTablesResult = {
  tables: Record<string, FloorMapTable>;
  aliases: Record<string, string>;
};

function normalizeTable(tableKey: string, value: unknown): FloorMapTable | null {
  if (!isRecord(value)) {
    return null;
  }

  const rawTableId =
    typeof value.tableId === 'string' && value.tableId.trim() ? value.tableId.trim() : tableKey;
  const tableNumber =
    typeof value.tableNumber === 'string' && value.tableNumber.trim()
      ? value.tableNumber.trim()
      : rawTableId;
  const tableId = tableNumber;
  const roomId =
    typeof value.roomId === 'string' && value.roomId.trim() ? value.roomId : 'main-room';

  return {
    tableId,
    tableNumber,
    roomId,
    section: typeof value.section === 'string' ? value.section : '',
    capacity:
      typeof value.capacity === 'number' && Number.isFinite(value.capacity) ? value.capacity : 2,
    shape: normalizeShape(value.shape),
    type: normalizeType(value.type),
    assignedServer: typeof value.assignedServer === 'string' ? value.assignedServer : null,
    x: typeof value.x === 'number' && Number.isFinite(value.x) ? value.x : undefined,
    y: typeof value.y === 'number' && Number.isFinite(value.y) ? value.y : undefined,
    rotation:
      typeof value.rotation === 'number' && Number.isFinite(value.rotation)
        ? value.rotation
        : undefined,
    width:
      typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0
        ? value.width
        : undefined,
    height:
      typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0
        ? value.height
        : undefined,
  };
}

function normalizeTables(value: unknown): NormalizedTablesResult {
  if (!isRecord(value)) {
    return { tables: {}, aliases: {} };
  }

  return Object.entries(value).reduce<NormalizedTablesResult>(
    (result, [tableKey, tableValue]) => {
      const normalizedTable = normalizeTable(tableKey, tableValue);
      if (!normalizedTable) {
        return result;
      }

      const rawTableId =
        isRecord(tableValue) && typeof tableValue.tableId === 'string' && tableValue.tableId.trim()
          ? tableValue.tableId.trim()
          : tableKey;

      result.tables[normalizedTable.tableId] = normalizedTable;
      result.aliases[tableKey] = normalizedTable.tableId;
      result.aliases[rawTableId] = normalizedTable.tableId;
      result.aliases[normalizedTable.tableId] = normalizedTable.tableId;
      return result;
    },
    { tables: {}, aliases: {} },
  );
}

function createDerivedRoom(roomId: string): FloorMapRoom {
  const label = humanizeRoomId(roomId);
  return {
    roomId,
    label: label.toUpperCase(),
    filterLabel: label,
    flex: 1,
    variant: 'default',
    rows: [],
    layoutMode: 'freeform',
  };
}

function deriveRoomsFromTables(tables: Record<string, FloorMapTable>): FloorMapRoom[] {
  const roomIds = Array.from(
    new Set(Object.values(tables).map((table) => table.roomId || 'main-room')),
  );

  if (roomIds.length === 0) {
    return [createDerivedRoom('main-room')];
  }

  return roomIds.map((roomId) => createDerivedRoom(roomId));
}

function normalizeRoom(value: unknown, tableAliases: Record<string, string>): FloorMapRoom | null {
  if (!isRecord(value) || typeof value.roomId !== 'string' || !value.roomId.trim()) {
    return null;
  }

  const label =
    typeof value.label === 'string' && value.label.trim()
      ? value.label
      : humanizeRoomId(value.roomId).toUpperCase();
  const filterLabel =
    typeof value.filterLabel === 'string' && value.filterLabel.trim()
      ? value.filterLabel
      : humanizeRoomId(value.roomId);

  const rows = Array.isArray(value.rows)
    ? value.rows.map((row) =>
        Array.isArray(row)
          ? row
              .filter((tableId): tableId is string => typeof tableId === 'string')
              .map((tableId) => tableAliases[tableId] ?? tableId)
          : [],
      )
    : [];

  return {
    roomId: value.roomId,
    label,
    filterLabel,
    flex: typeof value.flex === 'number' && Number.isFinite(value.flex) ? value.flex : 1,
    variant: value.variant === 'patio' ? 'patio' : 'default',
    rows,
    layoutMode: value.layoutMode === 'freeform' ? 'freeform' : 'grid',
  };
}

function normalizeRooms(
  value: unknown,
  tables: Record<string, FloorMapTable>,
  tableAliases: Record<string, string>,
): FloorMapRoom[] {
  if (!Array.isArray(value)) {
    return deriveRoomsFromTables(tables);
  }

  const rooms = value
    .map((room) => normalizeRoom(room, tableAliases))
    .filter((room): room is FloorMapRoom => room != null);

  return rooms.length > 0 ? rooms : deriveRoomsFromTables(tables);
}

function normalizeWaiterCount(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Math.max(1, fallback);
}

function normalizeSectionPlans(
  value: unknown,
  tableAliases: Record<string, string>,
): FloorMapSectionPlan[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((plan, index): FloorMapSectionPlan | null => {
      if (!isRecord(plan)) {
        return null;
      }
      const rawSections = Array.isArray(plan.sections) ? plan.sections : [];
      const sections = rawSections
        .map((section): FloorMapSectionPlan['sections'][number] | null => {
          if (!isRecord(section)) {
            return null;
          }
          const rawSectionId =
            typeof section.sectionId === 'string' && section.sectionId.trim()
              ? section.sectionId.trim()
              : typeof section.name === 'string' && section.name.trim()
                ? section.name.trim()
                : '';
          if (!rawSectionId) {
            return null;
          }
          const tableIds = Array.isArray(section.tableIds)
            ? [
                ...new Set(
                  section.tableIds
                    .filter((tableId): tableId is string => typeof tableId === 'string')
                    .map((tableId) => tableAliases[tableId])
                    .filter((tableId): tableId is string => typeof tableId === 'string'),
                ),
              ]
            : [];
          return {
            sectionId: rawSectionId,
            tableIds,
          };
        })
        .filter((section): section is FloorMapSectionPlan['sections'][number] => section != null);

      const waiterCount = normalizeWaiterCount(plan.waiterCount, sections.length || index + 1);
      const planId =
        typeof plan.planId === 'string' && plan.planId.trim()
          ? plan.planId.trim()
          : `section-plan-${waiterCount}-${index + 1}`;
      const name =
        typeof plan.name === 'string' && plan.name.trim()
          ? plan.name.trim()
          : `${waiterCount} Waiters`;

      return {
        planId,
        name,
        waiterCount,
        sections,
        isDefault: Boolean(plan.isDefault),
        createdAt: typeof plan.createdAt === 'string' ? plan.createdAt : undefined,
        updatedAt: typeof plan.updatedAt === 'string' ? plan.updatedAt : undefined,
      };
    })
    .filter((plan): plan is FloorMapSectionPlan => plan != null);
}

export function normalizeFloorMap(value: unknown): FloorMap {
  const candidate =
    isRecord(value) && 'map_data' in value && isRecord(value.map_data) ? value.map_data : value;

  if (!isRecord(candidate)) {
    return DEFAULT_FLOOR_MAP;
  }

  const { tables, aliases } = normalizeTables(candidate.tables);
  const rooms = normalizeRooms(candidate.rooms, tables, aliases);
  const sectionPlans = normalizeSectionPlans(candidate.sectionPlans, aliases);
  const activeSectionPlanId =
    typeof candidate.activeSectionPlanId === 'string' &&
    sectionPlans.some((plan) => plan.planId === candidate.activeSectionPlanId)
      ? candidate.activeSectionPlanId
      : null;
  const zoom =
    typeof candidate.zoom === 'number' && Number.isFinite(candidate.zoom) && candidate.zoom > 0
      ? candidate.zoom
      : 1;
  const canvasWidth =
    typeof candidate.canvasWidth === 'number' &&
    Number.isFinite(candidate.canvasWidth) &&
    candidate.canvasWidth > 0
      ? candidate.canvasWidth
      : undefined;
  const canvasHeight =
    typeof candidate.canvasHeight === 'number' &&
    Number.isFinite(candidate.canvasHeight) &&
    candidate.canvasHeight > 0
      ? candidate.canvasHeight
      : undefined;

  return {
    floorId:
      typeof candidate.floorId === 'string' && candidate.floorId.trim()
        ? candidate.floorId
        : DEFAULT_FLOOR_MAP.floorId,
    mapVersion:
      typeof candidate.mapVersion === 'string' && candidate.mapVersion.trim()
        ? candidate.mapVersion
        : DEFAULT_FLOOR_MAP.mapVersion,
    rooms,
    tables,
    sectionPlans,
    activeSectionPlanId,
    zoom,
    canvasWidth,
    canvasHeight,
  };
}
