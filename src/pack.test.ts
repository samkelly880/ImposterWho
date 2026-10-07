import { describe, expect, it } from "./testkit.ts";
import { pack } from "./pack.ts";

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
});
