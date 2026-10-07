import { describe, expect, it } from "../testkit.ts";
import { beginPointerHold, endPointerHold, isHoldKey } from "./hold-card.ts";

describe("hold-card pointers", () => {
  it("starts a hold on the primary pointer and ignores extras", () => {
    expect(beginPointerHold(null, 0, 7)).toBe(7);
    expect(beginPointerHold(7, 0, 8)).toBe(7);
    expect(beginPointerHold(null, 2, 7)).toBe(null);
  });

  it("ends only the matching pointer", () => {
    expect(endPointerHold(7, 8)).toBe(7);
    expect(endPointerHold(7, 7)).toBe(null);
    expect(endPointerHold(null, 7)).toBe(null);
  });
});

describe("hold-card keys", () => {
  it("treats Space and Enter as hold keys", () => {
    expect(isHoldKey(" ")).toBe(true);
    expect(isHoldKey("Enter")).toBe(true);
    expect(isHoldKey("Escape")).toBe(false);
  });
});
