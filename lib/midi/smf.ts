/** Minimal Standard MIDI File (type 0) writer for exporting recordings. */

export type RecEvent =
  | { t: number; type: "on"; midi: number; velocity: number }
  | { t: number; type: "off"; midi: number }
  | { t: number; type: "sustain"; on: boolean };

const PPQ = 480;

function vlq(n: number): number[] {
  const bytes = [n & 0x7f];
  n >>= 7;
  while (n > 0) {
    bytes.unshift((n & 0x7f) | 0x80);
    n >>= 7;
  }
  return bytes;
}

function u32(n: number) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

function text(type: number, s: string): number[] {
  const bytes = [...new TextEncoder().encode(s)];
  return [0xff, type, ...vlq(bytes.length), ...bytes];
}

export function buildMidiFile(
  events: RecEvent[],
  opts: { program: number; bpm: number; name: string; beats?: number },
): Uint8Array {
  const msPerTick = 60000 / opts.bpm / PPQ;
  const usPerQuarter = Math.round(60_000_000 / opts.bpm);

  const track: number[] = [];
  track.push(0, ...text(0x03, opts.name));
  track.push(0, 0xff, 0x51, 0x03, (usPerQuarter >> 16) & 0xff, (usPerQuarter >> 8) & 0xff, usPerQuarter & 0xff);
  // Time signature (beats/4).
  track.push(0, 0xff, 0x58, 0x04, opts.beats ?? 4, 2, 24, 8);
  track.push(0, 0xc0, opts.program & 0x7f);

  // Stable sort: at the same tick, note-offs go before note-ons so re-strikes work.
  const order = { off: 0, sustain: 1, on: 2 } as const;
  const sorted = [...events].sort((a, b) => a.t - b.t || order[a.type] - order[b.type]);

  let lastTick = 0;
  for (const e of sorted) {
    const tick = Math.max(0, Math.round(e.t / msPerTick));
    track.push(...vlq(tick - lastTick));
    lastTick = tick;
    if (e.type === "on") track.push(0x90, e.midi & 0x7f, Math.max(1, Math.min(127, Math.round(e.velocity))));
    else if (e.type === "off") track.push(0x80, e.midi & 0x7f, 64);
    else track.push(0xb0, 64, e.on ? 127 : 0);
  }
  track.push(...vlq(PPQ), 0xff, 0x2f, 0x00);

  const header = [0x4d, 0x54, 0x68, 0x64, ...u32(6), 0, 0, 0, 1, (PPQ >> 8) & 0xff, PPQ & 0xff];
  const trackHeader = [0x4d, 0x54, 0x72, 0x6b, ...u32(track.length)];
  return new Uint8Array([...header, ...trackHeader, ...track]);
}
