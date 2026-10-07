import { GameController } from "../controller.ts";
import type { TrollRuleId } from "../types.ts";
import { TROLL_RULES } from "../types.ts";
import { renderApp } from "./view.ts";

function isTrollRule(value: string): value is TrollRuleId {
  return (TROLL_RULES as string[]).includes(value);
}

export type FocusSnapshot = {
  id: string;
  start: number | null;
  end: number | null;
};

export type ActiveLike = {
  id?: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
};

export interface RenderRoot {
  innerHTML: string;
  contains(node: object): boolean;
  querySelector(selectors: string): unknown;
}

type RestoredLike = {
  focus(options?: { preventScroll?: boolean }): void;
  setSelectionRange?(start: number, end: number): void;
};

function escapeCssId(id: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(id);
  return id.replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function isRestored(value: unknown): value is RestoredLike {
  return typeof value === "object" && value !== null && typeof (value as RestoredLike).focus === "function";
}

export function snapshotFocus(root: RenderRoot, active: ActiveLike | null): FocusSnapshot | null {
  if (!active || typeof active.id !== "string" || active.id.length === 0) return null;
  if (!root.contains(active)) return null;
  return {
    id: active.id,
    start: typeof active.selectionStart === "number" ? active.selectionStart : null,
    end: typeof active.selectionEnd === "number" ? active.selectionEnd : null,
  };
}

export function applyFocusSnapshot(root: RenderRoot, snapshot: FocusSnapshot | null): void {
  if (!snapshot) return;
  const restored = root.querySelector(`#${escapeCssId(snapshot.id)}`);
  if (!isRestored(restored)) return;
  restored.focus({ preventScroll: true });
  if (snapshot.start != null && snapshot.end != null && typeof restored.setSelectionRange === "function") {
    restored.setSelectionRange(snapshot.start, snapshot.end);
  }
}

export function paint(
  root: HTMLElement | RenderRoot,
  game: GameController,
  active: ActiveLike | null,
): void {
  const host = root as RenderRoot;
  const snapshot = snapshotFocus(host, active);
  root.innerHTML = renderApp(game);
  applyFocusSnapshot(host, snapshot);
}

export function mount(root: HTMLElement, game: GameController): void {
  const redraw = (): void => {
    paint(root, game, document.activeElement);
  };

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action === "name") {
      const index = Number(target.dataset.index);
      if (Number.isInteger(index)) game.setName(index, target.value);
      redraw();
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const action = target.dataset.action;
    if (action === "toggle-auto") game.setAuto(target.checked);
    if (action === "toggle-hints") game.setHints(target.checked);
    if (action === "toggle-troll") game.setTroll(target.checked);
    if (action === "toggle-category" && target.dataset.id) {
      game.toggleCategory(target.dataset.id);
    }
    if (action === "troll-rule" && target.dataset.id && isTrollRule(target.dataset.id)) {
      game.setTrollRule(target.dataset.id, target.checked);
    }
    redraw();
  });

  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const control = target.closest<HTMLElement>("[data-action]");
    if (!control) return;
    if (control instanceof HTMLInputElement) return;
    const action = control.dataset.action;
    const index = Number(control.dataset.index);
    if (action === "accordion" && control.dataset.section) {
      const section = control.dataset.section;
      if (section === "players" || section === "categories" || section === "modes") {
        game.toggleAccordion(section);
      }
    }
    if (action === "add-player") game.addPlayer();
    if (action === "remove-player" && Number.isInteger(index)) game.removePlayer(index);
    if (action === "imposters-inc") game.bumpImposters(1);
    if (action === "imposters-dec") game.bumpImposters(-1);
    if (action === "start") game.startRound();
    if (action === "flip") game.tapCard();
    if (action === "next") game.nextPlayer();
    if (action === "new-round") game.newRound();
    if (action === "setup") game.backToSetup();
    if (action === "recap") game.openRecap();
    if (action === "quit") game.requestQuit();
    if (action === "cancel-quit") game.cancelQuit();
    if (action === "confirm-quit") game.confirmQuit();
    redraw();
  });

  redraw();
}
