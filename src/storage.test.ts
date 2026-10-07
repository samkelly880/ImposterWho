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
      trollRules: {
        allImposters: true,
        noImposters: false,
        reverse: true,
        doubleAgent: true,
      },
    };
    saveSetup(setup, storage);
    expect(loadSetup(pack, storage)).toEqual(setup);
  });

  it("treats a missing doubleAgent key as off without discarding the rest of the save", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        names: ["Ada", "Bob", "Cara", ""],
        accordion: { players: false, categories: true, modes: true },
        enabledCategoryIds: ["food", "jobs"],
        autoImposters: false,
        imposterCount: 2,
        hintsEnabled: false,
        trollEnabled: true,
        trollRules: { allImposters: true, noImposters: false, reverse: true },
      }),
    });
    const loaded = loadSetup(pack, storage);
    expect(loaded.names).toEqual(["Ada", "Bob", "Cara", ""]);
    expect(loaded.trollEnabled).toBe(true);
    expect(loaded.hintsEnabled).toBe(false);
    expect(loaded.trollRules).toEqual({
      allImposters: true,
      noImposters: false,
      reverse: true,
      doubleAgent: false,
    });
  });

  it("falls back to defaults when doubleAgent is present but not a boolean", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        ...defaultSetup(pack),
        names: ["Ada", "Bob", "Cara", ""],
        trollRules: {
          allImposters: true,
          noImposters: true,
          reverse: true,
          doubleAgent: "yes",
        },
      }),
    });
    expect(loadSetup(pack, storage)).toEqual(defaultSetup(pack));
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
