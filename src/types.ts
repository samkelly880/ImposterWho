export type Role = "civilian" | "imposter";

export type TrollRuleId = "allImposters" | "noImposters" | "reverse";

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

export type Screen = "setup" | "flip" | "start" | "recap";

export type AppState = {
  screen: Screen;
  setup: SetupState;
  round: RoundState | null;
  deck: DeckState;
  flip: FlipUi;
  confirmQuit: boolean;
};

export const TROLL_RULES: TrollRuleId[] = [
  "allImposters",
  "noImposters",
  "reverse",
];

export const STORAGE_KEY = "imposter-who-setup";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const DEFAULT_PLAYER_SLOTS = 4;
export const MIN_NAME_LENGTH = 1;
export const MAX_NAME_LENGTH = 16;
export const TROLL_CHANCE = 0.1;
export const CIVILIAN_STARTER_WEIGHT = 1;
export const IMPOSTER_STARTER_WEIGHT = 0.5;
