/**
 * Algorithmic impulse responses for a ConvolverNode.
 *
 * Exponentially decaying stereo noise, low-passed progressively over time to mimic
 * air absorption (real rooms lose their highs first). A handful of discrete early
 * reflections gives each space a sense of size.
 */

export type ReverbSpace = "room" | "hall" | "cathedral" | "plate";

interface SpaceSpec {
  seconds: number;
  decay: number; // curve steepness
  preDelay: number; // seconds
  damping: number; // 0 = bright, 1 = dark
  reflections: number[]; // early reflection times (s)
}

const SPACES: Record<ReverbSpace, SpaceSpec> = {
  room: { seconds: 1.3, decay: 3.4, preDelay: 0.006, damping: 0.55, reflections: [0.011, 0.017, 0.023, 0.031] },
  hall: { seconds: 3.0, decay: 2.8, preDelay: 0.022, damping: 0.45, reflections: [0.019, 0.029, 0.041, 0.053, 0.067] },
  cathedral: { seconds: 6.0, decay: 2.3, preDelay: 0.04, damping: 0.5, reflections: [0.033, 0.051, 0.079, 0.097, 0.121] },
  plate: { seconds: 2.2, decay: 3.8, preDelay: 0.0, damping: 0.15, reflections: [] },
};

export const REVERB_SPACES: { id: ReverbSpace; label: string }[] = [
  { id: "room", label: "Room" },
  { id: "hall", label: "Hall" },
  { id: "cathedral", label: "Cathedral" },
  { id: "plate", label: "Plate" },
];

export function createImpulse(ctx: BaseAudioContext, space: ReverbSpace): AudioBuffer {
  const spec = SPACES[space];
  const rate = ctx.sampleRate;
  const len = Math.floor(rate * (spec.seconds + spec.preDelay));
  const pre = Math.floor(rate * spec.preDelay);
  const buffer = ctx.createBuffer(2, len, rate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    const tailLen = len - pre;
    for (let i = 0; i < tailLen; i++) {
      const t = i / tailLen;
      const env = Math.pow(1 - t, spec.decay);
      const noise = Math.random() * 2 - 1;
      // Low-pass coefficient closes over time: bright attack, dark tail.
      const a = 1 - spec.damping * (0.25 + 0.7 * t);
      lp += a * (noise - lp);
      data[pre + i] = lp * env;
    }
    // Early reflections, slightly different per channel for width.
    spec.reflections.forEach((r, idx) => {
      const pos = pre + Math.floor(rate * r * (ch ? 1.07 : 1));
      if (pos < len) data[pos] += (0.55 - idx * 0.08) * (idx % 2 ? -1 : 1);
    });
  }

  // Normalise so every space has comparable loudness.
  let peak = 0;
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    let sum = 0;
    for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
    peak = Math.max(peak, Math.sqrt(sum / d.length));
  }
  const norm = peak > 0 ? 0.08 / peak : 1;
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= norm;
  }
  return buffer;
}
