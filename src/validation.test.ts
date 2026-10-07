import { describe, expect, it } from "./testkit.ts";
import { defaultSetup } from "./defaults.ts";
import { bumpImposterCount, setAutoImposters, syncImposterCount } from "./imposters.ts";
import { pack } from "./pack.ts";
import { startReady, validateSetup } from "./validation.ts";
import type { SetupState } from "./types.ts";

function setupWith(names: string[], extra: Partial<SetupState> = {}): SetupState {
  return { ...defaultSetup(pack), names, ...extra };
}

describe("start validation", () => {
  it("rejects fewer than 3 names", () => {
    const setup = setupWith(["Ada", "Bob", "", ""]);
    expect(startReady(setup)).toBe(false);
    expect(validateSetup(setup).uniqueNameCount).toBe(2);
  });

  it("rejects duplicate names case-insensitively", () => {
    const setup = setupWith(["Ada", "ada", "Cara"]);
    const result = validateSetup(setup);
    expect(result.canStart).toBe(false);
    expect(result.nameErrors[0]).toBe("duplicate");
    expect(result.nameErrors[1]).toBe("duplicate");
    expect(result.nameErrors[2]).toBe(null);
  });

  it("rejects zero enabled categories", () => {
    const setup = setupWith(["Ada", "Bob", "Cara"], { enabledCategoryIds: [] });
    const result = validateSetup(setup);
    expect(result.canStart).toBe(false);
    expect(result.categoryError).toBe("none");
  });

  it("accepts 3 unique names and at least one category", () => {
    const setup = setupWith(["Ada", "Bob", "Cara"], {
      enabledCategoryIds: ["food"],
    });
    expect(startReady(setup)).toBe(true);
  });

  it("trims whitespace before uniqueness and length checks", () => {
    const setup = setupWith(["  Ada  ", "Bob", "Cara"]);
    expect(startReady(setup)).toBe(true);
  });

  it("rejects a name longer than 16 characters", () => {
    const setup = setupWith(["Ada", "Bob", "CaraWithALongNameX"]);
    const result = validateSetup(setup);
    expect(result.canStart).toBe(false);
    expect(result.nameErrors[2]).toBe("length");
  });

  it("ignores empty extra slots when 3 valid names exist", () => {
    const setup = setupWith(["Ada", "Bob", "Cara", ""]);
    expect(startReady(setup)).toBe(true);
    expect(validateSetup(setup).nameErrors[3]).toBe("empty");
  });
});

describe("auto imposter bands", () => {
  it("uses 1 for 3–6 players", () => {
    for (const n of [3, 4, 5, 6]) {
      const names = Array.from({ length: n }, (_, i) => `P${i}`);
      const setup = syncImposterCount(setupWith(names, { autoImposters: true }));
      expect(setup.imposterCount).toBe(1);
    }
  });

  it("uses 2 for 7–9 players", () => {
    for (const n of [7, 8, 9]) {
      const names = Array.from({ length: n }, (_, i) => `P${i}`);
      const setup = syncImposterCount(setupWith(names, { autoImposters: true }));
      expect(setup.imposterCount).toBe(2);
    }
  });

  it("uses 3 for 10–12 players", () => {
    for (const n of [10, 11, 12]) {
      const names = Array.from({ length: n }, (_, i) => `P${i}`);
      const setup = syncImposterCount(setupWith(names, { autoImposters: true }));
      expect(setup.imposterCount).toBe(3);
    }
  });

  it("turns Auto off when the stepper is edited and keeps the manual value", () => {
    const names = ["A", "B", "C", "D", "E", "F", "G"];
    let setup = syncImposterCount(setupWith(names, { autoImposters: true }));
    expect(setup.imposterCount).toBe(2);
    setup = bumpImposterCount(setup, 1);
    expect(setup.autoImposters).toBe(false);
    expect(setup.imposterCount).toBe(3);
    setup = syncImposterCount(setup);
    expect(setup.autoImposters).toBe(false);
    expect(setup.imposterCount).toBe(3);
  });

  it("reapplies the band when Auto is turned back on", () => {
    const names = ["A", "B", "C", "D"];
    let setup = setupWith(names, { autoImposters: false, imposterCount: 3 });
    setup = setAutoImposters(setup, true);
    expect(setup.autoImposters).toBe(true);
    expect(setup.imposterCount).toBe(1);
  });

  it("clamps a manual count to 1 … n−1 when player count changes", () => {
    let setup = setupWith(["A", "B", "C", "D", "E"], {
      autoImposters: false,
      imposterCount: 4,
    });
    setup = syncImposterCount(setup);
    expect(setup.imposterCount).toBe(4);
    setup = { ...setup, names: ["A", "B", "C"] };
    setup = syncImposterCount(setup);
    expect(setup.imposterCount).toBe(2);
  });

  it("never allows 0 imposters or all-imposter via the stepper", () => {
    const names = ["A", "B", "C"];
    let setup = setupWith(names, { autoImposters: false, imposterCount: 1 });
    setup = bumpImposterCount(setup, -1);
    expect(setup.imposterCount).toBe(1);
    setup = bumpImposterCount(setup, 5);
    expect(setup.imposterCount).toBe(2);
  });
});
