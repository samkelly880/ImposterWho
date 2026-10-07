import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "./testkit.ts";
import { escapeHtml } from "./html.ts";

const servedHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../scripts/html.mjs"),
  "utf8",
);

describe("escapeHtml", () => {
  it("escapes markup in player names", () => {
    expect(escapeHtml(`<img src="x" onerror="alert(1)">`)).toBe(
      `&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;`,
    );
  });
});

describe("served fonts", () => {
  it("loads Nunito 400 so the Hint: label can be regular weight", () => {
    expect(servedHtml).toContain("Nunito:wght@400;");
  });
});
