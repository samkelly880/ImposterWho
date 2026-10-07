import { emptyNameSlots } from "./names.ts";
import { categoryIds } from "./pack.ts";
import { autoImposterCount } from "./imposters.ts";
import { emptyDeck } from "./deck.ts";
import { MIN_PLAYERS } from "./types.ts";
import type { AppState, PlayState, SetupState, WordPack } from "./types.ts";

export function defaultSetup(pack: WordPack): SetupState {
  const names = emptyNameSlots();
  return {
    names,
    accordion: { players: true, categories: false, modes: false },
    enabledCategoryIds: categoryIds(pack),
    autoImposters: true,
    imposterCount: autoImposterCount(MIN_PLAYERS),
    hintsEnabled: true,
    trollEnabled: false,
    trollRules: {
      allImposters: true,
      noImposters: true,
      reverse: true,
      doubleAgent: false,
    },
    lastWordEnabled: false,
  };
}

export function initPlay(playerCount: number): PlayState {
  return {
    aliveIndexes: Array.from({ length: playerCount }, (_, i) => i),
    civilianEjectCount: 0,
    ejected: [],
    vote: null,
    eject: null,
    lastWord: null,
    outcome: null,
    lastWordGuess: null,
  };
}

export function emptyPlay(): PlayState {
  return initPlay(0);
}

export function defaultAppState(pack: WordPack): AppState {
  return {
    screen: "setup",
    setup: defaultSetup(pack),
    round: null,
    deck: emptyDeck(),
    flip: { playerIndex: 0, faceDown: true, hasFlipped: false },
    play: emptyPlay(),
    confirmQuit: false,
  };
}


