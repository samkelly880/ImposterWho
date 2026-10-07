import { describe, expect, it } from "./testkit.ts";
import { GameController } from "./controller.ts";
import { memoryStorage } from "./storage.ts";
import { startReady } from "./validation.ts";

function seededController(): GameController {
  return new GameController({
    storage: memoryStorage(),
    random: () => 0,
  });
}

describe("GameController flow", () => {
  it("refuses to start until the table is valid", () => {
    const game = seededController();
    expect(game.startRound()).toBe(false);
    expect(game.state.screen).toBe("setup");
    game.setName(0, "Ada");
    game.setName(1, "Bob");
    game.setName(2, "Cara");
    expect(startReady(game.state.setup)).toBe(true);
    expect(game.startRound()).toBe(true);
    expect(game.state.screen).toBe("flip");
    expect(game.state.round?.assignments).toHaveLength(3);
  });

  it("gates Next until the card has been flipped and hidden", () => {
    const game = seededController();
    game.setName(0, "Ada");
    game.setName(1, "Bob");
    game.setName(2, "Cara");
    game.startRound();
    expect(game.nextPlayer()).toBe(false);
    game.tapCard();
    expect(game.state.flip.faceDown).toBe(false);
    expect(game.nextPlayer()).toBe(false);
    game.tapCard();
    expect(game.nextPlayer()).toBe(true);
    expect(game.state.flip.playerIndex).toBe(1);
    expect(game.state.flip.hasFlipped).toBe(false);
  });

  it("moves to the start screen after the last Next", () => {
    const game = seededController();
    game.setName(0, "Ada");
    game.setName(1, "Bob");
    game.setName(2, "Cara");
    game.startRound();
    for (let i = 0; i < 3; i++) {
      game.tapCard();
      game.tapCard();
      game.nextPlayer();
    }
    expect(game.state.screen).toBe("start");
    const starter = game.state.round!.assignments[game.state.round!.starterIndex];
    expect(starter).toBeTruthy();
  });

  it("keeps names when quitting to setup and continues the deck on a new round", () => {
    const game = seededController();
    game.setName(0, "Ada");
    game.setName(1, "Bob");
    game.setName(2, "Cara");
    game.startRound();
    const firstWord = game.state.round?.secretWord;
    game.confirmQuit();
    expect(game.state.screen).toBe("setup");
    expect(game.state.setup.names.slice(0, 3)).toEqual(["Ada", "Bob", "Cara"]);
    game.startRound();
    expect(game.state.round?.secretWord).not.toBe(firstWord);
    expect(game.state.deck.usedByCategory.food?.length).toBeGreaterThan(1);
  });

  it("keeps troll sub-rules when Troll is turned off and on again", () => {
    const game = seededController();
    game.setTroll(true);
    game.setTrollRule("reverse", false);
    game.setTrollRule("allImposters", false);
    game.setTroll(false);
    expect(game.state.setup.trollEnabled).toBe(false);
    expect(game.state.setup.trollRules.reverse).toBe(false);
    game.setTroll(true);
    expect(game.state.setup.trollEnabled).toBe(true);
    expect(game.state.setup.trollRules.reverse).toBe(false);
    expect(game.state.setup.trollRules.allImposters).toBe(false);
    expect(game.state.setup.trollRules.noImposters).toBe(true);
    expect(game.state.setup.trollRules.doubleAgent).toBe(false);
  });

  it("persists disarmed troll sub-rules after Troll is re-enabled", () => {
    const storage = memoryStorage();
    const game = new GameController({ storage, random: () => 0 });
    game.setTroll(true);
    game.setTrollRule("allImposters", false);
    game.setTroll(false);
    game.setTroll(true);
    const again = new GameController({ storage, random: () => 0 });
    expect(again.state.setup.trollEnabled).toBe(true);
    expect(again.state.setup.trollRules.allImposters).toBe(false);
    expect(again.state.setup.trollRules.reverse).toBe(true);
    expect(again.state.setup.trollRules.doubleAgent).toBe(false);
  });

  it("persists Double Agent once it is turned on", () => {
    const storage = memoryStorage();
    const game = new GameController({ storage, random: () => 0 });
    expect(game.state.setup.trollRules.doubleAgent).toBe(false);
    game.setTroll(true);
    game.setTrollRule("doubleAgent", true);
    const again = new GameController({ storage, random: () => 0 });
    expect(again.state.setup.trollEnabled).toBe(true);
    expect(again.state.setup.trollRules.doubleAgent).toBe(true);
  });

  it("restores setup from storage", () => {
    const storage = memoryStorage();
    const game = new GameController({ storage, random: () => 0 });
    game.setName(0, "Ada");
    game.setHints(false);
    game.setTroll(true);
    game.setLastWord(true);
    const again = new GameController({ storage, random: () => 0 });
    expect(again.state.setup.names[0]).toBe("Ada");
    expect(again.state.setup.hintsEnabled).toBe(false);
    expect(again.state.setup.trollEnabled).toBe(true);
    expect(again.state.setup.trollRules.allImposters).toBe(true);
    expect(again.state.setup.lastWordEnabled).toBe(true);
  });
});

function namedGame(names: string[], lastWord = true): GameController {
  const game = seededController();
  names.forEach((name, index) => {
    if (index >= game.state.setup.names.length) game.addPlayer();
    game.setName(index, name);
  });
  if (lastWord) game.setLastWord(true);
  return game;
}

function flipAll(game: GameController): void {
  const count = game.state.round!.assignments.length;
  for (let i = 0; i < count; i++) {
    game.tapCard();
    game.tapCard();
    game.nextPlayer();
  }
}

function unanimousVote(game: GameController, target: number, fallback: number): void {
  const voters = game.state.play.aliveIndexes.length;
  for (let i = 0; i < voters; i++) {
    const voter = game.state.play.aliveIndexes[game.state.play.vote!.voterIndex]!;
    game.selectVoteTarget(voter === target ? fallback : target);
    expect(game.nextPlayer()).toBe(true);
  }
}

function finishEject(game: GameController): void {
  expect(game.state.screen).toBe("eject");
  let guard = 0;
  while (game.state.play.eject && game.state.play.eject.phase !== "ready" && guard < 8) {
    game.advanceEjectPhase();
    guard += 1;
  }
  expect(game.state.play.eject?.phase).toBe("ready");
  game.continueEject();
}

describe("Last Word controller", () => {
  it("keeps Reveal the round when Last Word is off", () => {
    const game = namedGame(["Ada", "Bob", "Cara"], false);
    expect(game.state.setup.lastWordEnabled).toBe(false);
    game.startRound();
    flipAll(game);
    expect(game.state.screen).toBe("start");
    expect(game.openVote()).toBe(false);
    expect(game.state.screen).toBe("start");
    game.openRecap();
    expect(game.state.screen).toBe("recap");
    expect(game.state.play.outcome).toBe(null);
  });

  it("opens a secret vote from Start when Last Word is on", () => {
    const game = namedGame(["Ada", "Bob", "Cara"]);
    game.startRound();
    flipAll(game);
    game.openRecap();
    expect(game.state.screen).toBe("start");
    expect(game.openVote()).toBe(true);
    expect(game.state.screen).toBe("vote");
    expect(game.state.play.vote?.voterIndex).toBe(0);
    expect(game.state.play.vote?.tiedIndexes).toBe(null);
    expect(game.nextPlayer()).toBe(false);
    game.selectVoteTarget(0);
    expect(game.state.play.vote?.selectedIndex).toBe(null);
    game.selectVoteTarget(1);
    expect(game.state.play.vote?.selectedIndex).toBe(1);
    expect(game.nextPlayer()).toBe(true);
    expect(game.state.play.vote?.voterIndex).toBe(1);
    expect(game.state.play.vote?.selectedIndex).toBe(null);
  });

  it("ejects a unique winner after the last ballot", () => {
    const game = namedGame(["Ada", "Bob", "Cara"]);
    game.startRound();
    expect(game.state.round!.assignments[1]!.role).toBe("imposter");
    flipAll(game);
    game.openVote();
    unanimousVote(game, 1, 0);
    expect(game.state.screen).toBe("eject");
    expect(game.state.play.eject?.index).toBe(1);
  });

  it("restarts a tie from the first alive player with only the tied names", () => {
    const game = namedGame(["Ada", "Bob", "Cara"]);
    game.startRound();
    flipAll(game);
    game.openVote();
    game.selectVoteTarget(1);
    game.nextPlayer();
    game.selectVoteTarget(2);
    game.nextPlayer();
    game.selectVoteTarget(0);
    game.nextPlayer();
    expect(game.state.screen).toBe("vote");
    expect(game.state.play.vote?.voterIndex).toBe(0);
    expect(game.state.play.vote?.ballots).toEqual({});
    expect(game.state.play.vote?.tiedIndexes).toEqual([0, 1, 2]);
    game.selectVoteTarget(1);
    game.nextPlayer();
    game.selectVoteTarget(2);
    game.nextPlayer();
    game.selectVoteTarget(1);
    game.nextPlayer();
    expect(game.state.screen).toBe("eject");
    expect(game.state.play.eject?.index).toBe(1);
  });

  it("awards imposters the win after a 5-player civilian eject", () => {
    const game = namedGame(["Ada", "Bob", "Cara", "Dee", "Eve"]);
    game.startRound();
    expect(game.state.round!.assignments[0]!.role).toBe("civilian");
    flipAll(game);
    game.openVote();
    unanimousVote(game, 0, 1);
    finishEject(game);
    expect(game.state.screen).toBe("recap");
    expect(game.state.play.outcome).toBe("imposters");
    expect(game.state.play.lastWordGuess).toBe(null);
  });

  it("runs one extra clue round after the first 6-player civilian eject", () => {
    const game = namedGame(["Ada", "Bob", "Cara", "Dee", "Eve", "Fay"]);
    game.startRound();
    expect(game.state.round!.assignments.length).toBe(6);
    expect(game.state.round!.assignments[0]!.role).toBe("civilian");
    flipAll(game);
    game.openVote();
    unanimousVote(game, 0, 1);
    finishEject(game);
    expect(game.state.screen).toBe("start");
    expect(game.state.play.aliveIndexes).toEqual([1, 2, 3, 4, 5]);
    expect(game.state.play.aliveIndexes).toContain(game.state.round!.starterIndex);
    expect(game.state.round!.starterIndex).not.toBe(0);
    expect(game.state.play.civilianEjectCount).toBe(1);
    game.openVote();
    unanimousVote(game, 2, 1);
    finishEject(game);
    expect(game.state.screen).toBe("recap");
    expect(game.state.play.outcome).toBe("imposters");
  });

  it("sends an ejected imposter to Last Word and scores a match or miss", () => {
    const game = namedGame(["Ada", "Bob", "Cara"]);
    game.startRound();
    const word = game.state.round!.secretWord;
    expect(word).not.toBe(null);
    flipAll(game);
    game.openVote();
    unanimousVote(game, 1, 0);
    finishEject(game);
    expect(game.state.screen).toBe("lastWord");
    expect(game.state.play.lastWord?.guesserIndex).toBe(1);
    game.setLastWordDraft("nope");
    game.submitLastWord();
    expect(game.state.screen).toBe("recap");
    expect(game.state.play.outcome).toBe("civilians");
    expect(game.state.play.lastWordGuess).toBe("nope");

    const again = namedGame(["Ada", "Bob", "Cara"]);
    again.startRound();
    const secret = again.state.round!.secretWord!;
    flipAll(again);
    again.openVote();
    unanimousVote(again, 1, 0);
    finishEject(again);
    again.setLastWordDraft(`  ${secret.toUpperCase()}  `);
    again.submitLastWord();
    expect(again.state.play.outcome).toBe("imposters");

    const blank = namedGame(["Ada", "Bob", "Cara"]);
    blank.startRound();
    flipAll(blank);
    blank.openVote();
    unanimousVote(blank, 1, 0);
    finishEject(blank);
    blank.submitLastWord();
    expect(blank.state.play.outcome).toBe("civilians");
    expect(blank.state.play.lastWordGuess).toBe("");
  });

  it("skips Last Word and the winner line when everybody is the imposter", () => {
    const game = namedGame(["Ada", "Bob", "Cara"]);
    game.setTroll(true);
    game.setTrollRule("noImposters", false);
    game.setTrollRule("reverse", false);
    game.startRound();
    expect(game.state.round?.trollRule).toBe("allImposters");
    expect(game.state.round?.secretWord).toBe(null);
    flipAll(game);
    game.openVote();
    unanimousVote(game, 0, 1);
    finishEject(game);
    expect(game.state.screen).toBe("recap");
    expect(game.state.play.outcome).toBe(null);
    expect(game.state.play.lastWord).toBe(null);
  });

  it("awards imposters the win when the Double Agent is ejected", () => {
    const game = namedGame(["Ada", "Bob", "Cara", "Dee"]);
    game.setTroll(true);
    game.setTrollRule("allImposters", false);
    game.setTrollRule("noImposters", false);
    game.setTrollRule("reverse", false);
    game.setTrollRule("doubleAgent", true);
    game.startRound();
    expect(game.state.round?.trollRule).toBe("doubleAgent");
    expect(game.state.round!.assignments[0]!.role).toBe("doubleAgent");
    flipAll(game);
    game.openVote();
    unanimousVote(game, 0, 1);
    expect(game.state.play.eject?.phase).toBe("falling");
    game.advanceEjectPhase();
    expect(game.state.play.eject?.phase).toBe("verdict");
    game.advanceEjectPhase();
    expect(game.state.play.eject?.phase).toBe("daReveal");
    game.advanceEjectPhase();
    expect(game.state.play.eject?.phase).toBe("ready");
    game.continueEject();
    expect(game.state.screen).toBe("recap");
    expect(game.state.play.outcome).toBe("imposters");
    expect(game.state.play.lastWordGuess).toBe(null);
  });

  it("restores setup when quitting from the vote screen", () => {
    const game = namedGame(["Ada", "Bob", "Cara"]);
    game.startRound();
    flipAll(game);
    game.openVote();
    game.requestQuit();
    expect(game.state.confirmQuit).toBe(true);
    game.confirmQuit();
    expect(game.state.screen).toBe("setup");
    expect(game.state.round).toBe(null);
    expect(game.state.setup.names.slice(0, 3)).toEqual(["Ada", "Bob", "Cara"]);
    expect(game.state.setup.lastWordEnabled).toBe(true);
  });
});
