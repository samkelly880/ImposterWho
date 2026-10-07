import { describe, expect, it } from "./testkit.ts";
import { SKINS, skinForSlot } from "./skins.ts";

describe("player skins", () => {
  it("assigns a unique color+pattern to the first ten slots", () => {
    const firstTen = SKINS.slice(0, 10);
    expect(firstTen.map((s) => s.color)).toEqual([
      "blue",
      "green",
      "red",
      "purple",
      "pink",
      "brown",
      "white",
      "orange",
      "yellow",
      "grey",
    ]);
    const signatures = firstTen.map((s) => `${s.color}:${s.pattern}`);
    expect(new Set(signatures).size).toBe(10);
    expect(firstTen.every((s) => s.color !== "black")).toBe(true);
  });

  it("reuses two colors on slots 11–12 with different patterns", () => {
    const eleven = skinForSlot(10);
    const twelve = skinForSlot(11);
    expect(eleven.color).toBe("blue");
    expect(twelve.color).toBe("green");
    expect(eleven.pattern).not.toBe(skinForSlot(0).pattern);
    expect(twelve.pattern).not.toBe(skinForSlot(1).pattern);
  });

  it("uses dark ink on light cards including white and yellow", () => {
    expect(skinForSlot(6).ink).toBe("black");
    expect(skinForSlot(8).ink).toBe("black");
  });
});
