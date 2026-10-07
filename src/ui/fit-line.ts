export const FIT_LINE_MIN_REM = 0.75;

export type FittedFontSizeArgs = {
  maxPx: number;
  minPx: number;
  maxWidth: number;
  measure: (sizePx: number) => number;
};

export function fittedFontSize({ maxPx, minPx, maxWidth, measure }: FittedFontSizeArgs): number {
  if (!(maxWidth > 0)) return maxPx;
  if (!(maxPx > minPx)) return maxPx;
  if (measure(maxPx) <= maxWidth) return maxPx;
  if (measure(minPx) > maxWidth) return minPx;

  let lo = minPx;
  let hi = maxPx;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (measure(mid) <= maxWidth) lo = mid;
    else hi = mid;
  }
  return lo;
}

function isElement(value: unknown): value is HTMLElement {
  return typeof HTMLElement !== "undefined" && value instanceof HTMLElement;
}

function contentBoxWidth(el: HTMLElement): number {
  const style = getComputedStyle(el);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  return el.clientWidth - paddingLeft - paddingRight;
}

function containingBox(el: HTMLElement): HTMLElement {
  const face = el.closest(".card-face");
  if (isElement(face) && contentBoxWidth(face) > 0) return face;
  const parent = el.parentElement;
  if (parent) return parent;
  return el;
}

function minFontPx(): number {
  const rootSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  return FIT_LINE_MIN_REM * rootSize;
}

function createMeasureProbe(el: HTMLElement): HTMLSpanElement {
  const style = getComputedStyle(el);
  const probe = document.createElement("span");
  probe.textContent = el.textContent;
  probe.style.position = "absolute";
  probe.style.left = "-9999px";
  probe.style.top = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  probe.style.whiteSpace = "nowrap";
  probe.style.transform = "none";
  probe.style.width = "auto";
  probe.style.maxWidth = "none";
  probe.style.margin = "0";
  probe.style.padding = "0";
  probe.style.fontFamily = style.fontFamily;
  probe.style.fontWeight = style.fontWeight;
  probe.style.fontStyle = style.fontStyle;
  probe.style.letterSpacing = style.letterSpacing;
  probe.style.fontSize = style.fontSize;
  document.body.appendChild(probe);
  return probe;
}

function fitOne(el: HTMLElement, minPx: number): void {
  el.style.removeProperty("font-size");
  const maxPx = Number.parseFloat(getComputedStyle(el).fontSize);
  if (!Number.isFinite(maxPx) || maxPx <= 0) return;

  const boxWidth = contentBoxWidth(containingBox(el));
  if (!(boxWidth > 0) || !document.body) return;
  const maxWidth = boxWidth > 1 ? boxWidth - 1 : boxWidth;

  const probe = createMeasureProbe(el);
  try {
    const measure = (sizePx: number): number => {
      probe.style.fontSize = `${sizePx}px`;
      return probe.scrollWidth;
    };
    const fitted = fittedFontSize({ maxPx, minPx, maxWidth, measure });
    if (fitted < maxPx - 0.01) el.style.fontSize = `${fitted}px`;
  } finally {
    probe.remove();
  }
}

export function fitLineElements(root: unknown): void {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") return;
  if (typeof root !== "object" || root === null) return;
  const query = (root as ParentNode).querySelectorAll;
  if (typeof query !== "function") return;

  const minPx = minFontPx();
  const nodes = query.call(root, ".fit-line");
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (isElement(el)) fitOne(el, minPx);
  }
}
