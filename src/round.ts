import { deckForCategories, pickSecretWord } from "./deck.ts";
import { allHintsInCategory, categoryById, wordEntry } from "./pack.ts";
import {
  pickIndex,
  pickOne,
  pickWeightedIndex,
  shuffled,
  type Random,
} from "./rng.ts";
import {
  CIVILIAN_STARTER_WEIGHT,
  IMPOSTER_STARTER_WEIGHT,
  TROLL_CHANCE,
  TROLL_RULES,
  type Assignment,
  type DeckState,
  type Role,
  type RoundState,
  type SetupState,
  type TrollRuleId,
  type TrollRules,
  type WordPack,
} from "./types.ts";
import { activeNames } from "./names.ts";

export function isImposterTeam(role: Role): boolean {
  return role === "imposter" || role === "doubleAgent";
}

export function seesSecretWord(role: Role): boolean {
  return role === "civilian" || role === "doubleAgent";
}

export function formatImposterLine(names: readonly string[]): string {
  if (names.length <= 1) {
    return `The imposter is ${names[0] ?? ""}.`;
  }
  if (names.length === 2) {
    return `The imposters are ${names[0]} and ${names[1]}.`;
  }
  const last = names[names.length - 1];
  const head = names.slice(0, -1).join(", ");
  return `The imposters are ${head}, and ${last}.`;
}

export function armedTrollRules(trollEnabled: boolean, rules: TrollRules): TrollRuleId[] {
  if (!trollEnabled) return [];
  return TROLL_RULES.filter((id) => rules[id]);
}

export function isTrollArmed(trollEnabled: boolean, rules: TrollRules): boolean {
  return armedTrollRules(trollEnabled, rules).length > 0;
}

export function rollTroll(
  trollEnabled: boolean,
  rules: TrollRules,
  random: Random,
): TrollRuleId | null {
  const armed = armedTrollRules(trollEnabled, rules);
  if (armed.length === 0) return null;
  if (random() >= TROLL_CHANCE) return null;
  return armed[pickIndex(armed.length, random)] ?? null;
}

export function assignRoles(
  playerCount: number,
  imposterCount: number,
  trollRule: TrollRuleId | null,
  random: Random,
): Role[] {
  if (trollRule === "allImposters") {
    return Array.from({ length: playerCount }, () => "imposter");
  }
  if (trollRule === "noImposters") {
    return Array.from({ length: playerCount }, () => "civilian");
  }
  if (trollRule === "reverse") {
    const civilianIndex = pickIndex(playerCount, random);
    return Array.from({ length: playerCount }, (_, i) =>
      i === civilianIndex ? "civilian" : "imposter",
    );
  }
  const clamped = Math.min(Math.max(imposterCount, 1), playerCount - 1);
  const order = shuffled(
    Array.from({ length: playerCount }, (_, i) => i),
    random,
  );
  const imposters = new Set(order.slice(0, clamped));
  return Array.from({ length: playerCount }, (_, i) =>
    imposters.has(i) ? "imposter" : "civilian",
  );
}

export function starterWeights(roles: readonly Role[]): number[] {
  const allSame = roles.every((r) => r === roles[0]);
  if (allSame) {
    return roles.map(() => 1);
  }
  return roles.map((role) =>
    role === "imposter" ? IMPOSTER_STARTER_WEIGHT : CIVILIAN_STARTER_WEIGHT,
  );
}

export function pickStarterIndex(roles: readonly Role[], random: Random): number {
  return pickWeightedIndex(starterWeights(roles), random);
}

export function hintsForImposter(
  role: Role,
  trollRule: TrollRuleId | null,
  secretWord: string | null,
  categoryId: string,
  pack: WordPack,
  hintsEnabled: boolean,
  random: Random,
): string | null {
  if (!hintsEnabled || role !== "imposter") return null;
  const category = categoryById(categoryId, pack);
  const chaosHints = trollRule === "allImposters" || trollRule === "reverse";
  if (chaosHints) {
    const pool = allHintsInCategory(category);
    return pickOne(pool, random);
  }
  if (!secretWord) return null;
  const entry = wordEntry(category, secretWord);
  return pickOne(entry.hints, random);
}

export function dealRound(input: {
  setup: SetupState;
  pack: WordPack;
  deck: DeckState;
  random?: Random;
}): { round: RoundState; deck: DeckState } {
  const random = input.random ?? Math.random;
  const names = activeNames(input.setup.names);
  if (names.length < 2) {
    throw new Error("Need at least two named players to deal a round");
  }
  if (input.setup.enabledCategoryIds.length === 0) {
    throw new Error("Need at least one enabled category");
  }

  let deck = deckForCategories(input.deck, input.setup.enabledCategoryIds);
  const categoryId = pickOne(input.setup.enabledCategoryIds, random);
  let trollRule = rollTroll(
    input.setup.trollEnabled,
    input.setup.trollRules,
    random,
  );
  const roles = assignRoles(
    names.length,
    input.setup.imposterCount,
    trollRule,
    random,
  );

  if (trollRule === "doubleAgent") {
    const civilianIndexes = roles.flatMap((role, index) =>
      role === "civilian" ? [index] : [],
    );
    if (civilianIndexes.length < 2) {
      trollRule = null;
    } else {
      const chosen = civilianIndexes[pickIndex(civilianIndexes.length, random)];
      if (chosen !== undefined) roles[chosen] = "doubleAgent";
    }
  }

  let secretWord: string | null = null;
  if (roles.some(seesSecretWord)) {
    const picked = pickSecretWord(categoryId, deck, input.pack, random);
    secretWord = picked.word;
    deck = picked.deck;
  }

  const assignments: Assignment[] = names.map((name, i) => {
    const role = roles[i] ?? "civilian";
    return {
      name,
      role,
      hint: hintsForImposter(
        role,
        trollRule,
        secretWord,
        categoryId,
        input.pack,
        input.setup.hintsEnabled,
        random,
      ),
    };
  });

  const starterIndex = pickStarterIndex(roles, random);

  return {
    round: {
      categoryId,
      trollRule,
      secretWord,
      assignments,
      starterIndex,
    },
    deck,
  };
}

export function trollRecapLine(rule: TrollRuleId | null): string | null {
  if (rule === "reverse") return "This round was a Reverse round.";
  if (rule === "allImposters") return "This round everybody was the imposter.";
  if (rule === "noImposters") return "This round there were no imposters.";
  if (rule === "doubleAgent") return "This round had a Double Agent.";
  return null;
}

export const EXTRA_CLUE_MIN_PLAYERS = 6;

export function voteTargets(
  aliveIndexes: readonly number[],
  voterAssignmentIndex: number,
  tiedIndexes: readonly number[] | null,
): number[] {
  const allowed = new Set(tiedIndexes ?? aliveIndexes);
  return aliveIndexes.filter((index) => index !== voterAssignmentIndex && allowed.has(index));
}

export function tallyVotes(ballots: Readonly<Record<number, number>>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const target of Object.values(ballots)) {
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  return counts;
}

export function topTiedIndexes(ballots: Readonly<Record<number, number>>): number[] {
  const counts = tallyVotes(ballots);
  let max = 0;
  for (const n of counts.values()) max = Math.max(max, n);
  return [...counts.entries()]
    .filter(([, n]) => n === max)
    .map(([index]) => index)
    .sort((a, b) => a - b);
}

export function imposterArticle(
  ejectedRole: Role,
  remainingRoles: readonly Role[],
): "the" | "an" {
  if (ejectedRole !== "imposter") return "an";
  const impostersLeft = remainingRoles.filter((role) => role === "imposter").length;
  return impostersLeft === 0 ? "the" : "an";
}

export function ejectVerdictLine(
  name: string,
  role: Role,
  remainingRoles: readonly Role[],
): string {
  if (role === "imposter") {
    return `${name} was ${imposterArticle(role, remainingRoles)} imposter.`;
  }
  return `${name} was not an imposter.`;
}

export function ejectDoubleAgentLine(name: string): string {
  return `...${name} was the double agent`;
}

export function lastWordMatches(guess: string, secretWord: string | null): boolean {
  if (!secretWord) return false;
  const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  const folded = normalize(guess);
  return folded.length > 0 && folded === normalize(secretWord);
}

export function gainsExtraClueRound(
  namedPlayerCount: number,
  civilianEjectsBefore: number,
  ejectedRole: Role,
): boolean {
  return (
    ejectedRole === "civilian" &&
    namedPlayerCount >= EXTRA_CLUE_MIN_PLAYERS &&
    civilianEjectsBefore === 0
  );
}

export function recapEjectedLine(names: readonly string[]): string | null {
  if (names.length === 0) return null;
  const [first, ...rest] = names;
  return `Ejected: ${first}${rest.map((name) => `, then ${name}`).join("")}`;
}

export function votePrompt(tiedIndexes: readonly number[] | null): string {
  return tiedIndexes ? "Tied. Tap to vote." : "Tap to vote.";
}

export function canPressNext(hasFlipped: boolean, faceDown: boolean): boolean {
  return hasFlipped && faceDown;
}

export function afterCardTap(flip: { playerIndex: number; faceDown: boolean; hasFlipped: boolean }): {
  playerIndex: number;
  faceDown: boolean;
  hasFlipped: boolean;
} {
  return {
    playerIndex: flip.playerIndex,
    faceDown: !flip.faceDown,
    hasFlipped: true,
  };
}

export function resetFlip(playerIndex: number): {
  playerIndex: number;
  faceDown: boolean;
  hasFlipped: boolean;
} {
  return { playerIndex, faceDown: true, hasFlipped: false };
}
