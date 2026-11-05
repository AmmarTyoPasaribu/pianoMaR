/**
 * Sample loading.
 *
 * Both sources end up as a SampleBank: one or more velocity layers, each mapping a
 * recorded MIDI note to a decoded AudioBuffer. Notes that weren't recorded are
 * pitch-shifted from the nearest recorded one (the standard "sparse multisample"
 * technique every sampler uses).
 */

export interface SampleLayer {
  /** The MIDI velocity this layer was recorded at (roughly). */
  refVelocity: number;
  buffers: Map<number, AudioBuffer>;
  /** Sorted list of recorded MIDI notes, for nearest-sample lookup. */
  notes: number[];
}

export interface SampleBank {
  layers: SampleLayer[]; // sorted by refVelocity ascending
}

type Progress = (fraction: number) => void;

function makeLayer(refVelocity: number, buffers: Map<number, AudioBuffer>): SampleLayer {
  return { refVelocity, buffers, notes: [...buffers.keys()].sort((a, b) => a - b) };
}

export function addLayer(bank: SampleBank, layer: SampleLayer) {
  bank.layers = [...bank.layers.filter((l) => l.refVelocity !== layer.refVelocity), layer].sort(
    (a, b) => a.refVelocity - b.refVelocity,
  );
}

/** Pick the velocity layer whose recorded velocity is closest to the one requested. */
export function pickLayer(bank: SampleBank, velocity: number): SampleLayer | undefined {
  let best: SampleLayer | undefined;
  let bestDist = Infinity;
  for (const l of bank.layers) {
    const d = Math.abs(l.refVelocity - velocity);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  return best;
}

export function nearestNote(layer: SampleLayer, midi: number): number {
  const notes = layer.notes;
  let lo = 0;
  let hi = notes.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notes[mid] < midi) lo = mid + 1;
    else hi = mid;
  }
  const a = notes[lo];
  const b = notes[lo - 1];
  if (b !== undefined && Math.abs(b - midi) <= Math.abs(a - midi)) return b;
  return a;
}

async function fetchWithRetry(url: string, signal?: AbortSignal, tries = 2): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Salamander Grand Piano (Yamaha C5, CC-BY 3.0, Alexander Holm)
// ---------------------------------------------------------------------------

const SALAMANDER_NOTES: [number, string][] = [
  [21, "A0"], [24, "C1"], [27, "D#1"], [30, "F#1"], [33, "A1"], [36, "C2"], [39, "D#2"], [42, "F#2"],
  [45, "A2"], [48, "C3"], [51, "D#3"], [54, "F#3"], [57, "A3"], [60, "C4"], [63, "D#4"], [66, "F#4"],
  [69, "A4"], [72, "C5"], [75, "D#5"], [78, "F#5"], [81, "A5"], [84, "C6"], [87, "D#6"], [90, "F#6"],
  [93, "A6"], [96, "C7"], [99, "D#7"], [102, "F#7"], [105, "A7"], [108, "C8"],
];

/** Salamander velocity layer -> approximate MIDI velocity it represents. */
export const SALAMANDER_PRIMARY_LAYER = 8;
export const SALAMANDER_EXTRA_LAYERS = [3, 13];
const LAYER_VELOCITY: Record<number, number> = { 3: 38, 8: 84, 13: 118 };

export async function loadSalamanderLayer(
  ctx: BaseAudioContext,
  layer: number,
  onProgress?: Progress,
  signal?: AbortSignal,
): Promise<SampleLayer> {
  const base = `https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-velocity${layer}@1.0.5/audio/`;
  const buffers = new Map<number, AudioBuffer>();
  let done = 0;
  await Promise.all(
    SALAMANDER_NOTES.map(async ([midi, name]) => {
      const res = await fetchWithRetry(`${base}${encodeURIComponent(name)}v${layer}.mp3`, signal);
      const data = await res.arrayBuffer();
      buffers.set(midi, await ctx.decodeAudioData(data));
      onProgress?.(++done / SALAMANDER_NOTES.length);
    }),
  );
  return makeLayer(LAYER_VELOCITY[layer] ?? 84, buffers);
}

// ---------------------------------------------------------------------------
// MusyngKite General MIDI soundfont (MIDI.js format, via gleitz/midi-js-soundfonts)
// ---------------------------------------------------------------------------

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteNameToMidi(name: string): number | null {
  const m = /^([A-G])([b#]?)(-?\d)$/.exec(name);
  if (!m) return null;
  let pc = NOTE_INDEX[m[1]];
  if (m[2] === "b") pc -= 1;
  if (m[2] === "#") pc += 1;
  return (Number(m[3]) + 1) * 12 + pc;
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function readTextWithProgress(res: Response, onProgress?: Progress): Promise<string> {
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total) return res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.min(1, received / total));
  }
  const all = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.length;
  }
  return new TextDecoder().decode(all);
}

export async function loadSoundfont(
  ctx: BaseAudioContext,
  name: string,
  onProgress?: Progress,
  signal?: AbortSignal,
): Promise<SampleLayer> {
  const url = `https://gleitz.github.io/midi-js-soundfonts/MusyngKite/${name}-mp3.js`;
  const res = await fetchWithRetry(url, signal);
  // Download is ~75% of the wait; decoding the rest.
  const text = await readTextWithProgress(res, (f) => onProgress?.(f * 0.75));

  const start = text.indexOf("{", text.indexOf("MIDI.Soundfont."));
  const end = text.lastIndexOf("}");
  if (start < 0 || end < 0) throw new Error(`Unexpected soundfont format: ${name}`);
  const json = text.slice(start, end + 1).replace(/,\s*}$/, "}");
  const entries = Object.entries(JSON.parse(json) as Record<string, string>);

  const buffers = new Map<number, AudioBuffer>();
  let done = 0;
  await Promise.all(
    entries.map(async ([noteName, dataUri]) => {
      const midi = noteNameToMidi(noteName);
      if (midi === null) return;
      const b64 = dataUri.slice(dataUri.indexOf(",") + 1);
      try {
        buffers.set(midi, await ctx.decodeAudioData(base64ToBuffer(b64)));
      } catch {
        // A single undecodable note just falls back to its neighbour.
      }
      onProgress?.(0.75 + (++done / entries.length) * 0.25);
    }),
  );
  if (!buffers.size) throw new Error(`No playable samples in ${name}`);
  return makeLayer(100, buffers);
}
