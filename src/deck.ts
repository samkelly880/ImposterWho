import { categoryById } from "./pack.ts";
import { pickOne } from "./rng.ts";
import type { DeckState, WordPack } from "./types.ts";
import type { Random } from "./rng.ts";

export function emptyDeck(): DeckState {
  return { usedByCategory: {}, lastEnabledKey: "" };
}

export function enabledKey(enabledCategoryIds: readonly string[]): string {
  return [...enabledCategoryIds].sort().join("|");
}

export function deckForCategories(
  deck: DeckState,
  enabledCategoryIds: readonly string[],
): DeckState {
  const key = enabledKey(enabledCategoryIds);
  if (deck.lastEnabledKey !== key) {
    return { usedByCategory: {}, lastEnabledKey: key };
  }
  return deck;
}

export function pickSecretWord(
  categoryId: string,
  deck: DeckState,
  pack: WordPack,
  random: Random,
): { word: string; deck: DeckState } {
  const category = categoryById(categoryId, pack);
  const words = category.words.map((w) => w.word);
  const used = new Set(deck.usedByCategory[categoryId] ?? []);
  let available = words.filter((word) => !used.has(word));
  const nextUsed = new Set(used);
  if (available.length === 0) {
    available = [...words];
    nextUsed.clear();
  }
  const word = pickOne(available, random);
  nextUsed.add(word);
  return {
    word,
    deck: {
      ...deck,
      usedByCategory: {
        ...deck.usedByCategory,
        [categoryId]: [...nextUsed],
      },
    },
  };
}
