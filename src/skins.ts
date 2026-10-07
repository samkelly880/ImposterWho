export type Skin = {
  id: number;
  color: string;
  pattern: string;
  ink: "black" | "white";
};

export const SKINS: Skin[] = [
  { id: 0, color: "blue", pattern: "stripes", ink: "white" },
  { id: 1, color: "green", pattern: "dots", ink: "white" },
  { id: 2, color: "red", pattern: "grid", ink: "white" },
  { id: 3, color: "purple", pattern: "chevron", ink: "white" },
  { id: 4, color: "pink", pattern: "diamonds", ink: "black" },
  { id: 5, color: "brown", pattern: "waves", ink: "white" },
  { id: 6, color: "white", pattern: "plus", ink: "black" },
  { id: 7, color: "orange", pattern: "zigzag", ink: "black" },
  { id: 8, color: "yellow", pattern: "circles", ink: "black" },
  { id: 9, color: "grey", pattern: "hatch", ink: "black" },
  { id: 10, color: "blue", pattern: "bars", ink: "white" },
  { id: 11, color: "green", pattern: "hex", ink: "white" },
];

export function skinForSlot(index: number): Skin {
  const skin = SKINS[index % SKINS.length];
  if (!skin) return SKINS[0]!;
  return skin;
}
