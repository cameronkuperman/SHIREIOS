import type { FloorMap, FloorMapSectionPlan } from '@shire/shared';
import { normalizeSectionName } from './sectionColors';

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function nextPlanId(waiterCount: number): string {
  return `section-plan-${waiterCount}-${Date.now().toString(36)}`;
}

export function buildSectionPlanFromFloorMap(
  floorMap: FloorMap,
  input: {
    planId?: string;
    name: string;
    waiterCount: number;
    isDefault?: boolean;
  },
): FloorMapSectionPlan {
  const groups = new Map<string, string[]>();
  for (const table of Object.values(floorMap.tables)) {
    const section = normalizeSectionName(table.section);
    if (!section) continue;
    groups.set(section, [...(groups.get(section) ?? []), table.tableId]);
  }

  const sections = [...groups.entries()]
    .map(([sectionId, tableIds]) => ({
      sectionId,
      tableIds: dedupe(tableIds).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    }))
    .sort((left, right) =>
      left.sectionId.localeCompare(right.sectionId, undefined, { numeric: true }),
    );

  for (let index = sections.length + 1; index <= input.waiterCount; index += 1) {
    sections.push({ sectionId: `Section ${index}`, tableIds: [] });
  }

  const now = new Date().toISOString();
  return {
    planId: input.planId ?? nextPlanId(input.waiterCount),
    name: input.name.trim() || `${input.waiterCount} Waiters`,
    waiterCount: Math.max(1, Math.round(input.waiterCount)),
    sections,
    isDefault: input.isDefault,
    updatedAt: now,
    createdAt: now,
  };
}

export function buildSectionPlanFromCurrentSections(
  floorMap: FloorMap,
  input: {
    name: string;
    waiterCount: number;
    isDefault?: boolean;
  },
): FloorMapSectionPlan {
  const groups = new Map<string, string[]>();
  for (const table of Object.values(floorMap.tables)) {
    const section = normalizeSectionName(table.section);
    if (!section) continue;
    groups.set(section, [...(groups.get(section) ?? []), table.tableId]);
  }

  const sections = [...groups.entries()]
    .map(([sectionId, tableIds]) => ({
      sectionId,
      tableIds: dedupe(tableIds).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    }))
    .sort((left, right) =>
      left.sectionId.localeCompare(right.sectionId, undefined, { numeric: true }),
    );

  const now = new Date().toISOString();
  const waiterCount = Math.max(1, Math.round(input.waiterCount));
  return {
    planId: nextPlanId(waiterCount),
    name: input.name.trim() || `${waiterCount} Waiters`,
    waiterCount,
    sections,
    isDefault: input.isDefault,
    updatedAt: now,
    createdAt: now,
  };
}

export function applySectionPlanToFloorMap(
  floorMap: FloorMap,
  plan: FloorMapSectionPlan,
): FloorMap {
  const tableSections = new Map<string, string>();
  for (const section of plan.sections) {
    const sectionId = normalizeSectionName(section.sectionId);
    if (!sectionId) continue;
    for (const tableId of section.tableIds) {
      tableSections.set(tableId, sectionId);
    }
  }

  const tables = Object.fromEntries(
    Object.entries(floorMap.tables).map(([tableId, table]) => [
      tableId,
      {
        ...table,
        section: tableSections.get(tableId) ?? '',
      },
    ]),
  );

  return {
    ...floorMap,
    tables,
    activeSectionPlanId: plan.planId,
  };
}

export function sectionNamesForPlan(plan: FloorMapSectionPlan | null | undefined): string[] {
  return (
    plan?.sections
      .map((section) => normalizeSectionName(section.sectionId))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) ?? []
  );
}
