import { describe, expect, it } from "../testkit.ts";
import { GameController } from "../controller.ts";
import { memoryStorage } from "../storage.ts";
import { paint } from "./app.ts";

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
