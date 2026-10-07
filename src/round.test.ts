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
  formatImposterLine,
  isImposterTeam,
  isTrollArmed,
  pickStarterIndex,
  resetFlip,
  rollTroll,
  seesSecretWord,
  starterWeights,
  trollRecapLine,
} from "./round.ts";
import type { SetupState, TrollRuleId, TrollRules } from "./types.ts";

function rules(partial: Partial<TrollRules> = {}): TrollRules {
  return {
    allImposters: false,
    noImposters: false,
    reverse: false,
    doubleAgent: false,
    ...partial,
  };
}

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
    const off = rules();
    expect(isTrollArmed(true, off)).toBe(false);
    expect(armedTrollRules(true, off)).toEqual([]);
    expect(rollTroll(true, off, () => 0)).toBe(null);
  });

  it("does not fire when the roll is 10% or higher", () => {
    const armed = rules({ allImposters: true, noImposters: true, reverse: true });
    expect(rollTroll(true, armed, createQueueRandom([0.1]))).toBe(null);
  });

  it("fires at 10% and picks one enabled rule uniformly", () => {
    const armed = rules({ allImposters: true, reverse: true });
    expect(rollTroll(true, armed, createQueueRandom([0.099, 0]))).toBe("allImposters");
    expect(rollTroll(true, armed, createQueueRandom([0, 0.5]))).toBe("reverse");
  });

  it("includes Double Agent in the armed list and 10% pick", () => {
    const onlyDa = rules({ doubleAgent: true });
    expect(armedTrollRules(true, onlyDa)).toEqual(["doubleAgent"]);
    expect(rollTroll(true, onlyDa, createQueueRandom([0, 0]))).toBe("doubleAgent");
    expect(rollTroll(true, onlyDa, createQueueRandom([0.1]))).toBe(null);
    const mixed = rules({ allImposters: true, reverse: true, doubleAgent: true });
    expect(armedTrollRules(true, mixed)).toEqual([
      "allImposters",
      "reverse",
      "doubleAgent",
    ]);
    expect(rollTroll(true, mixed, createQueueRandom([0, 0.9]))).toBe("doubleAgent");
  });

  it("never rolls when troll is off even if sub-rules are checked", () => {
    const armed = rules({
      allImposters: true,
      noImposters: true,
      reverse: true,
      doubleAgent: true,
    });
    expect(rollTroll(false, armed, () => 0)).toBe(null);
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

  it("Double Agent uses the normal imposter count (conversion happens in dealRound)", () => {
    const roles = assignRoles(5, 2, "doubleAgent", () => 0.99);
    expect(roles.filter((r) => r === "imposter")).toHaveLength(2);
    expect(roles.filter((r) => r === "civilian")).toHaveLength(3);
    expect(roles).not.toContain("doubleAgent");
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
      trollRules: rules({ allImposters: true }),
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
      trollRules: rules({ reverse: true }),
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
      trollRules: rules({ noImposters: true }),
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
      trollRules: rules(),
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

  it("converts one civilian to Double Agent, keeps the word, and leaves the hint null", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara", "Dee"], {
      trollEnabled: true,
      trollRules: rules({ doubleAgent: true }),
    });
    const { round, deck } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    const doubleAgents = round.assignments.filter((a) => a.role === "doubleAgent");
    const imposters = round.assignments.filter((a) => a.role === "imposter");
    const civilians = round.assignments.filter((a) => a.role === "civilian");
    expect(round.trollRule).toBe("doubleAgent");
    expect(doubleAgents).toHaveLength(1);
    expect(imposters).toHaveLength(1);
    expect(civilians).toHaveLength(2);
    expect(round.secretWord).toBeTruthy();
    expect(deck.usedByCategory.food).toEqual([round.secretWord]);
    expect(doubleAgents[0]!.hint).toBe(null);
    expect(civilians.every((a) => a.hint === null)).toBe(true);
    expect(imposters[0]!.hint).not.toBeNull();
  });

  it("skips Double Agent when only one civilian remains after the normal deal", () => {
    const setup = namedSetup(["Ada", "Bob", "Cara"], {
      imposterCount: 2,
      trollEnabled: true,
      trollRules: rules({ doubleAgent: true }),
    });
    const { round, deck } = dealRound({
      setup,
      pack,
      deck: emptyDeck(),
      random: () => 0,
    });
    expect(round.trollRule).toBe(null);
    expect(round.assignments.some((a) => a.role === "doubleAgent")).toBe(false);
    expect(round.assignments.filter((a) => a.role === "imposter")).toHaveLength(2);
    expect(round.assignments.filter((a) => a.role === "civilian")).toHaveLength(1);
    expect(round.secretWord).toBeTruthy();
    expect(deck.usedByCategory.food).toEqual([round.secretWord]);
  });
});

describe("starter weights", () => {
  it("weights civilians 1 and imposters 0.5 on mixed rounds", () => {
    expect(starterWeights(["civilian", "imposter", "civilian"])).toEqual([1, 0.5, 1]);
    expect(starterWeights(["civilian", "imposter", "doubleAgent"])).toEqual([1, 0.5, 1]);
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
    ["doubleAgent", "This round had a Double Agent."],
  ];
  for (const [rule, line] of cases) {
    it(`maps ${String(rule)}`, () => {
      expect(trollRecapLine(rule)).toBe(line);
    });
  }
});

describe("role helpers", () => {
  it("treats imposters and the double agent as the imposter team", () => {
    expect(isImposterTeam("imposter")).toBe(true);
    expect(isImposterTeam("doubleAgent")).toBe(true);
    expect(isImposterTeam("civilian")).toBe(false);
  });

  it("shows the secret word to civilians and the double agent", () => {
    expect(seesSecretWord("civilian")).toBe(true);
    expect(seesSecretWord("doubleAgent")).toBe(true);
    expect(seesSecretWord("imposter")).toBe(false);
  });

  it("lists imposters in slot order with Oxford comma", () => {
    expect(formatImposterLine(["Ada"])).toBe("The imposter is Ada.");
    expect(formatImposterLine(["Ada", "Bob"])).toBe("The imposters are Ada and Bob.");
    expect(formatImposterLine(["Ada", "Bob", "Cara"])).toBe(
      "The imposters are Ada, Bob, and Cara.",
    );
  });
});
