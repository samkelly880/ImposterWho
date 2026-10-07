import raw from "./data/words.json" with { type: "json" };
import type { Category, WordEntry, WordPack } from "./types.ts";

export const pack: WordPack = raw;

export function categoryById(id: string, wordPack: WordPack = pack): Category {
  const found = wordPack.categories.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown category: ${id}`);
  }
  return found;
}

export function wordEntry(category: Category, word: string): WordEntry {
  const found = category.words.find((w) => w.word === word);
  if (!found) {
    throw new Error(`Unknown word "${word}" in ${category.id}`);
  }
  return found;
}

export function allHintsInCategory(category: Category): string[] {
  return category.words.flatMap((w) => w.hints);
}

export function categoryIds(wordPack: WordPack = pack): string[] {
  return wordPack.categories.map((c) => c.id);
}
