/** Web MIDI input: lets people play PianoMaR from a real MIDI keyboard. */

export interface MidiHandlers {
  noteOn: (note: number, velocity: number) => void;
  noteOff: (note: number) => void;
  sustain: (on: boolean) => void;
  devices: (names: string[]) => void;
}

export function midiSupported(): boolean {
  return typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;
}

export async function connectMidi(h: MidiHandlers): Promise<() => void> {
  const access = await navigator.requestMIDIAccess({ sysex: false });

  const onMessage = (e: MIDIMessageEvent) => {
    const data = e.data;
    if (!data || data.length < 2) return;
    const status = data[0] & 0xf0;
    const d1 = data[1];
    const d2 = data[2] ?? 0;
    if (status === 0x90 && d2 > 0) h.noteOn(d1, d2);
    else if (status === 0x80 || (status === 0x90 && d2 === 0)) h.noteOff(d1);
    else if (status === 0xb0 && d1 === 64) h.sustain(d2 >= 64);
  };

  const bind = () => {
    const names: string[] = [];
    access.inputs.forEach((input) => {
      input.onmidimessage = onMessage;
      if (input.state === "connected") names.push(input.name || "MIDI device");
    });
    h.devices(names);
  };

  bind();
  access.onstatechange = bind;

  return () => {
    access.onstatechange = null;
    access.inputs.forEach((input) => {
      input.onmidimessage = null;
    });
    h.devices([]);
  };
}
