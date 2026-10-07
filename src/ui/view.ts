import type { GameController } from "../controller.ts";
import { escapeHtml } from "../html.ts";
import { effectivePlayerCount } from "../names.ts";
import { clampImposterCount } from "../imposters.ts";
import { canPressNext, trollRecapLine } from "../round.ts";
import { skinForSlot } from "../skins.ts";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type AppState,
  type Assignment,
  type TrollRuleId,
} from "../types.ts";
import { validateSetup, visibleNameError } from "../validation.ts";

function quitButton(): string {
  return `<button class="quit" type="button" data-action="quit" aria-label="End this round">×</button>`;
}

function confirmModal(): string {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="quit-title">
      <div class="dialog">
        <h2 id="quit-title">End this round?</h2>
        <p>Names and settings stay. Roles for this round are discarded.</p>
        <div class="dialog-actions">
          <button class="secondary-btn" type="button" data-action="cancel-quit">Keep playing</button>
          <button class="primary-btn" type="button" data-action="confirm-quit">End round</button>
        </div>
      </div>
    </div>
  `;
}

function switchControl(id: string, checked: boolean, action: string): string {
  return `
    <label class="switch">
      <span class="sr-only">${escapeHtml(id)}</span>
      <input id="${escapeHtml(id)}" type="checkbox" data-action="${escapeHtml(action)}" ${checked ? "checked" : ""} />
      <span></span>
    </label>
  `;
}

function setupView(
  state: AppState,
  packCategories: Array<{ id: string; name: string }>,
): string {
  const validation = validateSetup(state.setup);
  const showEmpty = validation.uniqueNameCount > 0 && validation.uniqueNameCount < MIN_PLAYERS;
  const n = effectivePlayerCount(state.setup.names);
  const maxImposters = clampImposterCount(n - 1, n);
  const startDisabled = !validation.canStart;
  const { accordion } = state.setup;

  const playerRows = state.setup.names
    .map((name, index) => {
      const error = visibleNameError(validation.nameErrors[index] ?? null, showEmpty);
      return `
        <div class="player-row">
          <input
            id="name-${index}"
            type="text"
            maxlength="16"
            autocomplete="off"
            spellcheck="false"
            placeholder="Player ${index + 1}"
            value="${escapeHtml(name)}"
            data-action="name"
            data-index="${index}"
            class="${error ? "error" : ""}"
            aria-invalid="${error ? "true" : "false"}"
            aria-describedby="${error ? `name-error-${index}` : ""}"
          />
          <button
            class="icon-btn"
            type="button"
            data-action="remove-player"
            data-index="${index}"
            aria-label="Remove player"
            ${state.setup.names.length <= MIN_PLAYERS ? "disabled" : ""}
          >−</button>
          ${error ? `<p class="field-error" id="name-error-${index}">${escapeHtml(error)}</p>` : ""}
        </div>
      `;
    })
    .join("");

  const categoryRows = packCategories
    .map((category) => {
      const on = state.setup.enabledCategoryIds.includes(category.id);
      return `
        <label class="check-row">
          <input type="checkbox" data-action="toggle-category" data-id="${escapeHtml(category.id)}" ${on ? "checked" : ""} />
          <span class="grow">${escapeHtml(category.name)}</span>
        </label>
      `;
    })
    .join("");

  const trollRule = (id: TrollRuleId, label: string) => `
    <label class="check-row">
      <input type="checkbox" data-action="troll-rule" data-id="${id}" ${state.setup.trollRules[id] ? "checked" : ""} />
      <span class="grow">${label}</span>
    </label>
  `;

  return `
    <section class="screen setup">
      <h1 class="title">Imposter Who?</h1>
      <section class="accordion ${accordion.players ? "open" : ""}">
        <button class="accordion-head" type="button" data-action="accordion" data-section="players" aria-expanded="${accordion.players}">
          Players <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="accordion-body">
          ${playerRows}
          <button class="ghost-btn" type="button" data-action="add-player" ${state.setup.names.length >= MAX_PLAYERS ? "disabled" : ""}>Add player</button>
          <p class="hint">Imposters</p>
          <div class="stepper">
            <button class="icon-btn" type="button" data-action="imposters-dec" aria-label="Fewer imposters" ${state.setup.imposterCount <= 1 ? "disabled" : ""}>−</button>
            <div class="stepper-value" aria-live="polite">${state.setup.imposterCount}</div>
            <button class="icon-btn" type="button" data-action="imposters-inc" aria-label="More imposters" ${state.setup.imposterCount >= maxImposters ? "disabled" : ""}>+</button>
          </div>
          <div class="toggle-row">
            <span>Auto</span>
            ${switchControl("auto-imposters", state.setup.autoImposters, "toggle-auto")}
          </div>
        </div>
      </section>
      <section class="accordion ${accordion.categories ? "open" : ""}">
        <button class="accordion-head" type="button" data-action="accordion" data-section="categories" aria-expanded="${accordion.categories}">
          Categories <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="accordion-body">
          ${categoryRows}
          ${validation.categoryError ? `<p class="field-error">Turn on at least one category.</p>` : ""}
        </div>
      </section>
      <section class="accordion ${accordion.modes ? "open" : ""}">
        <button class="accordion-head" type="button" data-action="accordion" data-section="modes" aria-expanded="${accordion.modes}">
          Modes <span class="chevron" aria-hidden="true"></span>
        </button>
        <div class="accordion-body">
          <div class="toggle-row">
            <span>Imposter hints</span>
            ${switchControl("hints", state.setup.hintsEnabled, "toggle-hints")}
          </div>
          <div class="toggle-row">
            <span>Troll mode</span>
            ${switchControl("troll", state.setup.trollEnabled, "toggle-troll")}
          </div>
          ${
            state.setup.trollEnabled
              ? `<div class="sub-rules">
                  ${trollRule("allImposters", "All Imposters")}
                  ${trollRule("noImposters", "No Imposters")}
                  ${trollRule("reverse", "Reverse")}
                </div>`
              : ""
          }
        </div>
      </section>
      <div class="sticky-start">
        <button class="primary-btn" type="button" data-action="start" ${startDisabled ? "disabled" : ""}>Start</button>
      </div>
    </section>
  `;
}

function assignmentCopy(
  assignment: Assignment,
  secretWord: string | null,
  hintsEnabled: boolean,
): string {
  if (assignment.role === "civilian") {
    return `
      <p class="card-kicker">The word is</p>
      <p class="card-word">${escapeHtml(secretWord ?? "")}</p>
    `;
  }
  const hint =
    hintsEnabled && assignment.hint
      ? `<p class="card-kicker">Hint:</p><p class="card-hint-word">${escapeHtml(assignment.hint)}</p>`
      : "";
  return `
    <p class="card-role">You are the imposter.</p>
    ${hint}
  `;
}

function flipView(state: AppState): string {
  const round = state.round;
  if (!round) return "";
  const assignment = round.assignments[state.flip.playerIndex];
  if (!assignment) return "";
  const skin = skinForSlot(state.flip.playerIndex);
  const nextOn = canPressNext(state.flip.hasFlipped, state.flip.faceDown);
  const helper = nextOn
    ? "Pass the device to the next player."
    : "Flip your card, then hide it to continue.";
  return `
    <section class="screen flip">
      ${quitButton()}
      <div class="card-scene">
        <button
          class="card ${state.flip.faceDown ? "" : "is-flipped"}"
          type="button"
          data-action="flip"
          aria-label="${state.flip.faceDown ? "Tap to flip" : "Hide card"}"
        >
          <div class="card-inner">
            <div class="card-face back skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}" ${state.flip.faceDown ? "" : "aria-hidden=\"true\""}>
              <p class="card-name">${escapeHtml(assignment.name)}</p>
              <p class="card-prompt">Tap to flip.</p>
            </div>
            <div class="card-face front skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}" ${state.flip.faceDown ? "aria-hidden=\"true\"" : ""}>
              ${assignmentCopy(assignment, round.secretWord, state.setup.hintsEnabled)}
            </div>
          </div>
        </button>
      </div>
      <button class="full-btn" type="button" data-action="next" ${nextOn ? "" : "disabled"} aria-disabled="${nextOn ? "false" : "true"}">Next</button>
      <p class="helper">${helper}</p>
    </section>
  `;
}

function startView(state: AppState): string {
  const round = state.round;
  if (!round) return "";
  const starter = round.assignments[round.starterIndex];
  if (!starter) return "";
  return `
    <section class="screen start">
      ${quitButton()}
      <div class="start-block">
        <p class="start-name">${escapeHtml(starter.name)}</p>
        <p class="start-line">starts.</p>
        <p class="hint">Clue-giving begins with them.</p>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" data-action="new-round">New round</button>
        <button class="secondary-btn" type="button" data-action="setup">Setup</button>
        <button class="secondary-btn" type="button" data-action="recap">Reveal the round</button>
      </div>
    </section>
  `;
}

function recapView(state: AppState): string {
  const round = state.round;
  if (!round) return "";
  const wordBlock = round.secretWord
    ? `<p class="hint">The word was</p><p class="recap-word">${escapeHtml(round.secretWord)}</p>`
    : `<p class="recap-word">This round had no secret word.</p>`;
  const troll = trollRecapLine(round.trollRule);
  const rows = round.assignments
    .map(
      (a) => `
        <li>
          <span>${escapeHtml(a.name)}</span>
          <span>${a.role === "imposter" ? "Imposter" : "Civilian"}</span>
        </li>
      `,
    )
    .join("");
  return `
    <section class="screen recap">
      ${quitButton()}
      <div class="recap-block">
        ${wordBlock}
        ${troll ? `<p class="troll-line">${escapeHtml(troll)}</p>` : ""}
        <ul class="recap-list">${rows}</ul>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" data-action="new-round">New round</button>
        <button class="secondary-btn" type="button" data-action="setup">Setup</button>
      </div>
    </section>
  `;
}

export function renderApp(game: GameController): string {
  const { state } = game;
  const body =
    state.screen === "setup"
      ? setupView(state, game.pack.categories)
      : state.screen === "flip"
        ? flipView(state)
        : state.screen === "start"
          ? startView(state)
          : recapView(state);
  return `${body}${state.confirmQuit ? confirmModal() : ""}`;
}
