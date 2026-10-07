import { describe, expect, it } from "./testkit.ts";
import { defaultSetup } from "./defaults.ts";
import { categoryIds, pack } from "./pack.ts";
import { loadSetup, memoryStorage, saveSetup } from "./storage.ts";
import { STORAGE_KEY } from "./types.ts";

const ORIGINAL_EIGHT = [
  "food",
  "animals",
  "places",
  "jobs",
  "sports",
  "movies",
  "household",
  "school",
];

function payload(enabledCategoryIds: string[]) {
  return {
    names: ["Ada", "Bob", "Cara", ""],
    accordion: { players: false, categories: true, modes: true },
    enabledCategoryIds,
    autoImposters: false,
    imposterCount: 2,
    hintsEnabled: false,
    trollEnabled: true,
    trollRules: { allImposters: true, noImposters: false, reverse: true },
  };
}

describe("setup persistence", () => {
  it("round-trips names, accordion, categories, auto, count, hints, troll, and last word", () => {
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
      lastWordEnabled: true,
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

  it("treats a missing lastWordEnabled key as off without discarding the rest of the save", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
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
          doubleAgent: false,
        },
      }),
    });
    const loaded = loadSetup(pack, storage);
    expect(loaded.names).toEqual(["Ada", "Bob", "Cara", ""]);
    expect(loaded.trollEnabled).toBe(true);
    expect(loaded.hintsEnabled).toBe(false);
    expect(loaded.lastWordEnabled).toBe(false);
    expect(loaded.imposterCount).toBe(2);
  });

  it("falls back to defaults when lastWordEnabled is present but not a boolean", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        ...defaultSetup(pack),
        names: ["Ada", "Bob", "Cara", ""],
        lastWordEnabled: "yes",
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

  it("enables all sixteen pack categories on a fresh default setup", () => {
    expect(defaultSetup(pack).enabledCategoryIds).toEqual(categoryIds(pack));
    expect(defaultSetup(pack).enabledCategoryIds).toHaveLength(16);
  });

  it("migrates a pre-expansion full save of the original eight to all pack categories", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify(payload(ORIGINAL_EIGHT)),
    });
    expect(loadSetup(pack, storage).enabledCategoryIds).toEqual(categoryIds(pack));
  });

  it("migrates the original eight even when saved in a different order", () => {
    const shuffled = [
      "school",
      "food",
      "movies",
      "animals",
      "household",
      "jobs",
      "places",
      "sports",
    ];
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify(payload(shuffled)),
    });
    expect(loadSetup(pack, storage).enabledCategoryIds).toEqual(categoryIds(pack));
  });

  it("leaves a subset of categories unchanged", () => {
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify(payload(["food", "jobs"])),
    });
    expect(loadSetup(pack, storage).enabledCategoryIds).toEqual(["food", "jobs"]);
  });

  it("does not re-enable new categories after a later save includes one", () => {
    const enabled = [...ORIGINAL_EIGHT, "music"];
    const storage = memoryStorage({
      [STORAGE_KEY]: JSON.stringify(payload(enabled)),
    });
    expect(loadSetup(pack, storage).enabledCategoryIds).toEqual(enabled);
  });
});
