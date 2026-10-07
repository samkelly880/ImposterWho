import { defaultAppState, enableTroll } from "./defaults.ts";
import { bumpImposterCount, setAutoImposters, syncImposterCount } from "./imposters.ts";
import { activeNames } from "./names.ts";
import { pack } from "./pack.ts";
import { afterCardTap, canPressNext, dealRound, resetFlip } from "./round.ts";
import { loadSetup, saveSetup } from "./storage.ts";
import { MAX_PLAYERS, MIN_PLAYERS, type AppState, type SetupState, type WordPack } from "./types.ts";
import { startReady } from "./validation.ts";

export type ControllerOptions = {
  pack?: WordPack;
  storage?: Storage;
  random?: () => number;
};

export class GameController {
  state: AppState;
  readonly pack: WordPack;
  private readonly storage: Storage | null;
  private readonly random: () => number;

  constructor(options: ControllerOptions = {}) {
    this.pack = options.pack ?? pack;
    this.storage = options.storage ?? null;
    this.random = options.random ?? Math.random;
    const setup = options.storage
      ? loadSetup(this.pack, options.storage)
      : defaultAppState(this.pack).setup;
    this.state = { ...defaultAppState(this.pack), setup: syncImposterCount(setup) };
  }

  private persist(): void {
    if (this.storage) saveSetup(this.state.setup, this.storage);
  }

  private updateSetup(mutator: (setup: SetupState) => SetupState): void {
    this.state = {
      ...this.state,
      setup: syncImposterCount(mutator(this.state.setup)),
    };
    this.persist();
  }

  setName(index: number, value: string): void {
    this.updateSetup((setup) => {
      const names = [...setup.names];
      names[index] = value;
      return { ...setup, names };
    });
  }

  addPlayer(): void {
    this.updateSetup((setup) => {
      if (setup.names.length >= MAX_PLAYERS) return setup;
      return { ...setup, names: [...setup.names, ""] };
    });
  }

  removePlayer(index: number): void {
    this.updateSetup((setup) => {
      if (setup.names.length <= MIN_PLAYERS) return setup;
      const names = setup.names.filter((_, i) => i !== index);
      return { ...setup, names };
    });
  }

  toggleAccordion(section: keyof SetupState["accordion"]): void {
    this.updateSetup((setup) => ({
      ...setup,
      accordion: { ...setup.accordion, [section]: !setup.accordion[section] },
    }));
  }

  toggleCategory(id: string): void {
    this.updateSetup((setup) => {
      const enabled = new Set(setup.enabledCategoryIds);
      if (enabled.has(id)) enabled.delete(id);
      else enabled.add(id);
      return { ...setup, enabledCategoryIds: this.pack.categories.map((c) => c.id).filter((cid) => enabled.has(cid)) };
    });
  }

  setAuto(on: boolean): void {
    this.updateSetup((setup) => setAutoImposters(setup, on));
  }

  bumpImposters(delta: number): void {
    this.updateSetup((setup) => bumpImposterCount(setup, delta));
  }

  setHints(on: boolean): void {
    this.updateSetup((setup) => ({ ...setup, hintsEnabled: on }));
  }

  setTroll(on: boolean): void {
    this.updateSetup((setup) => (on ? enableTroll(setup) : { ...setup, trollEnabled: false }));
  }

  setTrollRule(id: keyof SetupState["trollRules"], on: boolean): void {
    this.updateSetup((setup) => ({
      ...setup,
      trollRules: { ...setup.trollRules, [id]: on },
    }));
  }

  startRound(): boolean {
    if (!startReady(this.state.setup)) return false;
    const dealt = dealRound({
      setup: this.state.setup,
      pack: this.pack,
      deck: this.state.deck,
      random: this.random,
    });
    this.state = {
      ...this.state,
      screen: "flip",
      round: dealt.round,
      deck: dealt.deck,
      flip: resetFlip(0),
      confirmQuit: false,
    };
    return true;
  }

  tapCard(): void {
    if (this.state.screen !== "flip") return;
    this.state = { ...this.state, flip: afterCardTap(this.state.flip) };
  }

  nextPlayer(): boolean {
    if (this.state.screen !== "flip" || !this.state.round) return false;
    if (!canPressNext(this.state.flip.hasFlipped, this.state.flip.faceDown)) return false;
    const lastIndex = this.state.round.assignments.length - 1;
    if (this.state.flip.playerIndex >= lastIndex) {
      this.state = { ...this.state, screen: "start", confirmQuit: false };
      return true;
    }
    this.state = {
      ...this.state,
      flip: resetFlip(this.state.flip.playerIndex + 1),
    };
    return true;
  }

  openRecap(): void {
    if (this.state.screen !== "start") return;
    this.state = { ...this.state, screen: "recap", confirmQuit: false };
  }

  newRound(): boolean {
    if (this.state.screen === "setup") return false;
    return this.startRound();
  }

  backToSetup(): void {
    this.state = {
      ...this.state,
      screen: "setup",
      round: null,
      confirmQuit: false,
    };
  }

  requestQuit(): void {
    if (this.state.screen === "setup") return;
    this.state = { ...this.state, confirmQuit: true };
  }

  cancelQuit(): void {
    this.state = { ...this.state, confirmQuit: false };
  }

  confirmQuit(): void {
    this.backToSetup();
  }

  playerCount(): number {
    return activeNames(this.state.setup.names).length;
  }
}
