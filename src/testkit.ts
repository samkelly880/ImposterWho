import assert from "node:assert/strict";
export { describe, it } from "node:test";

type Matcher = {
  toBe(expected: unknown): void;
  toEqual(expected: unknown): void;
  toHaveLength(length: number): void;
  toContain(item: unknown): void;
  toMatch(pattern: RegExp | string): void;
  toBeTruthy(): void;
  toBeUndefined(): void;
  toBeNull(): void;
  toBeGreaterThan(n: number): void;
  not: {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toContain(item: unknown): void;
    toMatch(pattern: RegExp | string): void;
    toBeNull(): void;
  };
};

export function expect(actual: unknown): Matcher {
  const asArray = (): unknown[] => {
    assert.ok(Array.isArray(actual) || typeof actual === "string", "expected an array or string");
    return actual as unknown[];
  };
  return {
    toBe(expected) {
      assert.equal(actual, expected);
    },
    toEqual(expected) {
      assert.deepEqual(actual, expected);
    },
    toHaveLength(length) {
      assert.equal(asArray().length, length);
    },
    toContain(item) {
      if (typeof actual === "string") {
        assert.ok(actual.includes(String(item)), `expected "${actual}" to contain ${String(item)}`);
        return;
      }
      assert.ok(asArray().includes(item), `expected ${JSON.stringify(actual)} to contain ${String(item)}`);
    },
    toMatch(pattern) {
      const re = typeof pattern === "string" ? new RegExp(pattern) : pattern;
      assert.match(String(actual), re);
    },
    toBeTruthy() {
      assert.ok(actual);
    },
    toBeUndefined() {
      assert.equal(actual, undefined);
    },
    toBeNull() {
      assert.equal(actual, null);
    },
    toBeGreaterThan(n) {
      assert.ok(typeof actual === "number" && actual > n, `expected ${String(actual)} > ${n}`);
    },
    not: {
      toBe(expected) {
        assert.notEqual(actual, expected);
      },
      toEqual(expected) {
        assert.notDeepEqual(actual, expected);
      },
      toContain(item) {
        if (typeof actual === "string") {
          assert.ok(!actual.includes(String(item)));
          return;
        }
        assert.ok(!asArray().includes(item));
      },
      toMatch(pattern) {
        const re = typeof pattern === "string" ? new RegExp(pattern) : pattern;
        assert.doesNotMatch(String(actual), re);
      },
      toBeNull() {
        assert.notEqual(actual, null);
      },
    },
  };
}
