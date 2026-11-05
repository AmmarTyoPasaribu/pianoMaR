/**
 * The single place every input (computer keyboard, pointer/touch, MIDI device,
 * recording playback) goes through. It keeps track of which source holds which key,
 * talks to the audio engine, records performances, and broadcasts events that the
 * UI (key highlights, visualizer, note display) listens to.
 *
 * Deliberately framework-free: per-note work never goes through React state.
 */

import { AudioEngine } from "../audio/engine";
import { getInstrument } from "../audio/instruments";
import { Metronome } from "../audio/metronome";
import { buildMidiFile, type RecEvent } from "../midi/smf";

export type Transport = "idle" | "recording" | "playing";

export type PianoEvent =
  | { type: "on"; key: number; midi: number; velocity: number; source: string }
  | { type: "off"; key: number; midi: number; sustained: boolean }
  | { type: "sustain"; on: boolean }
  | { type: "transpose"; value: number }
  | { type: "transport"; state: Transport; startedAt: number; takeDuration: number | null }
  | { type: "beat"; beat: number }
  | { type: "reset" };

export interface Take {
  events: RecEvent[];
  duration: number;
  instrumentId: string;
  bpm: number;
  beats: number;
  metronome: boolean;
}

type Listener = (e: PianoEvent) => void;

export class PianoController {
  readonly engine = new AudioEngine();
  readonly metronome = new Metronome();

  transpose = 0;
  /** Sustain starts on (toggle mode); hold mode switches it off on load. */
  sustain = true;
  /** Velocity used for keyboard / mouse / touch input. */
  velocity = 84;

  private listeners = new Set<Listener>();
  private holders = new Map<number, Set<string>>();
  private sourceKey = new Map<string, number>();
  private sounding = new Map<number, number>();

  private rec: { start: number; events: RecEvent[] } | null = null;
  private playback: { timer: ReturnType<typeof setInterval>; prevSustain: boolean } | null = null;
  take: Take | null = null;
  transport: Transport = "idle";

  constructor() {
    this.metronome.onBeat = (beat) => this.emit({ type: "beat", beat });
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(e: PianoEvent) {
    for (const fn of this.listeners) fn(e);
  }

  /** Keys (on-screen positions) currently held down, with the pitch they sound. */
  heldNotes(): number[] {
    return [...this.sounding.values()];
  }

  // ------------------------------------------------------------------ notes

  press(source: string, key: number, velocity = this.velocity, soundingMidi?: number) {
    if (this.sourceKey.has(source)) this.release(source);
    this.sourceKey.set(source, key);
    let set = this.holders.get(key);
    if (!set) this.holders.set(key, (set = new Set()));
    const first = set.size === 0;
    set.add(source);
    if (!first) return;

    const midi = soundingMidi ?? key + this.transpose;
    this.sounding.set(key, midi);
    this.engine.noteOn(midi, velocity);
    this.record({ type: "on", midi, velocity });
    this.emit({ type: "on", key, midi, velocity, source });
  }

  release(source: string) {
    const key = this.sourceKey.get(source);
    if (key === undefined) return;
    this.sourceKey.delete(source);
    const set = this.holders.get(key);
    if (!set) return;
    set.delete(source);
    if (set.size) return;
    this.holders.delete(key);

    const midi = this.sounding.get(key);
    this.sounding.delete(key);
    if (midi === undefined) return;
    this.engine.noteOff(midi);
    this.record({ type: "off", midi });
    this.emit({ type: "off", key, midi, sustained: this.sustain });
  }

  /** Release every source whose id starts with the prefix ("kb:", "ptr:", "midi:"...). */
  releaseWhere(prefix = "") {
    for (const source of [...this.sourceKey.keys()]) if (source.startsWith(prefix)) this.release(source);
  }

  setSustain(on: boolean) {
    if (on === this.sustain) return;
    this.sustain = on;
    this.engine.setSustain(on);
    this.record({ type: "sustain", on });
    this.emit({ type: "sustain", on });
  }

  setTranspose(value: number) {
    const v = Math.max(-12, Math.min(12, Math.round(value)));
    if (v === this.transpose) return;
    this.releaseWhere("");
    this.engine.releaseAll();
    this.transpose = v;
    this.emit({ type: "transpose", value: v });
    this.emit({ type: "reset" });
  }

  /** Lost focus, tab hidden, etc.: never leave keys stuck down. */
  releaseInputs() {
    this.releaseWhere("kb:");
    this.releaseWhere("ptr:");
  }

  // ------------------------------------------------------------------ recording

  private record(e: { type: "on"; midi: number; velocity: number } | { type: "off"; midi: number } | { type: "sustain"; on: boolean }) {
    if (!this.rec) return;
    this.rec.events.push({ ...e, t: performance.now() - this.rec.start } as RecEvent);
  }

  private setTransport(state: Transport, startedAt = performance.now()) {
    this.transport = state;
    this.emit({ type: "transport", state, startedAt, takeDuration: this.take?.duration ?? null });
  }

  startRecording() {
    this.stopPlayback();
    this.rec = { start: performance.now(), events: [] };
    if (this.sustain) this.rec.events.push({ t: 0, type: "sustain", on: true });
    // Notes already held when recording starts count from zero.
    for (const midi of this.sounding.values()) this.rec.events.push({ t: 0, type: "on", midi, velocity: this.velocity });
    this.setTransport("recording", this.rec.start);
  }

  stopRecording() {
    const rec = this.rec;
    if (!rec) return;
    this.rec = null;
    const end = performance.now() - rec.start;
    const events = rec.events;
    // Close any notes / pedal still down so the take is self-contained.
    const open = new Set<number>();
    let pedal = false;
    for (const e of events) {
      if (e.type === "on") open.add(e.midi);
      else if (e.type === "off") open.delete(e.midi);
      else pedal = e.on;
    }
    for (const midi of open) events.push({ t: end, type: "off", midi });
    if (pedal) events.push({ t: end, type: "sustain", on: false });

    const hasNotes = events.some((e) => e.type === "on");
    this.take = hasNotes
      ? {
          events,
          duration: end,
          instrumentId: this.engine.instrument.id,
          bpm: this.metronome.bpm,
          beats: this.metronome.beats,
          metronome: this.metronome.running,
        }
      : this.take;
    this.setTransport("idle");
  }

  play() {
    const take = this.take;
    if (!take) return;
    if (this.rec) this.stopRecording();
    this.stopPlayback();

    const events = [...take.events].sort((a, b) => a.t - b.t);
    const t0 = performance.now() + 60;
    let i = 0;
    const prevSustain = this.sustain;
    const tick = () => {
      const elapsed = performance.now() - t0;
      while (i < events.length && events[i].t <= elapsed) {
        const e = events[i++];
        if (e.type === "on") this.press(`play:${e.midi}`, e.midi - this.transpose, e.velocity, e.midi);
        else if (e.type === "off") this.release(`play:${e.midi}`);
        else this.setSustain(e.on);
      }
      if (i >= events.length && elapsed >= take.duration) this.stopPlayback();
    };
    this.playback = { timer: setInterval(tick, 5), prevSustain };
    this.setTransport("playing", t0);
  }

  stopPlayback() {
    const pb = this.playback;
    if (!pb) return;
    clearInterval(pb.timer);
    this.playback = null;
    this.releaseWhere("play:");
    this.setSustain(pb.prevSustain);
    this.setTransport("idle");
  }

  clearTake() {
    this.stopPlayback();
    this.take = null;
    this.setTransport("idle");
  }

  exportMidi(): Blob | null {
    const take = this.take;
    if (!take) return null;
    const inst = getInstrument(take.instrumentId);
    // Align bars to the metronome when it was used, so the file lines up in a DAW.
    const bpm = take.metronome ? take.bpm : 120;
    const bytes = buildMidiFile(take.events, { program: inst.program, bpm, beats: take.beats, name: `PianoMaR — ${inst.name}` });
    return new Blob([bytes as BlobPart], { type: "audio/midi" });
  }

  // ------------------------------------------------------------------ metronome

  startMetronome() {
    this.engine.start();
    const ctx = this.engine.ctx;
    if (ctx) this.metronome.start(ctx, this.engine.limiter);
  }

  stopMetronome() {
    this.metronome.stop();
  }
}

let instance: PianoController | null = null;

/** Client-only singleton. */
export function getController(): PianoController {
  if (!instance) instance = new PianoController();
  return instance;
}
