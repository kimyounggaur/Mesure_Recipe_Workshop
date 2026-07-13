import { NOTE_META, NoteValue, UNITS } from "../config";

export function drawStaff(canvas: HTMLCanvasElement, notes: NoteValue[], meterLabel: string, compact = false) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 760;
  const height = compact ? 170 : 250;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(dpr, dpr);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#fbf7ed";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "#a7a09a";
  context.lineWidth = 1.4;
  const top = compact ? 50 : 78;
  const lineGap = compact ? 12 : 16;
  for (let line = 0; line < 5; line += 1) {
    context.beginPath();
    context.moveTo(48, top + line * lineGap);
    context.lineTo(width - 32, top + line * lineGap);
    context.stroke();
  }

  context.fillStyle = "#242034";
  context.font = `${compact ? 24 : 34}px Georgia, serif`;
  context.fillText("𝄞", 14, top + lineGap * 3.4);
  context.font = `700 ${compact ? 18 : 22}px Inter, sans-serif`;
  context.fillText(meterLabel, 52, top - 18);
  context.fillStyle = "#d8875b";
  context.fillRect(width - 34, top - 6, 3, lineGap * 4 + 12);

  const usableWidth = Math.max(180, width - 118);
  const totalUnits = Math.max(16, notes.reduce((sum, note) => sum + UNITS[note], 0));
  const unitWidth = usableWidth / totalUnits;
  let cursor = 94;
  notes.forEach((note, index) => {
    const meta = NOTE_META[note];
    const noteWidth = Math.max(34, UNITS[note] * unitWidth);
    const x = cursor + noteWidth / 2;
    const y = top + lineGap * (index % 2 === 0 ? 1.3 : 2.7);
    context.fillStyle = "#242034";
    context.font = `${compact ? 27 : 38}px Georgia, serif`;
    context.fillText(meta.glyph, x - 12, y);
    if (!meta.isRest) {
      context.strokeStyle = meta.color;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(x + 9, y - 8);
      context.lineTo(x + 9, y - 42);
      context.stroke();
    }
    context.fillStyle = "#817b79";
    context.font = `${compact ? 10 : 12}px Inter, sans-serif`;
    context.fillText(`${index + 1}`, x - 3, height - 14);
    cursor += noteWidth;
  });
}
