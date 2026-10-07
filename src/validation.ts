import { activeNames, duplicateKeys, isValidName, nameKey, trimName } from "./names.ts";
import { MAX_NAME_LENGTH, MIN_PLAYERS } from "./types.ts";
import type { SetupState } from "./types.ts";

export type NameError = "empty" | "duplicate" | "length" | null;

export type SetupValidation = {
  canStart: boolean;
  nameErrors: NameError[];
  categoryError: "none" | null;
  uniqueNameCount: number;
};

export function validateSetup(setup: SetupState): SetupValidation {
  const dups = duplicateKeys(setup.names);
  const filled = activeNames(setup.names);
  const nameErrors: NameError[] = setup.names.map((raw) => {
    const trimmed = trimName(raw);
    if (trimmed.length === 0) return "empty";
    if (trimmed.length > MAX_NAME_LENGTH || !isValidName(raw)) return "length";
    if (dups.has(nameKey(raw))) return "duplicate";
    return null;
  });

  const uniqueValid = new Set(
    filled.filter((name) => isValidName(name)).map(nameKey),
  );
  const uniqueNameCount = uniqueValid.size;

  const hasBlockingNameError = nameErrors.some((err, i) => {
    const trimmed = trimName(setup.names[i] ?? "");
    if (trimmed.length === 0) return false;
    return err === "duplicate" || err === "length";
  });

  const categoryError = setup.enabledCategoryIds.length === 0 ? "none" : null;
  const canStart =
    uniqueNameCount >= MIN_PLAYERS &&
    !hasBlockingNameError &&
    categoryError === null;

  return { canStart, nameErrors, categoryError, uniqueNameCount };
}

export function startReady(setup: SetupState): boolean {
  return validateSetup(setup).canStart;
}

export function nameErrorMessage(error: NameError): string | null {
  if (error === "duplicate") return "Names must be unique.";
  if (error === "length") return "Use 1–16 characters.";
  if (error === "empty") return "Enter a nickname.";
  return null;
}

export function visibleNameError(error: NameError, showEmpty: boolean): string | null {
  if (error === "empty") {
    return showEmpty ? nameErrorMessage("empty") : null;
  }
  return nameErrorMessage(error);
}
