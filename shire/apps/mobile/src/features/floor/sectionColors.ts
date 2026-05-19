const SECTION_PALETTE = [
  '#2F7D6D',
  '#C26A4A',
  '#5B6FAE',
  '#9B6A2F',
  '#7A5AA6',
  '#3B7EA1',
  '#B05F7A',
  '#5F8A42',
];

function hashSection(section: string): number {
  let hash = 0;
  for (let index = 0; index < section.length; index += 1) {
    hash = (hash * 31 + section.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function normalizeSectionName(section: string): string {
  return section.trim().replace(/\s+/g, ' ');
}

export function getSectionColor(section: string | null | undefined): string | undefined {
  const normalized = normalizeSectionName(section ?? '');
  if (!normalized) return undefined;
  return SECTION_PALETTE[hashSection(normalized.toLocaleLowerCase()) % SECTION_PALETTE.length];
}

export function sectionColorWithAlpha(color: string, alpha: number): string {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) return color;

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
