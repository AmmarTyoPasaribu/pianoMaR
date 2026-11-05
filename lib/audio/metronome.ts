/**
 * Sample-accurate metronome using the Web Audio "lookahead" scheduling pattern:
 * a coarse JS timer schedules clicks slightly ahead on the audio clock, so timing
 * stays tight even when the main thread is busy.
 */
export class Metronome {
  bpm = 100;
  beats = 4;
  volume = 0.7;
  onBeat: ((beat: number) => void) | null = null;

  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextTime = 0;
  private beat = 0;
  private visualTimers = new Set<ReturnType<typeof setTimeout>>();

  get running() {
    return this.timer !== null;
  }

  start(ctx: AudioContext, destination: AudioNode) {
    this.stop();
    this.ctx = ctx;
    if (!this.out) {
      this.out = ctx.createGain();
      this.out.connect(destination);
    }
    this.out.gain.value = this.volume;
    this.beat = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const t of this.visualTimers) clearTimeout(t);
    this.visualTimers.clear();
  }

  setVolume(v: number) {
    this.volume = v;
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const beat = this.beat;
      this.click(this.nextTime, beat === 0);
      const delay = Math.max(0, (this.nextTime - ctx.currentTime) * 1000);
      const t = setTimeout(() => {
        this.visualTimers.delete(t);
        this.onBeat?.(beat);
      }, delay);
      this.visualTimers.add(t);
      this.nextTime += 60 / this.bpm;
      this.beat = (this.beat + 1) % Math.max(1, this.beats);
    }
  }

  /** A short woodblock-ish tick: a pitched blip plus a filtered noise transient. */
  private click(time: number, accent: boolean) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(accent ? 1760 : 1245, time);
    osc.frequency.exponentialRampToValueAtTime(accent ? 1200 : 900, time + 0.04);
    const g = ctx.createGain();
    const peak = accent ? 0.9 : 0.55;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(g);
    g.connect(this.out!);
    osc.start(time);
    osc.stop(time + 0.08);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }
}
