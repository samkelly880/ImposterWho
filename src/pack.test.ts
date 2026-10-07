import { defaultSetup } from "./defaults.ts";
import { describe, expect, it } from "./testkit.ts";
import { categoryById, pack, wordEntry } from "./pack.ts";
import { dealRound } from "./round.ts";
import type { SetupState } from "./types.ts";

// Audience bar for future pack edits (not encoded as assertions):
// - Hints must be familiar to NZ early teens (heard in normal life, not specialist hobby jargon).
// - A hint should be sayable as a clue and must not uniquely identify the word.
// - Proper nouns and short phrases are allowed.
// - US/media terms are fine; do not force kiwi slang.
// - Further hint changes come from playtest flags, not a wholesale rewrite.

function norm(value: string): string {
  return value.trim().toLowerCase();
}

describe("word pack", () => {
  it("has eight family-friendly categories of 16 words with 2 hints", () => {
    expect(pack.categories).toHaveLength(8);
    expect(pack.categories.map((c) => c.id)).toEqual([
      "food",
      "animals",
      "places",
      "jobs",
      "sports",
      "movies",
      "household",
      "school",
    ]);
    for (const category of pack.categories) {
      expect(category.words).toHaveLength(16);
      const words = category.words.map((w) => w.word.toLowerCase());
      expect(new Set(words).size).toBe(16);
      for (const entry of category.words) {
        expect(entry.hints).toHaveLength(2);
        for (const hint of entry.hints) {
          expect(hint.trim().length).toBeGreaterThan(0);
          expect(hint.toLowerCase()).not.toBe(entry.word.toLowerCase());
        }
      }
    }
  });

  it("keeps hints mechanically distinct from each other and from secrets in the same category", () => {
    for (const category of pack.categories) {
      const secrets = new Set(category.words.map((entry) => norm(entry.word)));
      const hintPairs = new Set<string>();

      for (const entry of category.words) {
        expect(entry.hints).toHaveLength(2);
        const [first, second] = entry.hints.map(norm);
        expect(first.length).toBeGreaterThan(0);
        expect(second.length).toBeGreaterThan(0);
        expect(first).not.toBe(second);
        expect(secrets.has(first)).toBe(false);
        expect(secrets.has(second)).toBe(false);

        const pairKey = [first, second].sort().join("\0");
        expect(hintPairs.has(pairKey)).toBe(false);
        hintPairs.add(pairKey);
      }
    }
  });

  it("applies the closed IW-3 hint replacements and Sofa → Couch rename", () => {
    const expected = [
      ["food", "Popcorn", ["Movies", "Salty"]],
      ["food", "Salad", ["Greens", "Fresh"]],
      ["animals", "Dolphin", ["Echolocation", "Ocean"]],
      ["school", "Pencil", ["Sharpen", "Eraser"]],
      ["school", "Locker", ["Storage", "Hallway"]],
      ["school", "Bell", ["Ring", "Breaktime"]],
      ["household", "Curtains", ["Window", "Shutter"]],
      ["household", "Microwave", ["Defrost", "Heat"]],
      ["household", "Dishwasher", ["Plates", "Wash"]],
      ["household", "Lamp", ["Light", "Bulb"]],
      ["household", "Couch", ["Cushion", "Lounge"]],
      ["movies", "Star Wars", ["Spaceship", "Force"]],
      ["movies", "Superman", ["Cape", "Flight"]],
      ["sports", "Hockey", ["Turf", "Stick"]],
      ["sports", "Baseball", ["Bat", "Catch"]],
      ["jobs", "Librarian", ["Books", "Silence"]],
      ["jobs", "Nurse", ["Patient", "Hospital"]],
      ["jobs", "Judge", ["Court", "Verdict"]],
      ["jobs", "Dentist", ["Scary", "Filling"]],
      ["jobs", "Doctor", ["Clinic", "Hospital"]],
    ] as const;

    for (const [categoryId, word, hints] of expected) {
      const category = categoryById(categoryId);
      expect(wordEntry(category, word).hints).toEqual([...hints]);
    }

    const householdWords = categoryById("household").words.map((entry) => entry.word);
    expect(householdWords).toContain("Couch");
    expect(householdWords).not.toContain("Sofa");
  });

  it("still deals Baseball imposters a Bat or Catch hint from the pack", () => {
    const sports = categoryById("sports");
    const used = sports.words.map((entry) => entry.word).filter((word) => word !== "Baseball");
    const setup: SetupState = {
      ...defaultSetup(pack),
      names: ["Ada", "Bob", "Cara"],
      enabledCategoryIds: ["sports"],
      imposterCount: 1,
      autoImposters: false,
      hintsEnabled: true,
      trollEnabled: false,
    };
    const { round } = dealRound({
      setup,
      pack,
      deck: { usedByCategory: { sports: used }, lastEnabledKey: "sports" },
      random: () => 0,
    });
    expect(round.secretWord).toBe("Baseball");
    const imposters = round.assignments.filter((assignment) => assignment.role === "imposter");
    expect(imposters.length).toBeGreaterThan(0);
    for (const assignment of imposters) {
      expect(["Bat", "Catch"]).toContain(assignment.hint);
    }
  });
});
