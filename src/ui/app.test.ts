import { describe, expect, it } from "../testkit.ts";
import { GameController } from "../controller.ts";
import { memoryStorage } from "../storage.ts";
import { ejectSceneKey, paint, shouldPreserveEjectScene, trapDialogTab } from "./app.ts";

function game(): GameController {
  return new GameController({ storage: memoryStorage(), random: () => 0 });
}

describe("setup paint focus", () => {
  it("keeps the nickname caret after paint replaces the setup tree", () => {
    const live = {
      id: "name-0",
      selectionStart: 2,
      selectionEnd: 2,
    };
    const restored = {
      focused: false,
      preventScroll: false,
      selectionStart: 0,
      selectionEnd: 0,
      focus(options?: { preventScroll?: boolean }) {
        this.focused = true;
        this.preventScroll = Boolean(options?.preventScroll);
      },
      setSelectionRange(start: number, end: number) {
        this.selectionStart = start;
        this.selectionEnd = end;
      },
    };
    const root = {
      html: "",
      replaced: false,
      contains(node: object) {
        if (this.replaced) return false;
        return node === live;
      },
      querySelector(selector: string) {
        return selector === "#name-0" ? restored : null;
      },
      set innerHTML(value: string) {
        this.html = value;
        this.replaced = true;
      },
      get innerHTML() {
        return this.html;
      },
    };
    paint(root, game(), live);
    expect(root.html).toContain('id="name-0"');
    expect(restored.focused).toBe(true);
    expect(restored.preventScroll).toBe(true);
    expect(restored.selectionStart).toBe(2);
    expect(restored.selectionEnd).toBe(2);
  });
});

function startedGame(): GameController {
  const g = game();
  g.setName(0, "Ada");
  g.setName(1, "Bob");
  g.setName(2, "Cara");
  g.startRound();
  return g;
}

describe("Last Word paint focus", () => {
  it("keeps the Last Word guess caret after paint", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.setLastWord(true);
    g.startRound();
    for (let i = 0; i < 3; i++) {
      g.tapCard();
      g.tapCard();
      g.nextPlayer();
    }
    g.openVote();
    for (let i = 0; i < 3; i++) {
      const voter = g.state.play.aliveIndexes[g.state.play.vote!.voterIndex]!;
      g.tapCard();
      g.selectVoteTarget(voter === 1 ? 0 : 1);
      g.nextPlayer();
    }
    while (g.state.play.eject && g.state.play.eject.phase !== "ready") {
      g.advanceEjectPhase();
    }
    g.continueEject();
    expect(g.state.screen).toBe("lastWord");
    g.setLastWordDraft("ic");
    const live = {
      id: "last-word-guess",
      selectionStart: 2,
      selectionEnd: 2,
    };
    const restored = {
      focused: false,
      preventScroll: false,
      selectionStart: 0,
      selectionEnd: 0,
      focus(options?: { preventScroll?: boolean }) {
        this.focused = true;
        this.preventScroll = Boolean(options?.preventScroll);
      },
      setSelectionRange(start: number, end: number) {
        this.selectionStart = start;
        this.selectionEnd = end;
      },
    };
    const root = {
      html: "",
      replaced: false,
      contains(node: object) {
        if (this.replaced) return false;
        return node === live;
      },
      querySelector(selector: string) {
        return selector === "#last-word-guess" ? restored : null;
      },
      set innerHTML(value: string) {
        this.html = value;
        this.replaced = true;
      },
      get innerHTML() {
        return this.html;
      },
    };
    paint(root, g, live);
    expect(root.html).toContain('id="last-word-guess"');
    expect(restored.focused).toBe(true);
    expect(restored.selectionStart).toBe(2);
    expect(restored.selectionEnd).toBe(2);
  });
});

describe("kick-out scene key", () => {
  it("stays the same when End round opens and does not preserve across a phase change", () => {
    const g = game();
    g.setName(0, "Ada");
    g.setName(1, "Bob");
    g.setName(2, "Cara");
    g.setLastWord(true);
    g.startRound();
    for (let i = 0; i < 3; i++) {
      g.tapCard();
      g.tapCard();
      g.nextPlayer();
    }
    g.openVote();
    for (let i = 0; i < 3; i++) {
      const voter = g.state.play.aliveIndexes[g.state.play.vote!.voterIndex]!;
      g.tapCard();
      g.selectVoteTarget(voter === 1 ? 0 : 1);
      g.nextPlayer();
    }
    expect(g.state.screen).toBe("eject");
    const falling = ejectSceneKey(g);
    expect(falling).toMatch(/:falling$/);
    expect(shouldPreserveEjectScene(null, falling)).toBe(false);
    g.requestQuit();
    expect(ejectSceneKey(g)).toBe(falling);
    expect(shouldPreserveEjectScene(falling, ejectSceneKey(g))).toBe(true);
    g.cancelQuit();
    expect(ejectSceneKey(g)).toBe(falling);
    g.advanceEjectPhase();
    expect(shouldPreserveEjectScene(falling, ejectSceneKey(g))).toBe(false);
  });
});

describe("end-round dialog focus", () => {
  it("moves focus to Keep playing when the dialog opens", () => {
    const keep = {
      focused: false,
      preventScroll: false,
      focus(options?: { preventScroll?: boolean }) {
        this.focused = true;
        this.preventScroll = Boolean(options?.preventScroll);
      },
    };
    const root = {
      html: "",
      contains() {
        return false;
      },
      querySelector(selector: string) {
        return selector === '[data-action="cancel-quit"]' ? keep : null;
      },
      set innerHTML(value: string) {
        this.html = value;
      },
      get innerHTML() {
        return this.html;
      },
    };
    const g = startedGame();
    g.requestQuit();
    paint(root, g, null);
    expect(root.html).toContain("Keep playing");
    expect(keep.focused).toBe(true);
    expect(keep.preventScroll).toBe(true);
  });

  it("wraps Tab inside the dialog buttons", () => {
    const keep = {
      focused: false,
      focus() {
        this.focused = true;
      },
    };
    const end = {
      focused: false,
      focus() {
        this.focused = true;
      },
    };
    let prevented = false;
    trapDialogTab(
      {
        key: "Tab",
        shiftKey: false,
        preventDefault() {
          prevented = true;
        },
      },
      [keep, end],
      end,
    );
    expect(prevented).toBe(true);
    expect(keep.focused).toBe(true);
    expect(end.focused).toBe(false);

    keep.focused = false;
    prevented = false;
    trapDialogTab(
      {
        key: "Tab",
        shiftKey: true,
        preventDefault() {
          prevented = true;
        },
      },
      [keep, end],
      keep,
    );
    expect(prevented).toBe(true);
    expect(end.focused).toBe(true);
  });

  it("moves focus to the Quit button when Keep playing closes the dialog", () => {
    const quit = {
      focused: false,
      preventScroll: false,
      focus(options?: { preventScroll?: boolean }) {
        this.focused = true;
        this.preventScroll = Boolean(options?.preventScroll);
      },
    };
    const live = { id: "keep-playing" };
    const root = {
      html: "",
      replaced: false,
      contains(node: object) {
        if (this.replaced) return false;
        return node === live;
      },
      querySelector(selector: string) {
        return selector === '[data-action="quit"]' ? quit : null;
      },
      set innerHTML(value: string) {
        this.html = value;
        this.replaced = true;
      },
      get innerHTML() {
        return this.html;
      },
    };
    const g = startedGame();
    g.requestQuit();
    g.cancelQuit();
    paint(root, g, live);
    expect(root.html).toContain('data-action="quit"');
    expect(root.html).not.toContain("Keep playing");
    expect(quit.focused).toBe(true);
    expect(quit.preventScroll).toBe(true);
  });

  it("moves focus to the first name field when End round returns to setup", () => {
    const name = {
      focused: false,
      preventScroll: false,
      focus(options?: { preventScroll?: boolean }) {
        this.focused = true;
        this.preventScroll = Boolean(options?.preventScroll);
      },
    };
    const live = { id: "end-round" };
    const root = {
      html: "",
      replaced: false,
      contains(node: object) {
        if (this.replaced) return false;
        return node === live;
      },
      querySelector(selector: string) {
        return selector === "#name-0" ? name : null;
      },
      set innerHTML(value: string) {
        this.html = value;
        this.replaced = true;
      },
      get innerHTML() {
        return this.html;
      },
    };
    const g = startedGame();
    g.requestQuit();
    g.confirmQuit();
    paint(root, g, live);
    expect(root.html).toContain('id="name-0"');
    expect(name.focused).toBe(true);
    expect(name.preventScroll).toBe(true);
  });
});
