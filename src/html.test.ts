import { describe, expect, it } from "./testkit.ts";
import { escapeHtml } from "./html.ts";

describe("escapeHtml", () => {
  it("escapes markup in player names", () => {
    expect(escapeHtml(`<img src="x" onerror="alert(1)">`)).toBe(
      `&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;`,
    );
  });
});
