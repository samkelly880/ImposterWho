import { defaultAppState, emptyPlay, initPlay } from "./defaults.ts";
import { bumpImposterCount, setAutoImposters, syncImposterCount } from "./imposters.ts";
import { activeNames } from "./names.ts";
import { pack } from "./pack.ts";
import {
  afterCardTap,
  canPressNext,
  dealRound,
  gainsExtraClueRound,
  isImposterTeam,
  lastWordMatches,
  pickStarterIndex,
  resetFlip,
  topTiedIndexes,
  voteTargets,
} from "./round.ts";
import { loadSetup, saveSetup } from "./storage.ts";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type AppState,
  type PlayState,
  type SetupState,
  type VoteState,
  type WordPack,
} from "./types.ts";
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
    this.updateSetup((setup) => ({ ...setup, trollEnabled: on }));
  }

  setTrollRule(id: keyof SetupState["trollRules"], on: boolean): void {
    this.updateSetup((setup) => ({
      ...setup,
      trollRules: { ...setup.trollRules, [id]: on },
    }));
  }

  setLastWord(on: boolean): void {
    this.updateSetup((setup) => ({ ...setup, lastWordEnabled: on }));
  }

  private setPlay(play: PlayState): void {
    this.state = { ...this.state, play };
  }

  private freshVote(tiedIndexes: number[] | null): VoteState {
    return {
      voterIndex: 0,
      faceDown: true,
      hasFlipped: false,
      selectedIndex: null,
      ballots: {},
      tiedIndexes,
    };
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
      play: initPlay(dealt.round.assignments.length),
      confirmQuit: false,
    };
    return true;
  }

  tapCard(): void {
    if (this.state.screen === "vote") {
      const vote = this.state.play.vote;
      if (!vote) return;
      const tapped = afterCardTap({
        playerIndex: vote.voterIndex,
        faceDown: vote.faceDown,
        hasFlipped: vote.hasFlipped,
      });
      this.setPlay({
        ...this.state.play,
        vote: { ...vote, faceDown: tapped.faceDown, hasFlipped: tapped.hasFlipped },
      });
      return;
    }
    if (this.state.screen !== "flip") return;
    this.state = { ...this.state, flip: afterCardTap(this.state.flip) };
  }

  nextPlayer(): boolean {
    if (this.state.screen === "vote") return this.nextVoter();
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

  openVote(): boolean {
    if (this.state.screen !== "start" || !this.state.round) return false;
    if (!this.state.setup.lastWordEnabled) return false;
    this.state = {
      ...this.state,
      screen: "vote",
      play: { ...this.state.play, vote: this.freshVote(null), eject: null },
      confirmQuit: false,
    };
    return true;
  }

  selectVoteTarget(index: number): void {
    const vote = this.state.play.vote;
    if (this.state.screen !== "vote" || !vote) return;
    const voterAssignment = this.state.play.aliveIndexes[vote.voterIndex];
    if (voterAssignment === undefined) return;
    const legal = voteTargets(this.state.play.aliveIndexes, voterAssignment, vote.tiedIndexes);
    if (!legal.includes(index)) return;
    this.setPlay({ ...this.state.play, vote: { ...vote, selectedIndex: index } });
  }

  private nextVoter(): boolean {
    const vote = this.state.play.vote;
    const round = this.state.round;
    if (!vote || !round || vote.selectedIndex === null) return false;
    if (!canPressNext(vote.hasFlipped, vote.faceDown)) return false;
    const voterAssignment = this.state.play.aliveIndexes[vote.voterIndex];
    if (voterAssignment === undefined) return false;
    const ballots = { ...vote.ballots, [voterAssignment]: vote.selectedIndex };
    if (vote.voterIndex < this.state.play.aliveIndexes.length - 1) {
      const nextIndex = vote.voterIndex + 1;
      this.setPlay({
        ...this.state.play,
        vote: {
          ...this.freshVote(vote.tiedIndexes),
          voterIndex: nextIndex,
          ballots,
          tiedIndexes: vote.tiedIndexes,
        },
      });
      return true;
    }
    const tied = topTiedIndexes(ballots);
    if (tied.length !== 1) {
      this.setPlay({
        ...this.state.play,
        vote: this.freshVote(tied),
      });
      return true;
    }
    const ejectedIndex = tied[0];
    if (ejectedIndex === undefined) return false;
    this.state = {
      ...this.state,
      screen: "eject",
      play: {
        ...this.state.play,
        vote: null,
        eject: { index: ejectedIndex, phase: "falling" },
      },
      confirmQuit: false,
    };
    return true;
  }

  advanceEjectPhase(): void {
    const eject = this.state.play.eject;
    const round = this.state.round;
    if (this.state.screen !== "eject" || !eject || !round) return;
    const role = round.assignments[eject.index]?.role;
    if (eject.phase === "falling") {
      this.setPlay({ ...this.state.play, eject: { ...eject, phase: "verdict" } });
      return;
    }
    if (eject.phase === "verdict") {
      const next = role === "doubleAgent" ? "daReveal" : "ready";
      this.setPlay({ ...this.state.play, eject: { ...eject, phase: next } });
      return;
    }
    if (eject.phase === "daReveal") {
      this.setPlay({ ...this.state.play, eject: { ...eject, phase: "ready" } });
    }
  }

  continueEject(): void {
    const eject = this.state.play.eject;
    const round = this.state.round;
    if (this.state.screen !== "eject" || !eject || !round) return;
    if (eject.phase !== "ready") return;
    const assignment = round.assignments[eject.index];
    if (!assignment) return;
    const aliveIndexes = this.state.play.aliveIndexes.filter((index) => index !== eject.index);
    const civilianEjectCount =
      assignment.role === "civilian"
        ? this.state.play.civilianEjectCount + 1
        : this.state.play.civilianEjectCount;
    const play: PlayState = {
      ...this.state.play,
      aliveIndexes,
      civilianEjectCount,
      ejected: [...this.state.play.ejected, { index: eject.index, role: assignment.role }],
      vote: null,
      eject: null,
    };

    if (assignment.role === "imposter") {
      if (round.secretWord) {
        this.state = {
          ...this.state,
          screen: "lastWord",
          play: {
            ...play,
            lastWord: { guesserIndex: eject.index, draft: "" },
          },
          confirmQuit: false,
        };
        return;
      }
      this.state = {
        ...this.state,
        screen: "recap",
        play: { ...play, outcome: null },
        confirmQuit: false,
      };
      return;
    }

    if (assignment.role === "doubleAgent") {
      this.state = {
        ...this.state,
        screen: "recap",
        play: { ...play, outcome: "imposters" },
        confirmQuit: false,
      };
      return;
    }

    if (!round.assignments.some((seat) => isImposterTeam(seat.role))) {
      this.state = {
        ...this.state,
        screen: "recap",
        play: { ...play, outcome: null },
        confirmQuit: false,
      };
      return;
    }

    if (
      gainsExtraClueRound(
        round.assignments.length,
        this.state.play.civilianEjectCount,
        assignment.role,
      )
    ) {
      const remainingRoles = aliveIndexes.map(
        (index) => round.assignments[index]?.role ?? "civilian",
      );
      const localStarter = pickStarterIndex(remainingRoles, this.random);
      const starterIndex = aliveIndexes[localStarter] ?? aliveIndexes[0] ?? 0;
      this.state = {
        ...this.state,
        screen: "start",
        round: { ...round, starterIndex },
        play,
        confirmQuit: false,
      };
      return;
    }

    this.state = {
      ...this.state,
      screen: "recap",
      play: { ...play, outcome: "imposters" },
      confirmQuit: false,
    };
  }

  setLastWordDraft(value: string): void {
    const lastWord = this.state.play.lastWord;
    if (this.state.screen !== "lastWord" || !lastWord) return;
    this.setPlay({ ...this.state.play, lastWord: { ...lastWord, draft: value } });
  }

  submitLastWord(): void {
    const lastWord = this.state.play.lastWord;
    const round = this.state.round;
    if (this.state.screen !== "lastWord" || !lastWord || !round) return;
    const match = lastWordMatches(lastWord.draft, round.secretWord);
    this.state = {
      ...this.state,
      screen: "recap",
      play: {
        ...this.state.play,
        lastWord: null,
        lastWordGuess: lastWord.draft,
        outcome: match ? "imposters" : "civilians",
      },
      confirmQuit: false,
    };
  }

  openRecap(): void {
    if (this.state.screen !== "start") return;
    if (this.state.setup.lastWordEnabled) return;
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
      play: emptyPlay(),
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
