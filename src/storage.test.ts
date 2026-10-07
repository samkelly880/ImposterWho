import { describe, expect, it } from "./testkit.ts";
import { defaultSetup } from "./defaults.ts";
import { pack } from "./pack.ts";
import { loadSetup, memoryStorage, saveSetup } from "./storage.ts";
import { STORAGE_KEY } from "./types.ts";

describe("setup persistence", () => {
  it("round-trips names, accordion, categories, auto, count, hints, and troll", () => {
    const storage = memoryStorage();
    const setup = {
      ...defaultSetup(pack),
      names: ["Ada", "Bob", "Cara", ""],
      accordion: { players: false, categories: true, modes: true },
      enabledCategoryIds: ["food", "jobs"],
      autoImposters: false,
      imposterCount: 2,
      hintsEnabled: false,
      trollEnabled: true,
      trollRules: { allImposters: true, noImposters: false, reverse: true },
    };
    saveSetup(setup, storage);
    expect(loadSetup(pack, storage)).toEqual(setup);
  });

  it("returns defaults for missing or corrupt payloads", () => {
    expect(loadSetup(pack, memoryStorage())).toEqual(defaultSetup(pack));
    expect(loadSetup(pack, memoryStorage({ [STORAGE_KEY]: "{not json" }))).toEqual(
      defaultSetup(pack),
    );
    expect(loadSetup(pack, memoryStorage({ [STORAGE_KEY]: "null" }))).toEqual(
      defaultSetup(pack),
    );
  });

  it("does not persist a used-word deck", () => {
    const storage = memoryStorage();
    saveSetup(defaultSetup(pack), storage);
    expect(storage.getItem(STORAGE_KEY)).not.toContain("usedByCategory");
  });
});
