import { describe, expect, it } from "./testkit.ts";
import { defaultSetup } from "./defaults.ts";
import { emptyDeck, pickSecretWord } from "./deck.ts";
import { allHintsInCategory, categoryById, pack, wordEntry } from "./pack.ts";
import { createQueueRandom } from "./rng.ts";
import {
  afterCardTap,
  armedTrollRules,
  assignRoles,
  canPressNext,
  dealRound,
  isTrollArmed,
  pickStarterIndex,
  resetFlip,
  rollTroll,
  starterWeights,
  trollRecapLine,
} from "./round.ts";
import type { SetupState, TrollRuleId } from "./types.ts";

function namedSetup(names: string[], extra: Partial<SetupState> = {}): SetupState {
  return {
    ...defaultSetup(pack),
    names,
    enabledCategoryIds: ["food"],
    imposterCount: 1,
    autoImposters: false,
    hintsEnabled: true,
    trollEnabled: false,
    ...extra,
  };
}

describe("troll roll", () => {
  it("treats troll-on with no sub-rules as unarmed (never chaos)", () => {
    const rules = { allImposters: false, noImposters: false, reverse: false };
    expect(isTrollArmed(true, rules)).toBe(false);
    expect(armedTrollRules(true, rules)).toEqual([]);
    expect(rollTroll(true, rules, () => 0)).toBe(null);
  });

  it("does not fire when the roll is 10% or higher", () => {
    const rules = { allImposters: true, noImposters: true, reverse: true };
    expect(rollTroll(true, rules, createQueueRandom([0.1]))).toBe(null);
  });

  it("fires at 10% and picks one enabled rule uniformly", () => {
    const rules = { allImposters: true, noImposters: false, reverse: true };
    expect(rollTroll(true, rules, createQueueRandom([0.099, 0]))).toBe("allImposters");
    expect(rollTroll(true, rules, createQueueRandom([0, 0.5]))).toBe("reverse");
  });

  it("never rolls when troll is off even if sub-rules are checked", () => {
    const rules = { allImposters: true, noImposters: true, reverse: true };
    expect(rollTroll(false, rules, () => 0)).toBe(null);
  });
});

describe("role assignment", () => {
  it("normal rounds deal the exact imposter count", () => {
    const roles = assignRoles(5, 2, null, () => 0.99);
    expect(roles.filter((r) => r === "imposter")).toHaveLength(2);
    expect(roles.filter((r) => r === "civilian")).toHaveLength(3);
  });

  it("All Imposters makes everyone an imposter", () => {
    const roles = assignRoles(4, 1, "allImposters", () => 0);
    expect(roles).toEqual(["imposter", "imposter", "imposter", "imposter"]);
  });

  it("No Imposters makes everyone a civilian", () => {
    const roles = assignRoles(4, 1, "noImposters", () => 0);
    expect(roles).toEqual(["civilian", "civilian", "civilian", "civilian"]);
  });

  it("Reverse leaves exactly one civilian", () => {
    const roles = assignRoles(5, 1, "reverse", () => 0.5);
    expect(roles.filter((r) => r === "civilian")).toHaveLength(1);
    expect(roles.filter((r) => r === "imposter")).toHaveLength(4);
  });
});

describe("dealRound", () => {
  it("gives civilians one shared secret word and imposters hints from that word", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara", "Dee"], { imposterCount: 1 });
    const { round, deck } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    const civilians = round.assignments.filter((a) => a.role === "civilian");
    const imposters = round.assignments.filter((a) => a.role === "imposter");
    expect(imposters).toHaveLength(1);
    expect(civilians).toHaveLength(3);
    expect(round.secretWord).toBeTruthy();
    expect(round.trollRule).toBe(null);
    for (const civilian of civilians) {
      expect(civilian.hint).toBe(null);
    }
    const food = categoryById("food", pack);
    const entry = wordEntry(food, round.secretWord!);
    expect(entry.hints).toContain(imposters[0]!.hint);
    expect(deck.usedByCategory.food).toEqual([round.secretWord]);
  });

  it("omits the hint when hints are off", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara"], { hintsEnabled: false });
    const { round } = dealRound({ setup, pack, deck: emptyDeck(), random: () => 0 });
    for (const assignment of round.assignments) {
      expect(assignment.hint).toBe(null);
    }
  });

  it("All Imposters has no secret word, does not consume the deck, and uses in-category hints", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara"], {
      trollEnabled: true,
      trollRules: { allImposters: true, noImposters: false, reverse: false },
    });
    const { round, deck } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(round.trollRule).toBe("allImposters");
    expect(round.secretWord).toBe(null);
    expect(round.assignments.every((a) => a.role === "imposter")).toBe(true);
    expect(deck.usedByCategory.food).toBeUndefined();
    const pool = allHintsInCategory(categoryById("food", pack));
    for (const assignment of round.assignments) {
      expect(assignment.hint).not.toBeNull();
      expect(pool).toContain(assignment.hint);
    }
  });

  it("Reverse imposters get in-category hints that may come from other words", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara"], {
      trollEnabled: true,
      trollRules: { allImposters: false, noImposters: false, reverse: true },
    });
    const { round } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(round.trollRule).toBe("reverse");
    expect(round.assignments.filter((a) => a.role === "civilian")).toHaveLength(1);
    expect(round.secretWord).toBeTruthy();
    const food = categoryById("food", pack);
    const secretHints = new Set(wordEntry(food, round.secretWord!).hints);
    const pool = allHintsInCategory(food);
    const imposterHints = round.assignments
      .filter((a) => a.role === "imposter")
      .map((a) => a.hint);
    for (const hint of imposterHints) {
      expect(hint).not.toBeNull();
      expect(pool).toContain(hint);
    }
    expect(secretHints.size).toBeGreaterThan(0);
  });

  it("No Imposters shares a secret word with zero imposters", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara"], {
      trollEnabled: true,
      trollRules: { allImposters: false, noImposters: true, reverse: false },
    });
    const { round, deck } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(round.trollRule).toBe("noImposters");
    expect(round.assignments.every((a) => a.role === "civilian")).toBe(true);
    expect(round.secretWord).toBeTruthy();
    expect(deck.usedByCategory.food).toEqual([round.secretWord]);
  });

  it("does not fire troll when troll is on but no sub-rule is checked", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara"], {
      trollEnabled: true,
      trollRules: { allImposters: false, noImposters: false, reverse: false },
    });
    const { round } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(round.trollRule).toBe(null);
    expect(round.secretWord).toBeTruthy();
    expect(round.assignments.filter((a) => a.role === "imposter")).toHaveLength(1);
  });
});

describe("starter weights", () => {
  it("weights civilians 1 and imposters 0.5 on mixed rounds", () => {
    expect(starterWeights(["civilian", "imposter", "civilian"])).toEqual([1, 0.5, 1]);
  });

  it("is uniform when everyone has the same role", () => {
    expect(starterWeights(["imposter", "imposter"])).toEqual([1, 1]);
    expect(starterWeights(["civilian", "civilian", "civilian"])).toEqual([1, 1, 1]);
  });

  it("picks the imposter only after the civilian band", () => {
    const roles = ["civilian", "imposter"] as const;
    const weights = starterWeights(roles);
    expect(weights).toEqual([1, 0.5]);
    expect(pickStarterIndex(roles, () => 0)).toBe(0);
    expect(pickStarterIndex(roles, () => 0.66)).toBe(0);
    expect(pickStarterIndex(roles, () => 0.67)).toBe(1);
  });
});

describe("deck", () => {
  it("skips used secret words until the category is exhausted, then reshuffles", () => {
    const food = categoryById("food", pack);
    let deck = emptyDeck();
    const seen: string[] = [];
    for (let i = 0; i < food.words.length; i++) {
      const picked = pickSecretWord("food", deck, pack, () => 0);
      deck = picked.deck;
      seen.push(picked.word);
    }
    expect(new Set(seen).size).toBe(food.words.length);
    const again = pickSecretWord("food", deck, pack, () => 0);
    expect(food.words.map((w) => w.word)).toContain(again.word);
    expect(again.deck.usedByCategory.food).toEqual([again.word]);
  });

  it("resets when the enabled category set changes and continues across new rounds", () => {
    const setupFood = namedSetup(["Ada", "Bob", "Cara"], {
      enabledCategoryIds: ["food"],
    });
    const first = dealRound({
      setup: setupFood,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(first.deck.usedByCategory.food).toHaveLength(1);

    const second = dealRound({
      setup: setupFood,
      pack,
      deck: first.deck,
      random: () => 0,
    });
    expect(second.deck.usedByCategory.food).toHaveLength(2);
    expect(second.round.secretWord).not.toBe(first.round.secretWord);

    const setupAnimals = namedSetup(["Ada", "Bob", "Cara"], {
      enabledCategoryIds: ["animals"],
    });
    const reset = dealRound({
      setup: setupAnimals,
      pack,
      deck: second.deck,
      random: () => 0,
    });
    expect(reset.deck.usedByCategory.food).toBeUndefined();
    expect(reset.deck.usedByCategory.animals).toEqual([reset.round.secretWord]);
  });
});

describe("flip next gating", () => {
  it("requires a flip and a face-down card", () => {
    expect(canPressNext(false, true)).toBe(false);
    expect(canPressNext(true, false)).toBe(false);
    expect(canPressNext(false, false)).toBe(false);
    expect(canPressNext(true, true)).toBe(true);
  });

  it("records a look on the first tap and allows hide-then-next", () => {
    let flip = resetFlip(0);
    expect(canPressNext(flip.hasFlipped, flip.faceDown)).toBe(false);
    flip = afterCardTap(flip);
    expect(flip.faceDown).toBe(false);
    expect(flip.hasFlipped).toBe(true);
    expect(canPressNext(flip.hasFlipped, flip.faceDown)).toBe(false);
    flip = afterCardTap(flip);
    expect(flip.faceDown).toBe(true);
    expect(canPressNext(flip.hasFlipped, flip.faceDown)).toBe(true);
  });
});

describe("recap copy", () => {
  const cases: Array<[TrollRuleId | null, string | null]> = [
    [null, null],
    ["reverse", "This round was a Reverse round."],
    ["allImposters", "This round everybody was the imposter."],
    ["noImposters", "This round there were no imposters."],
  ];
  for (const [rule, line] of cases) {
    it(`maps ${String(rule)}`, () => {
      expect(trollRecapLine(rule)).toBe(line);
    });
  }
});
