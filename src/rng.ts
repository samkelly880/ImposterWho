export type Random = () => number;

export function createQueueRandom(values: number[]): Random {
  const queue = [...values];
  return () => {
    const next = queue.shift();
    if (next === undefined) {
      throw new Error("Random queue exhausted");
    }
    return next;
  };
}

export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) continue;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function pickIndex(length: number, random: Random): number {
  if (length <= 0) throw new Error("Cannot pick from empty list");
  return Math.floor(random() * length);
}

export function pickOne<T>(items: readonly T[], random: Random): T {
  const item = items[pickIndex(items.length, random)];
  if (item === undefined) throw new Error("Cannot pick from empty list");
  return item;
}

export function pickWeightedIndex(weights: readonly number[], random: Random): number {
  if (weights.length === 0) throw new Error("Cannot pick from empty weights");
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new Error("Weights must sum to a positive number");
  let cursor = random() * total;
  for (let i = 0; i < weights.length; i++) {
    cursor -= weights[i] ?? 0;
    if (cursor < 0) return i;
  }
  return weights.length - 1;
}
