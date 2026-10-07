export type HoldPointer = number | null;

export function isHoldKey(key: string): boolean {
  return key === " " || key === "Enter";
}

export function beginPointerHold(
  held: HoldPointer,
  button: number,
  pointerId: number,
): HoldPointer {
  if (held !== null) return held;
  if (button !== 0) return held;
  return pointerId;
}

export function endPointerHold(held: HoldPointer, pointerId: number): HoldPointer {
  if (held === null || held !== pointerId) return held;
  return null;
}

export function isFlipActionTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-action="flip"]'));
}
