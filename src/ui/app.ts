import { GameController } from "../controller.ts";
import type { TrollRuleId } from "../types.ts";
import { TROLL_RULES } from "../types.ts";
import { fitLineElements } from "./fit-line.ts";
import { confirmModal, renderApp } from "./view.ts";

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

export type TabLike = {
  key: string;
  shiftKey: boolean;
  preventDefault(): void;
};

export function trapDialogTab(
  event: TabLike,
  buttons: RestoredLike[],
  active: object | null,
): void {
  if (event.key !== "Tab" || buttons.length === 0) return;
  const first = buttons[0]!;
  const last = buttons[buttons.length - 1]!;
  const inside = buttons.includes(active as RestoredLike);
  if (event.shiftKey && (active === first || !inside)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
    return;
  }
  if (!event.shiftKey && (active === last || !inside)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function isDialogButton(id: string | undefined): boolean {
  return id === "keep-playing" || id === "end-round";
}

function focusQuitDialog(root: RenderRoot, snapshot: FocusSnapshot | null): void {
  const keep = root.querySelector('[data-action="cancel-quit"]');
  if (isRestored(keep)) {
    if (isDialogButton(snapshot?.id)) return;
    keep.focus({ preventScroll: true });
    return;
  }
  if (!isDialogButton(snapshot?.id)) return;
  const quit = root.querySelector('[data-action="quit"]');
  if (isRestored(quit)) {
    quit.focus({ preventScroll: true });
    return;
  }
  const firstName = root.querySelector("#name-0");
  if (isRestored(firstName)) firstName.focus({ preventScroll: true });
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
  focusQuitDialog(host, snapshot);
  fitLineElements(root);
}

export function ejectSceneKey(game: GameController): string | null {
  const eject = game.state.play.eject;
  if (game.state.screen !== "eject" || !eject) return null;
  return `${eject.index}:${eject.phase}`;
}

export function shouldPreserveEjectScene(
  previousKey: string | null,
  nextKey: string | null,
): boolean {
  return previousKey !== null && previousKey === nextKey;
}

export function syncQuitOverlay(
  root: HTMLElement,
  game: GameController,
  active: ActiveLike | null,
): void {
  const host = root as HTMLElement & RenderRoot;
  const snapshot = snapshotFocus(host, active);
  const section = root.querySelector("section.screen");
  if (section instanceof HTMLElement) {
    if (game.state.confirmQuit) section.setAttribute("inert", "");
    else section.removeAttribute("inert");
  }
  const existing = root.querySelector(".modal");
  if (game.state.confirmQuit && !existing) {
    root.insertAdjacentHTML("beforeend", confirmModal());
  } else if (!game.state.confirmQuit && existing) {
    existing.remove();
  }
  applyFocusSnapshot(host, snapshot);
  focusQuitDialog(host, snapshot);
}

function prefersReducedMotion(): boolean {
  return (
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function mount(root: HTMLElement, game: GameController): void {
  let ejectTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  let lastEjectKey: string | null = null;
  const clearEjectTimer = (): void => {
    if (ejectTimer !== undefined) {
      globalThis.clearTimeout(ejectTimer);
      ejectTimer = undefined;
    }
  };
  const armEject = (): void => {
    const key = ejectSceneKey(game);
    if (key === lastEjectKey) return;
    clearEjectTimer();
    lastEjectKey = key;
    const eject = game.state.play.eject;
    if (game.state.screen !== "eject" || !eject) return;
    const phase = eject.phase;
    if (phase === "falling") {
      if (prefersReducedMotion()) {
        game.advanceEjectPhase();
        paint(root, game, document.activeElement);
        armEject();
        return;
      }
      ejectTimer = globalThis.setTimeout(() => {
        if (game.state.play.eject?.phase === "falling") {
          game.advanceEjectPhase();
          paint(root, game, document.activeElement);
          armEject();
        }
      }, 1600);
      return;
    }
    if (phase === "verdict" || phase === "daReveal") {
      ejectTimer = globalThis.setTimeout(() => {
        if (game.state.play.eject?.phase !== phase) return;
        game.advanceEjectPhase();
        paint(root, game, document.activeElement);
        armEject();
      }, 700);
    }
  };
  const redraw = (): void => {
    const key = ejectSceneKey(game);
    if (shouldPreserveEjectScene(lastEjectKey, key) && root.querySelector(".eject-card")) {
      syncQuitOverlay(root, game, document.activeElement);
      return;
    }
    paint(root, game, document.activeElement);
    armEject();
  };
  const refit = (): void => {
    fitLineElements(root);
  };

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(refit).observe(root);
  }
  if (typeof document !== "undefined" && document.fonts) {
    void document.fonts.ready.then(refit);
    document.fonts.addEventListener("loadingdone", refit);
  }

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action === "name") {
      const index = Number(target.dataset.index);
      if (Number.isInteger(index)) game.setName(index, target.value);
      redraw();
    }
    if (target.dataset.action === "last-word") {
      game.setLastWordDraft(target.value);
      redraw();
    }
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const action = target.dataset.action;
    if (action === "toggle-auto") game.setAuto(target.checked);
    if (action === "toggle-hints") game.setHints(target.checked);
    if (action === "toggle-last-word") game.setLastWord(target.checked);
    if (action === "toggle-troll") game.setTroll(target.checked);
    if (action === "toggle-category" && target.dataset.id) {
      game.toggleCategory(target.dataset.id);
    }
    if (action === "troll-rule" && target.dataset.id && isTrollRule(target.dataset.id)) {
      game.setTrollRule(target.dataset.id, target.checked);
    }
    redraw();
  });

  root.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    const dialog = root.querySelector('[role="dialog"]');
    if (!(dialog instanceof HTMLElement)) return;
    const buttons = [...dialog.querySelectorAll("button")];
    trapDialogTab(event, buttons, document.activeElement);
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
    if (action === "vote") game.openVote();
    if (action === "vote-pick" && Number.isInteger(index)) game.selectVoteTarget(index);
    if (action === "eject-continue") game.continueEject();
    if (action === "guess") game.submitLastWord();
    if (action === "quit") game.requestQuit();
    if (action === "cancel-quit") game.cancelQuit();
    if (action === "confirm-quit") game.confirmQuit();
    redraw();
  });

  root.addEventListener("animationend", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.classList.contains("eject-card")) return;
    if (event.animationName !== "eject-fall") return;
    if (game.state.play.eject?.phase !== "falling") return;
    game.advanceEjectPhase();
    redraw();
  });

  redraw();
}
