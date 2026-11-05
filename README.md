# PianoMaR — Virtual Piano

A virtual piano for the browser with **real concert grand samples**. Play it with your computer keyboard, mouse, multi-touch, or a real MIDI keyboard.

**[Live demo →](https://pianomar.vercel.app)**

## Features

- **61 keys** (C2–C7), laid out like virtualpiano.net: number and letter rows are white keys, `Shift` + key plays the black key above. Works on any keyboard layout (QWERTY, AZERTY, QWERTZ) because it follows physical key positions.
- **Concert Grand**: Salamander Grand Piano (Yamaha C5) with **3 velocity layers**, register-dependent damping, undamped top octaves and stereo placement by pitch.
- **23 instruments** in 5 groups: pianos, classic keys, mallets, organs and ensemble (MusyngKite soundfont).
- **Sound shaping**: algorithmic reverb (Room / Hall / Cathedral / Plate), brightness, stereo width, and touch (soft / medium / hard).
- **Sustain pedal**: press-to-toggle or hold-like-a-pedal, with a dot on each key that is still ringing.
- **Transpose** ±12 semitones (`←` / `→`).
- **Chord detection**: names what you play (Cmaj7, Dm7/F, sus4…).
- **Metronome** with tap tempo, beats per bar and accent.
- **Recorder**: record, play back, and download your take as a `.mid` file.
- **MIDI input** (Web MIDI): velocity and sustain pedal (CC64).
- **Note visualizer**: notes rise from the keys; **focus mode** (`Esc`) hides everything else.
- **4 themes** (Ember, Noir Gold, Aurora, Ivory). Settings are saved in your browser.
- Responsive from phones to wide screens, with multi-touch glissando.

## Controls

| Action | Key |
| --- | --- |
| White keys | `1`–`0`, `Q`–`P`, `A`–`L`, `Z`–`M` |
| Black keys | `Shift` + same key |
| Sustain | `Space` |
| Transpose | `←` / `→` |
| Focus mode / close panels | `Esc` |
| Help | `?` |

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck
```

## Tech

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Web Audio API** with a custom sampler engine (no audio library)
- **zustand** for settings, **lucide-react** for icons
- Hosted on **Vercel**

## Project structure

```
app/            layout, page, global styles, icon, manifest
components/     UI (TopBar, Display, ControlDeck, Stage, Keyboard, Visualizer, ...)
lib/audio/      engine, sample loading, reverb, metronome, instrument list
lib/midi/       Web MIDI input, .mid file writer
lib/piano/      controller: routes every input to the engine, recorder
lib/music.ts    key mapping, note names, chord detection
lib/store.ts    persisted settings + UI state + actions
```

## Credits

- Grand piano: [Salamander Grand Piano](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html) by Alexander Holm, CC-BY 3.0
- Other instruments: [MusyngKite soundfont](https://github.com/gleitz/midi-js-soundfonts) via gleitz/midi-js-soundfonts
