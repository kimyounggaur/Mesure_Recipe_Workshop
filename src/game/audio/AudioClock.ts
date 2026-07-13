export type ScheduledNote = { startUnit: number; durationUnits: number; isRest: boolean };

export class AudioClock {
  private context: AudioContext | null = null;
  private bpm = 92;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
  }

  get secondsPerUnit() {
    return 60 / this.bpm / 4;
  }

  async unlock() {
    if (typeof window === "undefined") return;
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
  }

  now() {
    return this.context?.currentTime ?? performance.now() / 1000;
  }

  async playPattern(notes: ScheduledNote[], bars = 1, onComplete?: () => void) {
    await this.unlock();
    if (!this.context) return () => undefined;
    const start = this.context.currentTime + 0.06;
    const totalUnits = notes.reduce((sum, note) => Math.max(sum, note.startUnit + note.durationUnits), 0);
    const duration = totalUnits * this.secondsPerUnit * bars;

    for (let bar = 0; bar < bars; bar += 1) {
      const barOffset = bar * totalUnits;
      for (let beat = 0; beat < Math.max(1, Math.ceil(totalUnits / 4)); beat += 1) {
        this.scheduleTone(start + (barOffset + beat * 4) * this.secondsPerUnit, beat === 0 ? 920 : 560, 0.035, 0.045);
      }
      for (const note of notes) {
        if (note.isRest) continue;
        this.scheduleTone(start + (barOffset + note.startUnit) * this.secondsPerUnit, 740, 0.08, 0.06);
      }
    }

    const completeId = window.setTimeout(() => onComplete?.(), (duration + 0.1) * 1000);
    return () => window.clearTimeout(completeId);
  }

  click(kind: "soft" | "bright" = "soft") {
    if (!this.context || this.muted) return;
    this.scheduleTone(this.context.currentTime, kind === "bright" ? 1040 : 640, 0.045, kind === "bright" ? 0.1 : 0.06);
  }

  private scheduleTone(start: number, frequency: number, duration: number, gainAmount: number) {
    if (!this.context || this.muted) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(gainAmount, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }
}
