import { NoteValue, UNITS } from "../config";

export type BarCheck = {
  totalUnits: number;
  targetUnits: number;
  differenceUnits: number;
  status: "empty" | "short" | "over" | "exact";
};

export function calculateBar(notes: NoteValue[], targetUnits: number): BarCheck {
  const totalUnits = notes.reduce((sum, note) => sum + UNITS[note], 0);
  const differenceUnits = targetUnits - totalUnits;
  return {
    totalUnits,
    targetUnits,
    differenceUnits,
    status: totalUnits === 0 ? "empty" : differenceUnits === 0 ? "exact" : differenceUnits > 0 ? "short" : "over",
  };
}

export type TimingGrade = "Perfect" | "Good" | "Miss";

export function judgeTiming(deltaMs: number, latencyMs = 0): TimingGrade {
  const adjusted = Math.abs(deltaMs - latencyMs);
  if (adjusted <= 70) return "Perfect";
  if (adjusted <= 130) return "Good";
  return "Miss";
}

export function getNextTargetIndex(targets: number[], elapsedSeconds: number) {
  if (!targets.length) return -1;
  return targets.reduce((best, target, index) => {
    return Math.abs(target - elapsedSeconds) < Math.abs(targets[best] - elapsedSeconds) ? index : best;
  }, 0);
}

export function scoreTiming(grades: TimingGrade[]) {
  if (!grades.length) return 0;
  return Math.round((grades.reduce((sum, grade) => sum + (grade === "Perfect" ? 100 : grade === "Good" ? 70 : 0), 0) / grades.length));
}
