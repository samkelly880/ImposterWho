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
    g.setTroll(true);
    const html = renderApp(g);
    expect(html).toContain("All Imposters");
    expect(html).toContain("No Imposters");
    expect(html).toContain("Reverse");
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
});
