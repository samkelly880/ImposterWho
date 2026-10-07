import { describe, expect, it } from "../testkit.ts";
import { fitLineElements, fittedFontSize } from "./fit-line.ts";

function linearMeasure(pxPerPx: number) {
  return (sizePx: number) => sizePx * pxPerPx;
}

describe("fittedFontSize", () => {
  it("returns the CSS max when the string already fits", () => {
    const size = fittedFontSize({
      maxPx: 48,
      minPx: 12,
      maxWidth: 400,
      measure: linearMeasure(4),
    });
    expect(size).toBe(48);
  });

  it("returns a size between min and max whose measure fits when max overflows", () => {
    const measure = linearMeasure(8);
    const maxWidth = 160;
    const size = fittedFontSize({
      maxPx: 40,
      minPx: 8,
      maxWidth,
      measure,
    });
    expect(size > 8).toBe(true);
    expect(size < 40).toBe(true);
    expect(measure(size) <= maxWidth).toBe(true);
    expect(Math.abs(size - 20) < 0.05).toBe(true);
  });

  it("picks the largest size that still fits", () => {
    const measure = (sizePx: number) => (sizePx <= 18 ? 90 : 200);
    const size = fittedFontSize({
      maxPx: 32,
      minPx: 10,
      maxWidth: 100,
      measure,
    });
    expect(size > 17.5).toBe(true);
    expect(size <= 18).toBe(true);
    expect(measure(size) <= 100).toBe(true);
  });

  it("returns the floor when even minPx overflows", () => {
    const size = fittedFontSize({
      maxPx: 40,
      minPx: 12,
      maxWidth: 50,
      measure: () => 400,
    });
    expect(size).toBe(12);
  });

  it("returns max and does not measure when maxWidth is 0", () => {
    let calls = 0;
    const size = fittedFontSize({
      maxPx: 36,
      minPx: 12,
      maxWidth: 0,
      measure: () => {
        calls += 1;
        return 999;
      },
    });
    expect(size).toBe(36);
    expect(calls).toBe(0);
  });

  it("returns max and does not measure when maxWidth is negative", () => {
    let calls = 0;
    const size = fittedFontSize({
      maxPx: 36,
      minPx: 12,
      maxWidth: -10,
      measure: () => {
        calls += 1;
        return 999;
      },
    });
    expect(size).toBe(36);
    expect(calls).toBe(0);
  });

  it("does not grow when the CSS max is already at or below the floor", () => {
    expect(
      fittedFontSize({
        maxPx: 12,
        minPx: 12,
        maxWidth: 10,
        measure: () => 80,
      }),
    ).toBe(12);
    expect(
      fittedFontSize({
        maxPx: 10,
        minPx: 12,
        maxWidth: 10,
        measure: () => 80,
      }),
    ).toBe(10);
  });
});

describe("fitLineElements", () => {
  it("no-ops on paint mock roots without throwing", () => {
    fitLineElements({
      innerHTML: "",
      contains() {
        return false;
      },
      querySelector() {
        return null;
      },
    });
    fitLineElements(null);
    fitLineElements(undefined);
  });
});
