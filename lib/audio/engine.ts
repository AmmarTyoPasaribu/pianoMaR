/**
 * PianoMaR audio engine.
 *
 * Signal chain:
 *   voice (sample -> velocity low-pass -> envelope -> pan)
 *     -> bus -> tone shelf -> dry ----------------------> compressor -> master -> limiter -> out
 *                          \-> convolver (reverb) -> wet -/
 *   metronome -----------------------------------------------------------------> limiter
 */

import { DEFAULT_INSTRUMENT, getInstrument, type InstrumentDef } from "./instruments";
import { createImpulse, type ReverbSpace } from "./reverb";
import {
  addLayer,
  loadSalamanderLayer,
  loadSoundfont,
  nearestNote,
  pickLayer,
  SALAMANDER_EXTRA_LAYERS,
  SALAMANDER_PRIMARY_LAYER,
  type SampleBank,
} from "./samples";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface EngineStatus {
  status: LoadStatus;
  /** Instrument currently audible (may differ from the one loading). */
  activeId: string;
  /** Instrument being loaded, if any. */
  loadingId: string | null;
  progress: number;
  error?: string;
}

type VoiceState = "held" | "sustained" | "ringing" | "releasing";

interface Voice {
  midi: number;
  src: AudioBufferSourceNode;
  amp: GainNode;
  nodes: AudioNode[];
  release: number;
  ring: boolean;
  state: VoiceState;
  started: number;
}

const MAX_VOICES = 80;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export class AudioEngine {
  ctx: AudioContext | null = null;

  private bus!: GainNode;
  private shelf!: BiquadFilterNode;
  private dry!: GainNode;
  private wet!: GainNode;
  private convolver!: ConvolverNode;
  private master!: GainNode;
  /** Final safety limiter; the metronome joins the mix here. */
  limiter!: DynamicsCompressorNode;

  private banks = new Map<string, SampleBank>();
  private pending = new Map<string, Promise<SampleBank>>();
  private impulses = new Map<ReverbSpace, AudioBuffer>();
  private voices: Voice[] = [];
  private current: InstrumentDef = getInstrument(DEFAULT_INSTRUMENT);
  private bank: SampleBank | null = null;
  private requestedId = DEFAULT_INSTRUMENT;
  private loadToken = 0;
  private sustain = true;
  private extraLayersLoading = false;

  private settings = {
    volume: 0.8,
    reverb: 0.25,
    space: "hall" as ReverbSpace,
    brightness: 0,
    stereo: 0.5,
    velocityLayers: true,
  };

  private statusValue: EngineStatus = { status: "idle", activeId: DEFAULT_INSTRUMENT, loadingId: null, progress: 0 };
  onStatus: ((s: EngineStatus) => void) | null = null;
  onLayerProgress: ((fraction: number | null) => void) | null = null;

  get status() {
    return this.statusValue;
  }

  get started() {
    return this.ctx !== null;
  }

  get instrument() {
    return this.current;
  }

  private emit(patch: Partial<EngineStatus>) {
    this.statusValue = { ...this.statusValue, ...patch };
    this.onStatus?.(this.statusValue);
  }

  /** Must be called from a user gesture (click / keydown / touch) because of autoplay rules. */
  start() {
    if (this.ctx) {
      if (this.ctx.state !== "running") void this.ctx.resume();
      return;
    }
    try {
      // iOS: play through the silent switch like a real instrument app.
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* not supported */
    }

    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx({ latencyHint: "interactive" });
    this.ctx = ctx;

    this.bus = ctx.createGain();
    this.shelf = ctx.createBiquadFilter();
    this.shelf.type = "highshelf";
    this.shelf.frequency.value = 2800;
    this.dry = ctx.createGain();
    this.wet = ctx.createGain();
    this.convolver = ctx.createConvolver();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.005;
    comp.release.value = 0.25;

    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -1.5;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.1;

    this.bus.connect(this.shelf);
    this.shelf.connect(this.dry);
    this.shelf.connect(this.convolver);
    this.convolver.connect(this.wet);
    this.dry.connect(comp);
    this.wet.connect(comp);
    comp.connect(this.master);
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);

    this.applyAll();
    void this.loadInstrument(this.requestedId);
  }

  // ------------------------------------------------------------------ loading

  async loadInstrument(id: string) {
    const def = getInstrument(id);
    this.requestedId = def.id;
    if (!this.ctx) {
      this.current = def;
      this.emit({ activeId: def.id });
      return;
    }

    const cached = this.banks.get(def.id);
    if (cached) {
      this.loadToken++;
      this.activate(def, cached);
      return;
    }

    const token = ++this.loadToken;
    this.emit({ status: "loading", loadingId: def.id, progress: 0, error: undefined });
    try {
      const bank = await this.fetchBank(def, (p) => {
        if (token === this.loadToken) this.emit({ progress: p });
      });
      if (token !== this.loadToken) return;
      this.activate(def, bank);
    } catch (err) {
      if (token !== this.loadToken) return;
      console.error("Failed to load instrument", def.id, err);
      this.emit({
        status: this.bank ? "ready" : "error",
        loadingId: null,
        error: `Couldn't load ${def.name}. Check your connection and try again.`,
      });
    }
  }

  private fetchBank(def: InstrumentDef, onProgress: (p: number) => void): Promise<SampleBank> {
    const inflight = this.pending.get(def.id);
    if (inflight) return inflight;
    const ctx = this.ctx!;
    const p = (async () => {
      const layer =
        def.source === "salamander"
          ? await loadSalamanderLayer(ctx, SALAMANDER_PRIMARY_LAYER, onProgress)
          : await loadSoundfont(ctx, def.id, onProgress);
      const bank: SampleBank = { layers: [layer] };
      this.banks.set(def.id, bank);
      return bank;
    })();
    this.pending.set(def.id, p);
    p.finally(() => this.pending.delete(def.id)).catch(() => {});
    return p;
  }

  private activate(def: InstrumentDef, bank: SampleBank) {
    this.current = def;
    this.bank = bank;
    this.emit({ status: "ready", activeId: def.id, loadingId: null, progress: 1, error: undefined });
    if (def.source === "salamander") void this.maybeLoadExtraLayers(bank);
  }

  /** Soft + hard Salamander layers, loaded quietly in the background after the main one. */
  private async maybeLoadExtraLayers(bank: SampleBank) {
    if (!this.settings.velocityLayers || this.extraLayersLoading || !this.ctx) return;
    if (bank.layers.length >= 1 + SALAMANDER_EXTRA_LAYERS.length) return;
    this.extraLayersLoading = true;
    const total = SALAMANDER_EXTRA_LAYERS.length;
    try {
      for (let i = 0; i < total; i++) {
        const layer = await loadSalamanderLayer(this.ctx, SALAMANDER_EXTRA_LAYERS[i], (f) =>
          this.onLayerProgress?.((i + f) / total),
        );
        addLayer(bank, layer);
      }
    } catch (err) {
      console.warn("Extra velocity layers unavailable", err);
    } finally {
      this.extraLayersLoading = false;
      this.onLayerProgress?.(null);
    }
  }

  // ------------------------------------------------------------------ playing

  noteOn(midi: number, velocity = 90) {
    const ctx = this.ctx;
    const bank = this.bank;
    if (!ctx || !bank) return;
    if (ctx.state !== "running") void ctx.resume();

    const def = this.current;
    const now = ctx.currentTime;

    // Re-striking a note that is still sounding: let the old one die quickly.
    for (const v of this.voices) {
      if (v.midi === midi && v.state !== "releasing") this.fade(v, now, 0.09);
    }

    const multi = this.settings.velocityLayers && bank.layers.length > 1;
    const layer = multi
      ? pickLayer(bank, velocity)!
      : bank.layers.find((l) => l.refVelocity === 84 || l.refVelocity === 100) ?? bank.layers[0];
    const sampleMidi = nearestNote(layer, midi);
    const buffer = layer.buffers.get(sampleMidi);
    if (!buffer) return;

    const vel = clamp(velocity, 1, 127);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = Math.pow(2, (midi - sampleMidi) / 12);

    // Harder hits are brighter. With real velocity layers the samples already carry
    // that timbre, so the filter only adds a little.
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.4;
    const darkness = (1 - vel / 127) * (multi ? 1.4 : 3.2);
    lp.frequency.value = clamp(19000 * Math.pow(2, -darkness), 900, 19000);

    const amp = ctx.createGain();
    const level = clamp(Math.pow(vel / layer.refVelocity, multi ? 0.9 : 1.35), 0.04, 1.6) * def.gain;
    amp.gain.setValueAtTime(0, now);
    amp.gain.linearRampToValueAtTime(level, now + 0.004);

    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp((midi - 64) / 40, -1, 1) * this.settings.stereo * 0.8;

    src.connect(lp);
    lp.connect(amp);
    amp.connect(pan);
    pan.connect(this.bus);

    // Bass strings ring longer after their damper falls than treble strings.
    const pitchFactor = def.source === "salamander" ? clamp(1.6 - ((midi - 21) / 67) * 1.0, 0.55, 1.6) : 1;
    // The top ~1.5 octaves of a grand have no dampers at all.
    const undamped = def.source === "salamander" && midi >= 89;

    const voice: Voice = {
      midi,
      src,
      amp,
      nodes: [src, lp, amp, pan],
      release: def.release * pitchFactor,
      ring: !!def.ring || undamped,
      state: "held",
      started: now,
    };
    src.onended = () => this.cleanup(voice);
    src.start(now);
    this.voices.push(voice);
    this.enforcePolyphony();
  }

  noteOff(midi: number) {
    for (const v of this.voices) {
      if (v.midi !== midi || v.state !== "held") continue;
      if (v.ring) v.state = "ringing";
      else if (this.sustain) v.state = "sustained";
      else this.release(v);
    }
  }

  setSustain(on: boolean) {
    this.sustain = on;
    if (on) return;
    for (const v of this.voices) if (v.state === "sustained") this.release(v);
  }

  /** Release every held or sustained note (used when transposing). */
  releaseAll() {
    for (const v of this.voices) if (v.state === "held" || v.state === "sustained") this.release(v);
  }

  /** Silence absolutely everything, fast. */
  panic() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const v of [...this.voices]) this.fade(v, now, 0.05);
  }

  private release(v: Voice) {
    if (!this.ctx) return;
    v.state = "releasing";
    const t = this.ctx.currentTime;
    const g = v.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0, t, v.release / 4);
    try {
      v.src.stop(t + v.release * 1.8);
    } catch {
      /* already stopped */
    }
  }

  private fade(v: Voice, t: number, seconds: number) {
    v.state = "releasing";
    const g = v.amp.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.setTargetAtTime(0, t, seconds / 4);
    try {
      v.src.stop(t + seconds * 1.5);
    } catch {
      /* already stopped */
    }
  }

  private enforcePolyphony() {
    const excess = this.voices.length - MAX_VOICES;
    if (excess <= 0 || !this.ctx) return;
    const rank: Record<VoiceState, number> = { releasing: 0, ringing: 1, sustained: 2, held: 3 };
    const victims = [...this.voices]
      .sort((a, b) => rank[a.state] - rank[b.state] || a.started - b.started)
      .slice(0, excess);
    const now = this.ctx.currentTime;
    for (const v of victims) {
      this.fade(v, now, 0.03);
      this.voices = this.voices.filter((x) => x !== v);
    }
  }

  private cleanup(v: Voice) {
    for (const n of v.nodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    const i = this.voices.indexOf(v);
    if (i >= 0) this.voices.splice(i, 1);
  }

  // ------------------------------------------------------------------ settings

  setVolume(v: number) {
    this.settings.volume = v;
    if (this.ctx) this.master.gain.setTargetAtTime(v * v * 1.2, this.ctx.currentTime, 0.015);
  }

  setReverb(amount: number) {
    this.settings.reverb = amount;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.wet.gain.setTargetAtTime(amount * 1.1, t, 0.03);
    this.dry.gain.setTargetAtTime(1 - amount * 0.35, t, 0.03);
  }

  setReverbSpace(space: ReverbSpace) {
    this.settings.space = space;
    if (!this.ctx) return;
    let ir = this.impulses.get(space);
    if (!ir) {
      ir = createImpulse(this.ctx, space);
      this.impulses.set(space, ir);
    }
    this.convolver.buffer = ir;
  }

  /** -1 (dark) .. 1 (bright) */
  setBrightness(b: number) {
    this.settings.brightness = b;
    if (this.ctx) this.shelf.gain.setTargetAtTime(b * 9, this.ctx.currentTime, 0.03);
  }

  setStereo(w: number) {
    this.settings.stereo = w;
  }

  setVelocityLayers(on: boolean) {
    this.settings.velocityLayers = on;
    if (on && this.bank && this.current.source === "salamander") void this.maybeLoadExtraLayers(this.bank);
  }

  private applyAll() {
    const s = this.settings;
    this.setVolume(s.volume);
    this.setReverb(s.reverb);
    this.setReverbSpace(s.space);
    this.setBrightness(s.brightness);
  }
}
