/**
 * PianoMaR - Audio Engine (Soundfont-based)
 * Uses real piano samples from CDN via soundfont-player
 */
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
            const instrument = await Soundfont.instrument(
                this.audioContext,
                name,
                {
                    soundfont: 'MusyngKite',
                    destination: this.compressor,
                    gain: 2.5
                }
            );
            this.instruments[name] = instrument;
            this.currentInstrument = instrument;
            this.instrumentName = name;
        } catch (err) {
            console.error('Failed to load instrument:', name, err);
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
            const node = this.currentInstrument.play(midi, this.audioContext.currentTime, {
                duration: 4,
                gain: this.volume * 3
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
            // Stop with short fade
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
