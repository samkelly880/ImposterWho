import type { GameController } from "../controller.ts";
import { escapeHtml } from "../html.ts";
import { effectivePlayerCount } from "../names.ts";
import { clampImposterCount } from "../imposters.ts";
import {
  canPressNext,
  canSubmitVote,
  ejectDoubleAgentLine,
  ejectVerdictLine,
  formatImposterLine,
  recapEjectedLine,
  trollRecapLine,
  votePrompt,
  voteTargets,
} from "../round.ts";
import { skinForSlot } from "../skins.ts";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type AppState,
  type Assignment,
  type Role,
  type TrollRuleId,
} from "../types.ts";
import { validateSetup, visibleNameError } from "../validation.ts";

function quitButton(): string {
  return `<button class="quit" type="button" data-action="quit" aria-label="End this round">×</button>`;
}

export function confirmModal(): string {
  return `
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="quit-title">
      <div class="dialog">
        <h2 id="quit-title">End this round?</h2>
        <p>Names and settings stay. Roles for this round are discarded.</p>
        <div class="dialog-actions">
          <button id="keep-playing" class="secondary-btn" type="button" data-action="cancel-quit">Keep playing</button>
          <button id="end-round" class="primary-btn" type="button" data-action="confirm-quit">End round</button>
        </div>
      </div>
    </div>
  `;
}

function switchControl(id: string, checked: boolean, action: string, label: string): string {
  return `
    <label class="switch">
      <input id="${escapeHtml(id)}" type="checkbox" data-action="${escapeHtml(action)}" aria-label="${escapeHtml(label)}" ${checked ? "checked" : ""} />
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
            ${switchControl("auto-imposters", state.setup.autoImposters, "toggle-auto", "Auto")}
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
            ${switchControl("hints", state.setup.hintsEnabled, "toggle-hints", "Imposter hints")}
          </div>
          <div class="toggle-row">
            <span>Last Word</span>
            ${switchControl("last-word", state.setup.lastWordEnabled, "toggle-last-word", "Last Word")}
          </div>
          <div class="toggle-row">
            <span>Troll mode</span>
            ${switchControl("troll", state.setup.trollEnabled, "toggle-troll", "Troll mode")}
          </div>
          ${
            state.setup.trollEnabled
              ? `<div class="sub-rules">
                  ${trollRule("allImposters", "All Imposters")}
                  ${trollRule("noImposters", "No Imposters")}
                  ${trollRule("reverse", "Reverse")}
                  ${trollRule("doubleAgent", "Double Agent")}
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
  assignments: readonly Assignment[],
): string {
  if (assignment.role === "civilian") {
    return `
      <p class="card-kicker">The word is</p>
      <p class="card-word fit-line">${escapeHtml(secretWord ?? "")}</p>
    `;
  }
  if (assignment.role === "doubleAgent") {
    const imposters = assignments
      .filter((other) => other.role === "imposter")
      .map((other) => other.name);
    return `
      <p class="card-kicker">The word is</p>
      <p class="card-word fit-line">${escapeHtml(secretWord ?? "")}</p>
      <p class="card-da-role">You are the double agent.</p>
      <p class="card-da-intel fit-line">${escapeHtml(formatImposterLine(imposters))}</p>
    `;
  }
  const hint =
    hintsEnabled && assignment.hint
      ? `<p class="card-hint-label">Hint:</p><p class="card-hint-word fit-line">${escapeHtml(assignment.hint)}</p>`
      : "";
  return `
    <p class="card-role">You are the imposter.</p>
    ${hint}
  `;
}

function recapRoleLabel(role: Role): string {
  if (role === "imposter") return "Imposter";
  if (role === "doubleAgent") return "Double Agent";
  return "Civilian";
}

function flipView(state: AppState): string {
  const round = state.round;
  if (!round) return "";
  const assignment = round.assignments[state.flip.playerIndex];
  if (!assignment) return "";
  const skin = skinForSlot(state.flip.playerIndex);
  const frontRole = assignment.role === "imposter" ? " is-imposter" : "";
  const nextOn = canPressNext(state.flip.hasFlipped, state.flip.faceDown);
  const helper = nextOn
    ? "Pass the device to the next player."
    : "Flip your card, then hide it to continue.";
  return `
    <section class="screen flip"${state.confirmQuit ? " inert" : ""}>
      ${quitButton()}
      <div class="card-scene">
        <button
          class="card ${state.flip.faceDown ? "" : "is-flipped"}"
          type="button"
          data-action="flip"
          ${state.flip.faceDown ? 'aria-label="Tap to flip"' : ""}
        >
          <div class="card-inner">
            <div class="card-face back skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}" ${state.flip.faceDown ? "" : "aria-hidden=\"true\""}>
              <p class="card-name fit-line">${escapeHtml(assignment.name)}</p>
              <p class="card-prompt">Tap to flip.</p>
            </div>
            <div class="card-face front${frontRole} skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}" ${state.flip.faceDown ? "aria-hidden=\"true\"" : ""}>
              ${assignmentCopy(assignment, round.secretWord, state.setup.hintsEnabled, round.assignments)}
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
    <section class="screen start"${state.confirmQuit ? " inert" : ""}>
      ${quitButton()}
      <div class="start-block">
        <p class="start-name fit-line">${escapeHtml(starter.name)}</p>
        <p class="start-line">starts.</p>
        <p class="hint">Clue-giving begins with them.</p>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" data-action="new-round">New round</button>
        <button class="secondary-btn" type="button" data-action="setup">Setup</button>
        ${
          state.setup.lastWordEnabled
            ? `<button class="secondary-btn" type="button" data-action="vote">Vote</button>`
            : `<button class="secondary-btn" type="button" data-action="recap">Reveal the round</button>`
        }
      </div>
    </section>
  `;
}

function recapView(state: AppState): string {
  const round = state.round;
  if (!round) return "";
  const wordBlock = round.secretWord
    ? `<p class="hint">The word was</p><p class="recap-word fit-line">${escapeHtml(round.secretWord)}</p>`
    : `<p class="recap-word fit-line">This round had no secret word.</p>`;
  const troll = trollRecapLine(round.trollRule);
  const teamLine =
    round.trollRule === "doubleAgent"
      ? `<p class="troll-line">The double agent was on the imposters' team.</p>`
      : "";
  const lastWordOn = state.setup.lastWordEnabled;
  const winner =
    lastWordOn && state.play.outcome
      ? `<p class="winner-line">${state.play.outcome === "imposters" ? "Imposters win." : "Civilians win."}</p>`
      : "";
  const ejectedNames = lastWordOn
    ? state.play.ejected.map((entry) => round.assignments[entry.index]?.name ?? "")
    : [];
  const ejectedLine = recapEjectedLine(ejectedNames.filter(Boolean));
  const guesser = [...state.play.ejected].reverse().find((entry) => entry.role === "imposter");
  const guesserName = guesser ? round.assignments[guesser.index]?.name : null;
  const guess =
    lastWordOn && state.play.lastWordGuess !== null && guesserName
      ? `<p class="guess-line">${escapeHtml(guesserName)} guessed: ${escapeHtml(state.play.lastWordGuess)}</p>`
      : "";
  const rows = round.assignments
    .map(
      (a) => `
        <li>
          <span>${escapeHtml(a.name)}</span>
          <span>${recapRoleLabel(a.role)}</span>
        </li>
      `,
    )
    .join("");
  return `
    <section class="screen recap"${state.confirmQuit ? " inert" : ""}>
      ${quitButton()}
      <div class="recap-block">
        ${wordBlock}
        ${winner}
        ${troll ? `<p class="troll-line">${escapeHtml(troll)}</p>` : ""}
        ${teamLine}
        ${ejectedLine ? `<p class="ejected-line">${escapeHtml(ejectedLine)}</p>` : ""}
        ${guess}
        <ul class="recap-list">${rows}</ul>
      </div>
      <div class="actions">
        <button class="primary-btn" type="button" data-action="new-round">New round</button>
        <button class="secondary-btn" type="button" data-action="setup">Setup</button>
      </div>
    </section>
  `;
}

function voteView(state: AppState): string {
  const round = state.round;
  const vote = state.play.vote;
  if (!round || !vote) return "";
  const voterAssignmentIndex = state.play.aliveIndexes[vote.voterIndex];
  if (voterAssignmentIndex === undefined) return "";
  const voter = round.assignments[voterAssignmentIndex];
  if (!voter) return "";
  const skin = skinForSlot(voterAssignmentIndex);
  const nextOn = canSubmitVote(vote.hasFlipped, vote.selectedIndex);
  const prompt = votePrompt(vote.tiedIndexes);
  const targets = voteTargets(state.play.aliveIndexes, voterAssignmentIndex, vote.tiedIndexes);
  const picks = targets
    .map((index) => {
      const assignment = round.assignments[index];
      if (!assignment) return "";
      const selected = vote.selectedIndex === index;
      return `
        <button
          class="vote-pick${selected ? " is-selected" : ""}"
          type="button"
          data-action="vote-pick"
          data-index="${index}"
          aria-pressed="${selected ? "true" : "false"}"
        >
          <span class="fit-line">${escapeHtml(assignment.name)}</span>
        </button>
      `;
    })
    .join("");
  const helper = nextOn
    ? "Press Next to hide your vote and pass."
    : "Flip your card, pick someone, then press Next.";
  return `
    <section class="screen vote"${state.confirmQuit ? " inert" : ""}>
      ${quitButton()}
      <div class="card-scene">
        <div class="card ${vote.faceDown ? "" : "is-flipped"}">
          <div class="card-inner">
            <button
              class="card-face back skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}"
              type="button"
              data-action="flip"
              ${vote.faceDown ? 'aria-label="Tap to vote"' : 'aria-hidden="true"'}
            >
              <p class="card-name fit-line">${escapeHtml(voter.name)}</p>
              <p class="card-prompt">${escapeHtml(prompt)}</p>
            </button>
            <div class="card-face front skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}" ${vote.faceDown ? 'aria-hidden="true"' : ""}>
              <div class="vote-list">${picks}</div>
            </div>
          </div>
        </div>
      </div>
      <button class="full-btn" type="button" data-action="next" ${nextOn ? "" : "disabled"} aria-disabled="${nextOn ? "false" : "true"}">Next</button>
      <p class="helper">${helper}</p>
    </section>
  `;
}

function ejectView(state: AppState): string {
  const round = state.round;
  const eject = state.play.eject;
  if (!round || !eject) return "";
  const assignment = round.assignments[eject.index];
  if (!assignment) return "";
  const skin = skinForSlot(eject.index);
  const remainingRoles = state.play.aliveIndexes
    .filter((index) => index !== eject.index)
    .map((index) => round.assignments[index]?.role ?? "civilian");
  const verdict = ejectVerdictLine(assignment.name, assignment.role, remainingRoles);
  const daLine = ejectDoubleAgentLine(assignment.name);
  const falling = eject.phase === "falling";
  const isDa = assignment.role === "doubleAgent";
  let copy = "";
  if (!falling) {
    if (isDa && eject.phase === "verdict") {
      copy = `<p class="eject-verdict">${escapeHtml(verdict)}</p>`;
    } else if (isDa && eject.phase === "daReveal") {
      copy = `
        <p class="eject-verdict is-leaving">${escapeHtml(verdict)}</p>
        <p class="eject-verdict is-entering">${escapeHtml(daLine)}</p>
      `;
    } else if (isDa) {
      copy = `<p class="eject-verdict">${escapeHtml(daLine)}</p>`;
    } else {
      copy = `<p class="eject-verdict">${escapeHtml(verdict)}</p>`;
    }
  }
  return `
    <section class="screen eject"${state.confirmQuit ? " inert" : ""}>
      ${quitButton()}
      <div class="eject-stage">
        <div class="eject-card card-face back skin skin-${skin.color} pattern-${skin.pattern} skin-ink-${skin.ink}${falling ? " is-falling" : " is-gone"}">
          <p class="card-name fit-line">${escapeHtml(assignment.name)}</p>
        </div>
        <div class="eject-copy">${copy}</div>
      </div>
      ${
        eject.phase === "ready"
          ? `<button class="full-btn" type="button" data-action="eject-continue">Continue</button>`
          : ""
      }
    </section>
  `;
}

function lastWordView(state: AppState): string {
  const round = state.round;
  const lastWord = state.play.lastWord;
  if (!round || !lastWord) return "";
  const guesser = round.assignments[lastWord.guesserIndex];
  if (!guesser) return "";
  return `
    <section class="screen last-word"${state.confirmQuit ? " inert" : ""}>
      ${quitButton()}
      <div class="last-word-block">
        <p class="last-word-prompt fit-line">${escapeHtml(guesser.name)}, guess the word.</p>
        <input
          id="last-word-guess"
          type="text"
          maxlength="40"
          autocomplete="off"
          spellcheck="false"
          value="${escapeHtml(lastWord.draft)}"
          data-action="last-word"
          aria-label="Guess the word"
        />
        <button class="primary-btn" type="button" data-action="guess">Guess</button>
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
          : state.screen === "vote"
            ? voteView(state)
            : state.screen === "eject"
              ? ejectView(state)
              : state.screen === "lastWord"
                ? lastWordView(state)
                : recapView(state);
  return `${body}${state.confirmQuit ? confirmModal() : ""}`;
}
