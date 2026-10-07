import { defaultSetup } from "./defaults.ts";
import { syncImposterCount } from "./imposters.ts";
import { categoryIds } from "./pack.ts";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  STORAGE_KEY,
  TROLL_RULES,
  type AccordionState,
  type SetupState,
  type TrollRules,
  type WordPack,
} from "./types.ts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseNames(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length < MIN_PLAYERS || value.length > MAX_PLAYERS) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  return value.map((item) => item);
}

function parseAccordion(value: unknown): AccordionState | null {
  if (!isRecord(value)) return null;
  if (typeof value.players !== "boolean") return null;
  if (typeof value.categories !== "boolean") return null;
  if (typeof value.modes !== "boolean") return null;
  return {
    players: value.players,
    categories: value.categories,
    modes: value.modes,
  };
}

function parseEnabledCategories(value: unknown, pack: WordPack): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every((item) => typeof item === "string")) return null;
  const known = new Set(categoryIds(pack));
  return value.filter((id) => known.has(id));
}

function parseTrollRules(value: unknown): TrollRules | null {
  if (!isRecord(value)) return null;
  const rules: TrollRules = {
    allImposters: true,
    noImposters: true,
    reverse: true,
    doubleAgent: false,
  };
  for (const id of TROLL_RULES) {
    if (id === "doubleAgent") {
      if (!(id in value)) continue;
      if (typeof value[id] !== "boolean") return null;
      rules[id] = value[id];
      continue;
    }
    if (typeof value[id] !== "boolean") return null;
    rules[id] = value[id];
  }
  return rules;
}

export function parseSetup(raw: string | null, pack: WordPack): SetupState {
  const fallback = defaultSetup(pack);
  if (!raw) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return fallback;
    const names = parseNames(parsed.names);
    const accordion = parseAccordion(parsed.accordion);
    const enabledCategoryIds = parseEnabledCategories(parsed.enabledCategoryIds, pack);
    const trollRules = parseTrollRules(parsed.trollRules);
    if (!names || !accordion || !enabledCategoryIds || !trollRules) return fallback;
    if (typeof parsed.autoImposters !== "boolean") return fallback;
    if (typeof parsed.imposterCount !== "number" || !Number.isFinite(parsed.imposterCount)) {
      return fallback;
    }
    if (typeof parsed.hintsEnabled !== "boolean") return fallback;
    if (typeof parsed.trollEnabled !== "boolean") return fallback;
    if ("lastWordEnabled" in parsed && typeof parsed.lastWordEnabled !== "boolean") {
      return fallback;
    }
    const lastWordEnabled =
      typeof parsed.lastWordEnabled === "boolean" ? parsed.lastWordEnabled : false;
    return syncImposterCount({
      names,
      accordion,
      enabledCategoryIds,
      autoImposters: parsed.autoImposters,
      imposterCount: parsed.imposterCount,
      hintsEnabled: parsed.hintsEnabled,
      trollEnabled: parsed.trollEnabled,
      trollRules,
      lastWordEnabled,
    });
  } catch {
    return fallback;
  }
}

export function loadSetup(pack: WordPack, storage: Storage = localStorage): SetupState {
  try {
    return parseSetup(storage.getItem(STORAGE_KEY), pack);
  } catch {
    return defaultSetup(pack);
  }
}

export function saveSetup(setup: SetupState, storage: Storage = localStorage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(setup));
}

export function memoryStorage(initial?: Record<string, string>): Storage {
  const map = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}
