import { effectivePlayerCount } from "./names.ts";
import type { SetupState } from "./types.ts";

export function autoImposterCount(playerCount: number): number {
  if (playerCount <= 6) return 1;
  if (playerCount <= 9) return 2;
  return 3;
}

export function clampImposterCount(count: number, playerCount: number): number {
  const max = Math.max(1, playerCount - 1);
  return Math.min(max, Math.max(1, count));
}

export function syncImposterCount(setup: SetupState): SetupState {
  const n = effectivePlayerCount(setup.names);
  if (setup.autoImposters) {
    return { ...setup, imposterCount: autoImposterCount(n) };
  }
  return { ...setup, imposterCount: clampImposterCount(setup.imposterCount, n) };
}

export function setAutoImposters(setup: SetupState, on: boolean): SetupState {
  return syncImposterCount({ ...setup, autoImposters: on });
}

export function bumpImposterCount(setup: SetupState, delta: number): SetupState {
  const n = effectivePlayerCount(setup.names);
  const next = clampImposterCount(setup.imposterCount + delta, n);
  return { ...setup, autoImposters: false, imposterCount: next };
}
