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

  it("restores setup from storage", () => {
    const storage = memoryStorage();
    const game = new GameController({ storage, random: () => 0 });
    game.setName(0, "Ada");
    game.setHints(false);
    game.setTroll(true);
    const again = new GameController({ storage, random: () => 0 });
    expect(again.state.setup.names[0]).toBe("Ada");
    expect(again.state.setup.hintsEnabled).toBe(false);
    expect(again.state.setup.trollEnabled).toBe(true);
    expect(again.state.setup.trollRules.allImposters).toBe(true);
  });
});
