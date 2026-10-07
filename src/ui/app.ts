import { GameController } from "../controller.ts";
import type { TrollRuleId } from "../types.ts";
import { TROLL_RULES } from "../types.ts";
import { renderApp } from "./view.ts";

function isTrollRule(value: string): value is TrollRuleId {
  return (TROLL_RULES as string[]).includes(value);
}

function restoreFocus(root: HTMLElement): void {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !root.contains(active)) return;
  const id = active.id;
  const start = active instanceof HTMLInputElement ? active.selectionStart : null;
  const end = active instanceof HTMLInputElement ? active.selectionEnd : null;
  const restored = id ? root.querySelector(`#${CSS.escape(id)}`) : null;
  if (restored instanceof HTMLInputElement) {
    restored.focus();
    if (start != null && end != null) restored.setSelectionRange(start, end);
  } else if (restored instanceof HTMLElement) {
    restored.focus();
  }
}

export function mount(root: HTMLElement, game: GameController): void {
  const paint = (): void => {
    root.innerHTML = renderApp(game);
    restoreFocus(root);
  };

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.dataset.action === "name") {
      const index = Number(target.dataset.index);
      if (Number.isInteger(index)) game.setName(index, target.value);
      paint();
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
    paint();
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
    paint();
  });

  paint();
}
