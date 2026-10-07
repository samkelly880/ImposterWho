import {
  DEFAULT_PLAYER_SLOTS,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_NAME_LENGTH,
  MIN_PLAYERS,
} from "./types.ts";

export function trimName(value: string): string {
  return value.trim();
}

export function activeNames(names: string[]): string[] {
  return names.map(trimName).filter((name) => name.length > 0);
}

export function effectivePlayerCount(names: string[]): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, activeNames(names).length));
}

export function nameKey(value: string): string {
  return trimName(value).toLowerCase();
}

export function duplicateKeys(names: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const name of activeNames(names)) {
    const key = nameKey(name);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dups = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) dups.add(key);
  }
  return dups;
}

export function isValidName(value: string): boolean {
  const trimmed = trimName(value);
  return trimmed.length >= MIN_NAME_LENGTH && trimmed.length <= MAX_NAME_LENGTH;
}

export function emptyNameSlots(count = DEFAULT_PLAYER_SLOTS): string[] {
  return Array.from({ length: count }, () => "");
}
