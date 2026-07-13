export type NoteValue =
  | "whole"
  | "half"
  | "quarter"
  | "eighth"
  | "wholeRest"
  | "halfRest"
  | "quarterRest"
  | "eighthRest";

export type Meter = { beatsPerBar: number; beatUnit: 4 | 8 };

export type RecipeLevel = {
  id: number;
  name: string;
  lesson: string;
  prompt: string;
  meter: Meter;
  targetUnits: number;
  available: NoteValue[];
  requiredConcept: "fill-bar" | "include-rest" | "compare-values";
  acceptedPatterns?: NoteValue[][];
  locked?: boolean;
};

export const UNITS: Record<NoteValue, number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  wholeRest: 16,
  halfRest: 8,
  quarterRest: 4,
  eighthRest: 2,
};

export const NOTE_META: Record<NoteValue, { name: string; shortName: string; glyph: string; isRest: boolean; color: string }> = {
  whole: { name: "온음표", shortName: "온음", glyph: "𝅝", isRest: false, color: "#e3ad62" },
  half: { name: "2분음표", shortName: "2분", glyph: "𝅗𝅥", isRest: false, color: "#d98759" },
  quarter: { name: "4분음표", shortName: "4분", glyph: "♩", isRest: false, color: "#7c9bff" },
  eighth: { name: "8분음표", shortName: "8분", glyph: "♪", isRest: false, color: "#68b6a5" },
  wholeRest: { name: "온쉼표", shortName: "온쉼", glyph: "𝄻", isRest: true, color: "#9072c4" },
  halfRest: { name: "2분쉼표", shortName: "2분쉼", glyph: "𝄼", isRest: true, color: "#9072c4" },
  quarterRest: { name: "4분쉼표", shortName: "4분쉼", glyph: "𝄽", isRest: true, color: "#9072c4" },
  eighthRest: { name: "8분쉼표", shortName: "8분쉼", glyph: "𝄾", isRest: true, color: "#9072c4" },
};

export const METER_TARGETS: Record<string, number> = {
  "2/4": 8,
  "3/4": 12,
  "4/4": 16,
  "6/8": 12,
};

export const LEVELS: RecipeLevel[] = [
  {
    id: 1,
    name: "첫 레시피",
    lesson: "4분음표 4개",
    prompt: "4/4 한 마디를 네 개의 발걸음으로 채워 주세요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["quarter"],
    requiredConcept: "fill-bar",
    acceptedPatterns: [["quarter", "quarter", "quarter", "quarter"]],
  },
  {
    id: 2,
    name: "길이 섞기",
    lesson: "2분 + 4분",
    prompt: "긴 재료 하나와 짧은 재료 둘로 4박을 만들어 주세요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["half", "quarter"],
    requiredConcept: "compare-values",
    acceptedPatterns: [["half", "quarter", "quarter"], ["quarter", "half", "quarter"], ["quarter", "quarter", "half"]],
  },
  {
    id: 3,
    name: "한 재료 한 마디",
    lesson: "온음표",
    prompt: "온음표 하나가 마디 전체를 채우는지 확인해 보세요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["whole", "half", "quarter"],
    requiredConcept: "compare-values",
    acceptedPatterns: [["whole"]],
  },
  {
    id: 4,
    name: "쪼개진 발걸음",
    lesson: "8분음표",
    prompt: "8분음표 두 개는 1박과 같아요. 네 박을 채워 주세요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["eighth", "quarter", "half"],
    requiredConcept: "compare-values",
    acceptedPatterns: [["eighth", "eighth", "eighth", "eighth", "eighth", "eighth", "eighth", "eighth"]],
  },
  {
    id: 5,
    name: "침묵도 재료",
    lesson: "쉼표 포함",
    prompt: "소리와 침묵을 함께 넣어도 길이의 합은 4박이어야 해요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["half", "quarter", "quarterRest", "eighth"],
    requiredConcept: "include-rest",
    acceptedPatterns: [["half", "quarterRest", "quarter"], ["quarter", "quarterRest", "half"]],
  },
  {
    id: 6,
    name: "달라진 주문",
    lesson: "3/4 · 2/4",
    prompt: "박자표를 바꾸면 목표 길이도 달라져요. 이번엔 3/4예요.",
    meter: { beatsPerBar: 3, beatUnit: 4 },
    targetUnits: 12,
    available: ["half", "quarter", "quarterRest"],
    requiredConcept: "fill-bar",
    acceptedPatterns: [["half", "quarter"], ["quarter", "quarter", "quarter"], ["half", "quarterRest"]],
  },
  {
    id: 7,
    name: "듣고 조립",
    lesson: "리듬 듣기",
    prompt: "먼저 들은 리듬의 길이를 떠올리고 알맞은 재료를 고르세요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["whole", "half", "quarter", "eighth", "quarterRest"],
    requiredConcept: "compare-values",
  },
  {
    id: 8,
    name: "창작 주문",
    lesson: "서로 다른 마디",
    prompt: "조건을 만족하는 나만의 4박 마디를 완성해 보세요.",
    meter: { beatsPerBar: 4, beatUnit: 4 },
    targetUnits: 16,
    available: ["whole", "half", "quarter", "eighth", "quarterRest"],
    requiredConcept: "fill-bar",
  },
];

export function unitsToBeats(units: number) {
  return units / 4;
}

export function getMeterLabel(meter: Meter) {
  return `${meter.beatsPerBar}/${meter.beatUnit}`;
}
