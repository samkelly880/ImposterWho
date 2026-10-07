export type Role = "civilian" | "imposter" | "doubleAgent";

export type TrollRuleId = "allImposters" | "noImposters" | "reverse" | "doubleAgent";

export type WordEntry = {
  word: string;
  hints: string[];
};

export type Category = {
  id: string;
  name: string;
  words: WordEntry[];
};

export type WordPack = {
  categories: Category[];
};

export type TrollRules = Record<TrollRuleId, boolean>;

export type AccordionState = {
  players: boolean;
  categories: boolean;
  modes: boolean;
};

export type SetupState = {
  names: string[];
  accordion: AccordionState;
  enabledCategoryIds: string[];
  autoImposters: boolean;
  imposterCount: number;
  hintsEnabled: boolean;
  trollEnabled: boolean;
  trollRules: TrollRules;
  lastWordEnabled: boolean;
};

export type Assignment = {
  name: string;
  role: Role;
  hint: string | null;
};

export type RoundState = {
  categoryId: string;
  trollRule: TrollRuleId | null;
  secretWord: string | null;
  assignments: Assignment[];
  starterIndex: number;
};

export type DeckState = {
  usedByCategory: Record<string, string[]>;
  lastEnabledKey: string;
};

export type FlipUi = {
  playerIndex: number;
  faceDown: boolean;
  hasFlipped: boolean;
};

export type Screen = "setup" | "flip" | "start" | "vote" | "eject" | "lastWord" | "recap";

export type RoundOutcome = "imposters" | "civilians";

export type EjectPhase = "falling" | "verdict" | "daReveal" | "ready";

export type VoteState = {
  voterIndex: number;
  faceDown: boolean;
  hasFlipped: boolean;
  selectedIndex: number | null;
  ballots: Record<number, number>;
  tiedIndexes: number[] | null;
};

export type EjectState = {
  index: number;
  phase: EjectPhase;
};

export type LastWordUi = {
  guesserIndex: number;
  draft: string;
};

export type EjectedPlayer = {
  index: number;
  role: Role;
};

export type PlayState = {
  aliveIndexes: number[];
  civilianEjectCount: number;
  ejected: EjectedPlayer[];
  vote: VoteState | null;
  eject: EjectState | null;
  lastWord: LastWordUi | null;
  outcome: RoundOutcome | null;
  lastWordGuess: string | null;
};

export type AppState = {
  screen: Screen;
  setup: SetupState;
  round: RoundState | null;
  deck: DeckState;
  flip: FlipUi;
  play: PlayState;
  confirmQuit: boolean;
};

export const TROLL_RULES: TrollRuleId[] = [
  "allImposters",
  "noImposters",
  "reverse",
  "doubleAgent",
];

export const STORAGE_KEY = "imposter-who-setup";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const DEFAULT_PLAYER_SLOTS = 4;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 16;
export const TROLL_CHANCE = 0.0333;
export const CIVILIAN_STARTER_WEIGHT = 1;
export const IMPOSTER_STARTER_WEIGHT = 0.5;
