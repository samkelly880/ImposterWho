import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "../testkit.ts";
import { GameController } from "../controller.ts";
import { memoryStorage } from "../storage.ts";
import { renderApp } from "./view.ts";

const appCss = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../styles/app.css"),
  "utf8",
);

function game(): GameController {
  return new GameController({ storage: memoryStorage(), random: () => 0 });
}

describe("setup markup", () => {
  it("disables Start until three unique names exist", () => {
    const g = game();
    expect(renderApp(g)).toContain("data-action=\"start\"");
    expect(renderApp(g)).toMatch(/data-action="start" disabled/);
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    expect(renderApp(g)).not.toMatch(/data-action="start" disabled/);
  });

  it("opens Players and keeps Categories and Modes closed by default", () => {
    const html = renderApp(game());
    expect(html).toMatch(/accordion open[\s\S]*Players/);
    expect(html).toMatch(/aria-expanded="false"[\s\S]*Categories/);
    expect(html).toMatch(/aria-expanded="false"[\s\S]*Modes/);
  });

  it("shows troll sub-rules only after Troll is enabled", () => {
    const g = game();
    expect(renderApp(g)).not.toContain("All Imposters");
    expect(renderApp(g)).not.toContain("Double Agent");
    g.setTroll(true);
    const html = renderApp(g);
    expect(html).toContain("All Imposters");
    expect(html).toContain("No Imposters");
    expect(html).toContain("Reverse");
    expect(html).toContain("Double Agent");
    expect(html).toMatch(/data-id="allImposters"[^>]*checked/);
    expect(html).toMatch(/data-id="doubleAgent"(?! checked)/);
  });

  it("names mode switches with their visible labels", () => {
    const html = renderApp(game());
    expect(html).toContain('aria-label="Auto"');
    expect(html).toContain('aria-label="Imposter hints"');
    expect(html).toContain('aria-label="Troll mode"');
    expect(html).not.toContain('aria-label="auto-imposters"');
    expect(html).not.toContain("sr-only\">auto-imposters");
    expect(html).not.toContain("sr-only\">hints");
    expect(html).not.toContain("sr-only\">troll");
  });
});

function startedGame(hintsEnabled = true): GameController {
  const g = game();
  g.setName(0, "Ada");
  g.setName(1, "Bob");
  g.setName(2, "Cara");
  g.setHints(hintsEnabled);
  g.startRound();
  return g;
}

function advanceToPlayer(g: GameController, index: number): void {
  while (g.state.flip.playerIndex < index) {
    g.tapCard();
    g.tapCard();
    g.nextPlayer();
  }
}

function renderCurrentPlayer(g: GameController, index: number): string {
  advanceToPlayer(g, index);
  return renderApp(g);
}

function playerIndexWithRole(
  g: GameController,
  role: "imposter" | "civilian" | "doubleAgent",
): number {
  const index = g.state.round!.assignments.findIndex((assignment) => assignment.role === role);
  expect(index).toBeGreaterThan(-1);
  return index;
}

function armDoubleAgentOnly(g: GameController): void {
  g.setTroll(true);
  g.setTrollRule("allImposters", false);
  g.setTrollRule("noImposters", false);
  g.setTrollRule("reverse", false);
  g.setTrollRule("doubleAgent", true);
}

function doubleAgentGame(names = ["Ada", "Bob", "Cara", "Dee"]): GameController {
  const g = game();
  names.forEach((name, index) => g.setName(index, name));
  armDoubleAgentOnly(g);
  g.startRound();
  return g;
}

describe("flip markup", () => {
  it("shows the player name, tap prompt, and a disabled Next", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.startRound();
    const html = renderApp(g);
    expect(html).toContain("Ada");
    expect(html).toContain("Tap to flip.");
    expect(html).toContain('aria-disabled="true"');
    const role = g.state.round!.assignments[0]!.role;
    if (role === "imposter") {
      expect(html).toContain("You are the imposter.");
      expect(html).toContain("Hint:");
    } else {
      expect(html).toContain("The word is");
    }
  });

  it("hides the secret face in CSS until the card is flipped", () => {
    expect(appCss).toMatch(/\.card:not\(\.is-flipped\)\s+\.card-face\.front\s*\{[^}]*visibility:\s*hidden/);
    expect(appCss).toMatch(/\.card-face\.front\s*\{[^}]*translateZ/);
  });

  it("lets the revealed word name the face-up card", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.startRound();
    expect(renderApp(g)).toContain('aria-label="Tap to flip"');
    g.tapCard();
    const html = renderApp(g);
    const flipOpen = html.match(/data-action="flip"[^>]*>/);
    expect(flipOpen).not.toBeNull();
    expect(flipOpen![0]).not.toContain("aria-label");
    expect(html).not.toContain('aria-label="Hide card"');
    const role = g.state.round!.assignments[0]!.role;
    if (role === "imposter") {
      expect(html).toContain("You are the imposter.");
      expect(html).toMatch(/class="card-face front[^"]*"(?![^>]*aria-hidden)/);
    } else {
      expect(html).toContain("The word is");
      expect(html).toMatch(/class="card-face front[^"]*"(?![^>]*aria-hidden)/);
    }
  });

  it("enables Next after flip and hide", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.startRound();
    g.tapCard();
    expect(renderApp(g)).toContain('aria-disabled="true"');
    g.tapCard();
    expect(renderApp(g)).toContain('aria-disabled="false"');
  });
});

describe("start and recap markup", () => {
  it("names the starter without revealing the category", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.startRound();
    for (let i = 0; i < 3; i++) {
      g.tapCard();
      g.tapCard();
      g.nextPlayer();
    }
    const html = renderApp(g);
    const starter = g.state.round!.assignments[g.state.round!.starterIndex]!.name;
    expect(html).toContain(starter);
    expect(html).toContain("starts.");
    expect(html).not.toContain("Food");
    expect(html).not.toContain("category");
    g.openRecap();
    const recap = renderApp(g);
    expect(recap).not.toContain("Hint:");
    expect(recap).not.toContain("Food");
    expect(recap).toMatch(/Imposter|Civilian/);
  });

  it("does not mention the double agent on the public start screen", () => {
    const g = doubleAgentGame();
    expect(g.state.round?.trollRule).toBe("doubleAgent");
    for (let i = 0; i < g.state.round!.assignments.length; i++) {
      g.tapCard();
      g.tapCard();
      g.nextPlayer();
    }
    const html = renderApp(g);
    expect(html).toContain("starts.");
    expect(html).not.toContain("Double Agent");
    expect(html).not.toContain("double agent");
    expect(html).not.toContain("This round had a Double Agent.");
  });
});

describe("imposter flip-card type", () => {
  it("marks only the revealed front as is-imposter and keeps role, Hint:, then hint word", () => {
    const g = startedGame();
    const index = playerIndexWithRole(g, "imposter");
    const html = renderCurrentPlayer(g, index);
    const hint = g.state.round!.assignments[index]!.hint;
    expect(hint).not.toBeNull();
    expect(html).toMatch(/class="card-face front is-imposter\b/);
    expect(html).not.toMatch(/class="card-face back[^"]*is-imposter/);
    expect(html).toMatch(
      /class="card-role">You are the imposter\.<\/p>\s*<p class="card-hint-label">Hint:<\/p>\s*<p class="card-hint-word fit-line">/,
    );
    expect(html).toContain(`class="card-hint-word fit-line">${hint}</p>`);
    expect(html).not.toMatch(/class="card-kicker">Hint:/);
  });

  it("leaves civilian fronts on the kicker and word hierarchy without is-imposter", () => {
    const g = startedGame();
    const index = playerIndexWithRole(g, "civilian");
    const html = renderCurrentPlayer(g, index);
    expect(html).not.toMatch(/class="card-face front[^"]*is-imposter/);
    expect(html).toContain('class="card-kicker">The word is</p>');
    expect(html).toMatch(/class="card-word fit-line">/);
    expect(html).not.toContain("card-hint-label");
    expect(html).not.toContain("You are the imposter.");
  });

  it("keeps the red imposter front and large role line when hints are off", () => {
    const g = startedGame(false);
    const index = playerIndexWithRole(g, "imposter");
    const html = renderCurrentPlayer(g, index);
    expect(html).toMatch(/class="card-face front is-imposter\b/);
    expect(html).toContain('class="card-role">You are the imposter.</p>');
    expect(html).not.toContain("Hint:");
    expect(html).not.toContain("card-hint-label");
    expect(html).not.toContain("card-hint-word");
  });

  it("styles the imposter type larger than Hint: and the hint word, on a solid red front", () => {
    expect(appCss).toMatch(/\.card-role\s*\{[^}]*font-family:\s*Fraunces/);
    expect(appCss).toMatch(/\.card-role\s*\{[^}]*clamp\(2rem,\s*9vw,\s*3rem\)/);
    expect(appCss).toMatch(/\.card-role\s*\{[^}]*font-weight:\s*800/);
    expect(appCss).toMatch(/\.card-role\s*\{[^}]*word-break:\s*break-word/);
    expect(appCss).toMatch(/\.card-hint-label\s*\{[^}]*font-weight:\s*400/);
    expect(appCss).toMatch(/\.card-hint-word\s*\{[^}]*clamp\(1\.25rem,\s*5vw,\s*1\.8rem\)/);
    expect(appCss).toMatch(
      /\.card-face\.front\.is-imposter\s*\{[^}]*background:\s*#d1263d/,
    );
    expect(appCss).toMatch(/\.card-kicker\s*\{[^}]*font-weight:\s*700/);
    expect(appCss).toMatch(/\.card-word\s*\{[^}]*clamp\(2rem,\s*9vw,\s*3rem\)/);
    expect(appCss).not.toMatch(/\.card-word,\s*\n?\s*\.card-hint-word/);
  });
});

describe("double agent flip and recap", () => {
  it("shows the word, role, and imposter names on a civilian-looking card", () => {
    const g = doubleAgentGame();
    const index = playerIndexWithRole(g, "doubleAgent");
    const da = g.state.round!.assignments[index]!;
    const imposters = g.state.round!.assignments
      .filter((assignment) => assignment.role === "imposter")
      .map((assignment) => assignment.name);
    expect(da.hint).toBe(null);
    expect(imposters).toEqual(["Bob"]);
    const html = renderCurrentPlayer(g, index);
    expect(html).not.toMatch(/class="card-face front[^"]*is-imposter/);
    expect(html).toContain('class="card-kicker">The word is</p>');
    expect(html).toMatch(/class="card-word fit-line">/);
    expect(html).toContain(g.state.round!.secretWord!);
    expect(html).toContain('class="card-da-role">You are the double agent.</p>');
    expect(html).toContain('class="card-da-intel fit-line">The imposter is Bob.</p>');
    expect(html).not.toContain("You are the imposter.");
    expect(html).not.toContain("Hint:");
    expect(html).not.toContain("card-hint-label");
    expect(html).not.toMatch(/class="card-da-role[^"]*fit-line/);
  });

  it("keeps civilian and imposter cards free of double-agent intel", () => {
    const g = doubleAgentGame();
    const civilianHtml = renderCurrentPlayer(g, playerIndexWithRole(g, "civilian"));
    expect(civilianHtml).toContain('class="card-kicker">The word is</p>');
    expect(civilianHtml).not.toContain("You are the double agent.");
    expect(civilianHtml).not.toContain("The imposter is");
    expect(civilianHtml).not.toContain("card-da-role");
    expect(civilianHtml).not.toContain("You are the imposter.");

    const imposterGame = doubleAgentGame();
    const imposterHtml = renderCurrentPlayer(
      imposterGame,
      playerIndexWithRole(imposterGame, "imposter"),
    );
    expect(imposterHtml).toContain("You are the imposter.");
    expect(imposterHtml).toMatch(/class="card-face front is-imposter\b/);
    expect(imposterHtml).not.toContain("You are the double agent.");
    expect(imposterHtml).not.toContain("The imposter is");
    expect(imposterHtml).not.toContain("card-da-intel");
  });

  it("names two imposters in player order on the double-agent card", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.setName(3, "Dee");
    g.addPlayer();
    g.setName(4, "Eve");
    g.setAuto(false);
    g.bumpImposters(1);
    armDoubleAgentOnly(g);
    g.startRound();
    expect(g.state.setup.imposterCount).toBe(2);
    expect(g.state.round?.trollRule).toBe("doubleAgent");
    const imposters = g.state.round!.assignments
      .filter((assignment) => assignment.role === "imposter")
      .map((assignment) => assignment.name);
    expect(imposters).toEqual(["Bob", "Cara"]);
    const html = renderCurrentPlayer(g, playerIndexWithRole(g, "doubleAgent"));
    expect(html).toContain("The imposters are Bob and Cara.");
  });

  it("reveals the double agent and team line only on recap", () => {
    const g = doubleAgentGame();
    const daName = g.state.round!.assignments.find((a) => a.role === "doubleAgent")!.name;
    for (let i = 0; i < g.state.round!.assignments.length; i++) {
      g.tapCard();
      g.tapCard();
      g.nextPlayer();
    }
    g.openRecap();
    const recap = renderApp(g);
    expect(recap).toContain("This round had a Double Agent.");
    expect(recap).toContain("The double agent was on the imposters' team.");
    expect(recap).toMatch(
      new RegExp(`<span>${daName}</span>\\s*<span>Double Agent</span>`),
    );
    expect(recap).toContain("Imposter");
    expect(recap).toContain("Civilian");
  });

  it("styles the double-agent role as UI type and the intel line like a hint word", () => {
    expect(appCss).toMatch(/\.card-da-role\s*\{[^}]*font-weight:\s*400/);
    expect(appCss).toMatch(/\.card-da-role\s*\{[^}]*font-size:\s*1rem/);
    expect(appCss).toMatch(/\.card-da-intel\s*\{[^}]*font-family:\s*Fraunces/);
    expect(appCss).toMatch(/\.card-da-intel\s*\{[^}]*clamp\(1\.25rem,\s*5vw,\s*1\.8rem\)/);
    expect(appCss).toMatch(/\.card-da-intel\s*\{[^}]*font-weight:\s*800/);
    expect(appCss).toMatch(/\.card-da-intel\s*\{[^}]*var\(--fit-line-bleed/);
    expect(appCss).not.toMatch(/\.card-da-role\s*\{[^}]*word-break/);
    expect(appCss).not.toMatch(/\.card-da-intel\s*\{[^}]*word-break/);
  });
});

describe("fit-line markup and CSS", () => {
  it("adds fit-line to overflow targets and leaves the role wrapping", () => {
    const civilianGame = startedGame();
    const civilianHtml = renderCurrentPlayer(
      civilianGame,
      playerIndexWithRole(civilianGame, "civilian"),
    );
    expect(civilianHtml).toMatch(/class="card-word fit-line"/);
    expect(civilianHtml).toMatch(/class="card-name fit-line"/);
    expect(civilianHtml).not.toMatch(/class="card-role[^"]*fit-line/);

    const imposterGame = startedGame();
    const imposterHtml = renderCurrentPlayer(
      imposterGame,
      playerIndexWithRole(imposterGame, "imposter"),
    );
    expect(imposterHtml).toMatch(/class="card-hint-word fit-line"/);
    expect(imposterHtml).toContain('class="card-role">You are the imposter.</p>');
    expect(imposterHtml).not.toMatch(/class="card-role[^"]*fit-line/);

    const startGame = startedGame();
    for (let i = 0; i < startGame.state.round!.assignments.length; i++) {
      startGame.tapCard();
      startGame.tapCard();
      startGame.nextPlayer();
    }
    expect(renderApp(startGame)).toMatch(/class="start-name fit-line"/);
    startGame.openRecap();
    expect(renderApp(startGame)).toMatch(/class="recap-word fit-line"/);
  });

  it("keeps fit-line on the All Imposters recap line", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.setTroll(true);
    g.setTrollRule("noImposters", false);
    g.setTrollRule("reverse", false);
    g.startRound();
    expect(g.state.round?.secretWord).toBe(null);
    for (let i = 0; i < g.state.round!.assignments.length; i++) {
      g.tapCard();
      g.tapCard();
      g.nextPlayer();
    }
    g.openRecap();
    const recap = renderApp(g);
    expect(recap).toContain("This round had no secret word.");
    expect(recap).toMatch(/class="recap-word fit-line"/);
  });

  it("sets nowrap clipping on fit-line and drops word-break from shrink targets", () => {
    expect(appCss).toMatch(/\.fit-line\s*\{[^}]*white-space:\s*nowrap/);
    expect(appCss).toMatch(/\.fit-line\s*\{[^}]*overflow:\s*hidden/);
    expect(appCss).toMatch(/\.fit-line\s*\{[^}]*width:\s*100%/);
    expect(appCss).not.toMatch(/\.card-word\s*\{[^}]*word-break/);
    expect(appCss).not.toMatch(/\.card-hint-word\s*\{[^}]*word-break/);
    expect(appCss).not.toMatch(/\.card-name\s*\{[^}]*word-break/);
    expect(appCss).not.toMatch(/\.start-name\s*\{[^}]*word-break/);
    expect(appCss).toMatch(/\.card-role\s*\{[^}]*word-break:\s*break-word/);
  });

  it("expands the fit-line clip box so Fraunces descenders are not sliced", () => {
    expect(appCss).toMatch(/--fit-line-bleed:\s*0\.25em/);
    expect(appCss).toMatch(/\.fit-line\s*\{[^}]*overflow:\s*hidden/);
    expect(appCss).toMatch(/\.fit-line\s*\{[^}]*padding-block:\s*var\(--fit-line-bleed\)/);
    expect(appCss).toMatch(/\.card-name\s*\{[^}]*var\(--fit-line-bleed/);
    expect(appCss).toMatch(/\.card-word\s*\{[^}]*var\(--fit-line-bleed/);
    expect(appCss).toMatch(/\.card-hint-word\s*\{[^}]*var\(--fit-line-bleed/);
    expect(appCss).toMatch(/\.card-da-intel\s*\{[^}]*var\(--fit-line-bleed/);
    expect(appCss).toMatch(/\.start-name\s*\{[^}]*var\(--fit-line-bleed/);
    expect(appCss).toMatch(/\.recap-word\s*\{[^}]*var\(--fit-line-bleed/);
  });
});

describe("end-round dialog markup", () => {
  it("marks the board inert and lists Keep playing first", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.startRound();
    g.requestQuit();
    const html = renderApp(g);
    expect(html).toMatch(/<section class="screen flip"[^>]*\binert\b/);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    const keepIndex = html.indexOf('data-action="cancel-quit"');
    const endIndex = html.indexOf('data-action="confirm-quit"');
    expect(keepIndex).toBeGreaterThan(0);
    expect(endIndex).toBeGreaterThan(keepIndex);
  });
});
