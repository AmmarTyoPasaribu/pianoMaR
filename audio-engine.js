/**
 * PianoMaR - Audio Engine (Soundfont-based)
 * Uses real piano samples from CDN via soundfont-player
 */

/**
 * Multi-sampled Grand Piano using real Salamander Grand Piano V3 recordings
 * (Yamaha C5, CC-BY, via the darosh/samples-piano-mp3 CDN package). This is
 * noticeably more realistic than a General MIDI soundfont, so it replaces
 * soundfont-player just for the default "acoustic_grand_piano" instrument;
 * every other instrument in the dropdown keeps using soundfont-player/MusyngKite,
 * since no equivalent high-quality free sample set exists for those.
 *
 * 30 samples are recorded roughly every minor third across the 88-key range
 * (A0, C1, D#1, F#1, A1, C2, ...); notes in between are pitch-shifted from the
 * nearest recorded sample via playbackRate, the same technique soundfont/sampler
 * players use for "sparse" multisampling.
 *
 * Exposes the same duck-typed interface AudioEngine expects from a
 * soundfont-player instrument: play(midi, time, {gain}) -> { stop(when) }.
 */
class SalamanderPiano {
    constructor(audioContext, destination) {
        this.ctx = audioContext;
        this.destination = destination;
        this.buffers = new Map(); // sample midi -> decoded AudioBuffer
        this.sampleMidis = [
            21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63,
            66, 69, 72, 75, 78, 81, 84, 87, 90, 93, 96, 99, 102, 105, 108
        ];
    }

    static midiToSampleName(midi) {
        const NAMES = {
            21: 'A0', 24: 'C1', 27: 'D#1', 30: 'F#1', 33: 'A1', 36: 'C2',
            39: 'D#2', 42: 'F#2', 45: 'A2', 48: 'C3', 51: 'D#3', 54: 'F#3',
            57: 'A3', 60: 'C4', 63: 'D#4', 66: 'F#4', 69: 'A4', 72: 'C5',
            75: 'D#5', 78: 'F#5', 81: 'A5', 84: 'C6', 87: 'D#6', 90: 'F#6',
            93: 'A6', 96: 'C7', 99: 'D#7', 102: 'F#7', 105: 'A7', 108: 'C8'
        };
        return NAMES[midi];
    }

    nearestSampleMidi(midi) {
        let best = this.sampleMidis[0];
        let bestDist = Infinity;
        for (const s of this.sampleMidis) {
            const dist = Math.abs(s - midi);
            if (dist < bestDist) {
                bestDist = dist;
                best = s;
            }
        }
        return best;
    }

    async load(onProgress) {
        const base = 'https://cdn.jsdelivr.net/npm/@audio-samples/piano-mp3-velocity8@1.0.5/audio/';
        let loaded = 0;
        await Promise.all(this.sampleMidis.map(async (midi) => {
            const name = SalamanderPiano.midiToSampleName(midi);
            const url = `${base}${encodeURIComponent(name)}v8.mp3`;
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Sample fetch failed (${res.status}): ${url}`);
            const arrayBuffer = await res.arrayBuffer();
            const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
            this.buffers.set(midi, audioBuffer);
            loaded++;
            if (onProgress) onProgress(loaded, this.sampleMidis.length);
        }));
    }

    play(midi, time, options = {}) {
        const sampleMidi = this.nearestSampleMidi(midi);
        const buffer = this.buffers.get(sampleMidi);
        if (!buffer) return { stop() {} };

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = Math.pow(2, (midi - sampleMidi) / 12);

        const noteGain = this.ctx.createGain();
        noteGain.gain.value = options.gain != null ? options.gain : 1;
        source.connect(noteGain);
        noteGain.connect(this.destination);

        source.start(time);

        let stopped = false;
        return {
            stop: (when) => {
                if (stopped) return;
                stopped = true;
                const stopTime = when != null ? when : this.ctx.currentTime;
                const RELEASE = 0.35;
                // Short fade-out so cutting off a still-ringing sample doesn't click.
                noteGain.gain.cancelScheduledValues(stopTime);
                noteGain.gain.setValueAtTime(noteGain.gain.value, stopTime);
                noteGain.gain.setTargetAtTime(0.0001, stopTime, RELEASE / 4);
                try { source.stop(stopTime + RELEASE); } catch (e) {}
            }
        };
    }
}

class AudioEngine {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.compressor = null;
        this.instruments = {};       // loaded instrument instances
        this.currentInstrument = null;
        this.instrumentName = 'acoustic_grand_piano';
        this.volume = 0.75;
        this.sustain = false;
        this.sustainedNotes = new Map();  // midi → player node
        this.activeNodes = new Map();     // midi → player node
        this._initialized = false;
        this._loading = false;
        this.onLoadStart = null;
        this.onLoadEnd = null;
        this.onLoadError = null;
        this.onLoadProgress = null;
    }

    async init() {
        if (this._initialized) return;
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Master chain
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.compressor.threshold.value = -20;
        this.compressor.knee.value = 25;
        this.compressor.ratio.value = 8;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.15;

        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = this.volume;

        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.audioContext.destination);

        this._initialized = true;

        // Load default instrument
        await this.loadInstrument(this.instrumentName);
    }

    async loadInstrument(name) {
        if (this.instruments[name]) {
            this.currentInstrument = this.instruments[name];
            this.instrumentName = name;
            return;
        }

        this._loading = true;
        if (this.onLoadStart) this.onLoadStart(name);

        try {
            let instrument;
            if (name === 'acoustic_grand_piano') {
                const piano = new SalamanderPiano(this.audioContext, this.compressor);
                await piano.load((loaded, total) => {
                    if (this.onLoadProgress) this.onLoadProgress(name, loaded, total);
                });
                instrument = piano;
            } else {
                instrument = await Soundfont.instrument(
                    this.audioContext,
                    name,
                    {
                        soundfont: 'MusyngKite',
                        destination: this.compressor,
                        gain: 2.5
                    }
                );
            }
            this.instruments[name] = instrument;
            this.currentInstrument = instrument;
            this.instrumentName = name;
        } catch (err) {
            console.error('Failed to load instrument:', name, err);
            if (this.onLoadError) this.onLoadError(name, err);
        }

        this._loading = false;
        if (this.onLoadEnd) this.onLoadEnd(name);
    }

    setVolume(value) {
        this.volume = value;
        if (this.masterGain) {
            this.masterGain.gain.setTargetAtTime(value, this.audioContext.currentTime, 0.01);
        }
    }

    async setInstrument(name) {
        this.instrumentName = name;
        if (this._initialized) {
            await this.loadInstrument(name);
        }
    }

    setSustain(on) {
        this.sustain = on;
        if (!on) {
            // Release all sustained notes
            for (const [midi, node] of this.sustainedNotes) {
                if (node && node.stop) {
                    try { node.stop(); } catch(e) {}
                }
            }
            this.sustainedNotes.clear();
        }
    }

    /**
     * Play a note
     */
    playNote(midi) {
        if (!this._initialized || !this.currentInstrument) return null;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Stop existing note on same midi
        if (this.activeNodes.has(midi)) {
            const oldNode = this.activeNodes.get(midi);
            if (oldNode && oldNode.stop) {
                try { oldNode.stop(); } catch(e) {}
            }
            this.activeNodes.delete(midi);
        }
        // Also stop sustained version
        if (this.sustainedNotes.has(midi)) {
            const oldNode = this.sustainedNotes.get(midi);
            if (oldNode && oldNode.stop) {
                try { oldNode.stop(); } catch(e) {}
            }
            this.sustainedNotes.delete(midi);
        }

        try {
            // No `duration` here on purpose: it would auto-stop the note after a fixed
            // time even while the key is still held. We stop notes manually via stopNote().
            // Volume is controlled solely through masterGain so the slider stays linear.
            const node = this.currentInstrument.play(midi, this.audioContext.currentTime, {
                gain: 1
            });
            this.activeNodes.set(midi, node);
            return node;
        } catch(e) {
            console.error('Error playing note', midi, e);
            return null;
        }
    }

    /**
     * Stop a note
     */
    stopNote(midi) {
        const node = this.activeNodes.get(midi);
        if (!node) return;

        if (this.sustain) {
            // Move to sustained - keep playing
            this.sustainedNotes.set(midi, node);
            this.activeNodes.delete(midi);
        } else {
            // soundfont-player applies its own short release envelope internally
            if (node.stop) {
                try { node.stop(); } catch(e) {}
            }
            this.activeNodes.delete(midi);
        }
    }

    isLoading() {
        return this._loading;
    }
}

// Export as global
window.AudioEngine = AudioEngine;
