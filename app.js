/**
 * PianoMaR - Main Application
 * Full keyboard mapping like virtualpiano.net
 * Shift = black keys (sharps), regular = white keys
 * 36 white keys + 25 black keys = 61 keys (5 octaves, C2-C7)
 * Uses soundfont-player for real piano samples
 */

(function() {
    'use strict';

    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

    // ==========================================
    // Full Keyboard Mapping (virtualpiano.net style)
    // ==========================================

    const WHITE_KEY_MAP = {
        '1': 36, '2': 38, '3': 40, '4': 41, '5': 43, '6': 45, '7': 47,
        '8': 48, '9': 50, '0': 52, 'q': 53, 'w': 55, 'e': 57, 'r': 59,
        't': 60, 'y': 62, 'u': 64, 'i': 65, 'o': 67, 'p': 69, 'a': 71,
        's': 72, 'd': 74, 'f': 76, 'g': 77, 'h': 79, 'j': 81, 'k': 83,
        'l': 84, 'z': 86, 'x': 88, 'c': 89, 'v': 91, 'b': 93, 'n': 95, 'm': 96
    };

    const BLACK_KEY_MAP = {
        '!': 37, '@': 39, '$': 42, '%': 44, '^': 46,
        '*': 49, '(': 51,
        'Q': 54, 'W': 56, 'E': 58,
        'T': 61, 'Y': 63,
        'I': 66, 'O': 68, 'P': 70,
        'S': 73, 'D': 75,
        'G': 78, 'H': 80, 'J': 82,
        'L': 85, 'Z': 87,
        'C': 90, 'V': 92, 'B': 94,
    };

    const WHITE_KEYS_ORDER = ['1','2','3','4','5','6','7','8','9','0',
                               'q','w','e','r','t','y','u','i','o','p',
                               'a','s','d','f','g','h','j','k','l',
                               'z','x','c','v','b','n','m'];

    const MIDI_TO_WHITE_KEY = {};
    const MIDI_TO_BLACK_KEY = {};
    for (const [k, m] of Object.entries(WHITE_KEY_MAP)) MIDI_TO_WHITE_KEY[m] = k;
    for (const [k, m] of Object.entries(BLACK_KEY_MAP)) MIDI_TO_BLACK_KEY[m] = k;

    // ==========================================
    // State
    // ==========================================

    let transpose = 0;
    let sustain = false;
    let showLabels = true;
    let audioReady = false;
    const pressedPhysicalKeys = new Map();
    const activeNotes = new Set();
    const sustainedNotes = new Set();
    const noteHistory = [];

    // ==========================================
    // DOM
    // ==========================================

    const pianoKeysContainer = document.getElementById('pianoKeys');
    const noteNameEl = document.getElementById('noteName');
    const noteOctaveEl = document.getElementById('noteOctave');
    const noteHistoryEl = document.getElementById('noteHistory');
    const volumeSlider = document.getElementById('volumeSlider');
    const instrumentSelect = document.getElementById('instrumentSelect');
    const sustainBtn = document.getElementById('sustainBtn');
    const sustainIndicator = document.getElementById('sustainIndicator');
    const showLabelsBtn = document.getElementById('showLabelsBtn');
    const labelsIndicator = document.getElementById('labelsIndicator');
    const transposeUpBtn = document.getElementById('transposeUp');
    const transposeDownBtn = document.getElementById('transposeDown');
    const transposeValueEl = document.getElementById('transposeValue');
    const bgParticles = document.getElementById('bgParticles');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingInstrument = document.getElementById('loadingInstrument');

    // ==========================================
    // Audio Engine
    // ==========================================

    const audioEngine = new AudioEngine();

    // Loading callbacks
    audioEngine.onLoadStart = (name) => {
        loadingInstrument.textContent = name.replace(/_/g, ' ');
        loadingOverlay.classList.remove('hidden');
    };
    audioEngine.onLoadEnd = (name) => {
        loadingOverlay.classList.add('hidden');
        audioReady = true;
    };

    async function initAudio() {
        if (audioReady) return;
        try {
            await audioEngine.init();
            audioReady = true;
        } catch(e) {
            console.error('Audio init error:', e);
        }
    }

    // ==========================================
    // Piano Rendering
    // ==========================================

    function generatePiano() {
        pianoKeysContainer.innerHTML = '';
        const whiteKeyWidth = 31;

        WHITE_KEYS_ORDER.forEach((keyChar, idx) => {
            const baseMidi = WHITE_KEY_MAP[keyChar];
            const midi = baseMidi + transpose;
            const noteIdx = ((midi % 12) + 12) % 12;
            const octave = Math.floor(midi / 12) - 1;
            const noteName = NOTE_NAMES[noteIdx];

            const el = document.createElement('div');
            el.className = 'key key-white';
            el.dataset.midi = String(baseMidi);
            el.id = `key-${baseMidi}`;

            const label = document.createElement('span');
            label.className = 'key-label';
            label.textContent = `${noteName}${octave}`;
            el.appendChild(label);

            const mapping = document.createElement('span');
            mapping.className = 'key-mapping';
            mapping.textContent = keyChar.toUpperCase();
            el.appendChild(mapping);

            addKeyEvents(el, baseMidi);
            pianoKeysContainer.appendChild(el);
        });

        WHITE_KEYS_ORDER.forEach((keyChar, idx) => {
            const baseMidi = WHITE_KEY_MAP[keyChar];
            const blackMidi = baseMidi + 1;
            const blackKeyChar = MIDI_TO_BLACK_KEY[blackMidi];

            if (blackKeyChar && idx < WHITE_KEYS_ORDER.length - 1) {
                const transposedMidi = blackMidi + transpose;
                const noteIdx = ((transposedMidi % 12) + 12) % 12;
                const octave = Math.floor(transposedMidi / 12) - 1;
                const noteName = NOTE_NAMES[noteIdx];

                const el = document.createElement('div');
                el.className = 'key key-black';
                el.dataset.midi = String(blackMidi);
                el.id = `key-${blackMidi}`;

                const leftPos = (idx + 1) * whiteKeyWidth - 10;
                el.style.left = `${leftPos}px`;

                const label = document.createElement('span');
                label.className = 'key-label';
                label.textContent = `${noteName}${octave}`;
                el.appendChild(label);

                const mapping = document.createElement('span');
                mapping.className = 'key-mapping';
                mapping.textContent = blackKeyChar;
                el.appendChild(mapping);

                addKeyEvents(el, blackMidi);
                pianoKeysContainer.appendChild(el);
            }
        });

        if (!showLabels) pianoKeysContainer.classList.add('hide-labels');
        else pianoKeysContainer.classList.remove('hide-labels');
    }

    function addKeyEvents(el, baseMidi) {
        let isMouseDown = false;

        el.addEventListener('mousedown', (e) => {
            e.preventDefault();
            initAudio();
            isMouseDown = true;
            startNote(baseMidi);
        });
        el.addEventListener('mouseup', () => {
            isMouseDown = false;
            stopNote(baseMidi);
        });
        el.addEventListener('mouseleave', () => {
            if (isMouseDown) {
                isMouseDown = false;
                stopNote(baseMidi);
            }
        });
        el.addEventListener('mouseenter', (e) => {
            if (e.buttons === 1) {
                isMouseDown = true;
                startNote(baseMidi);
            }
        });

        el.addEventListener('touchstart', (e) => {
            e.preventDefault();
            initAudio();
            startNote(baseMidi);
        }, { passive: false });
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopNote(baseMidi);
        });
    }

    // ==========================================
    // Note Playing
    // ==========================================

    function startNote(baseMidi) {
        const midi = baseMidi + transpose;
        if (activeNotes.has(baseMidi)) return;

        if (sustainedNotes.has(baseMidi)) {
            sustainedNotes.delete(baseMidi);
        }

        audioEngine.playNote(midi);
        activeNotes.add(baseMidi);

        const el = document.getElementById(`key-${baseMidi}`);
        if (el) {
            el.classList.add('active');
            createFireBurst(el);
        }

        const noteIdx = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        const name = NOTE_NAMES[noteIdx];
        noteNameEl.textContent = name;
        noteOctaveEl.textContent = octave;

        const displayChar = MIDI_TO_WHITE_KEY[baseMidi] || MIDI_TO_BLACK_KEY[baseMidi] || '';
        noteHistory.push(displayChar);
        if (noteHistory.length > 60) noteHistory.shift();
        noteHistoryEl.textContent = noteHistory.join('');
    }

    function stopNote(baseMidi) {
        const midi = baseMidi + transpose;
        if (!activeNotes.has(baseMidi)) return;

        activeNotes.delete(baseMidi);

        if (sustain) {
            sustainedNotes.add(baseMidi);
            audioEngine.stopNote(midi);
        } else {
            audioEngine.stopNote(midi);
            const el = document.getElementById(`key-${baseMidi}`);
            if (el) el.classList.remove('active');
        }
    }

    function createFireBurst(el) {
        const burst = document.createElement('div');
        burst.className = 'fire-burst';
        const colors = ['#ff2d2d', '#ff6b1a', '#ffb800', '#ff4500'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        burst.style.background = color;
        burst.style.boxShadow = `0 0 10px ${color}, 0 0 20px ${color}`;
        el.appendChild(burst);
        setTimeout(() => burst.remove(), 500);
    }

    // ==========================================
    // Keyboard Input
    // ==========================================

    function handleKeyDown(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
        if (e.repeat) return;

        const code = e.code;
        const key = e.key;

        if (key === ' ') {
            e.preventDefault();
            initAudio();
            toggleSustain();
            return;
        }

        if (key === 'Shift') return;

        initAudio();

        if (pressedPhysicalKeys.has(code)) return;

        if (BLACK_KEY_MAP[key] !== undefined) {
            e.preventDefault();
            const baseMidi = BLACK_KEY_MAP[key];
            pressedPhysicalKeys.set(code, baseMidi);
            startNote(baseMidi);
            return;
        }

        const lowerKey = key.toLowerCase();
        if (WHITE_KEY_MAP[lowerKey] !== undefined && !e.shiftKey) {
            e.preventDefault();
            const baseMidi = WHITE_KEY_MAP[lowerKey];
            pressedPhysicalKeys.set(code, baseMidi);
            startNote(baseMidi);
            return;
        }
    }

    function handleKeyUp(e) {
        const code = e.code;
        const key = e.key;

        if (key === ' ') { e.preventDefault(); return; }
        if (key === 'Shift') return;

        if (pressedPhysicalKeys.has(code)) {
            const baseMidi = pressedPhysicalKeys.get(code);
            pressedPhysicalKeys.delete(code);
            stopNote(baseMidi);
            return;
        }
    }

    // ==========================================
    // Controls
    // ==========================================

    function toggleSustain() {
        sustain = !sustain;
        audioEngine.setSustain(sustain);
        sustainBtn.classList.toggle('active', sustain);
        sustainIndicator.textContent = sustain ? 'ON' : 'OFF';

        if (!sustain) {
            for (const baseMidi of sustainedNotes) {
                const midi = baseMidi + transpose;
                audioEngine.stopNote(midi);
                const el = document.getElementById(`key-${baseMidi}`);
                if (el) el.classList.remove('active');
            }
            sustainedNotes.clear();
        }
    }

    function setTranspose(val) {
        for (const baseMidi of activeNotes) {
            const midi = baseMidi + transpose;
            audioEngine.stopNote(midi);
            const el = document.getElementById(`key-${baseMidi}`);
            if (el) el.classList.remove('active');
        }
        activeNotes.clear();
        pressedPhysicalKeys.clear();
        for (const baseMidi of sustainedNotes) {
            const midi = baseMidi + transpose;
            audioEngine.stopNote(midi);
            const el = document.getElementById(`key-${baseMidi}`);
            if (el) el.classList.remove('active');
        }
        sustainedNotes.clear();

        transpose = Math.max(-12, Math.min(12, val));
        transposeValueEl.textContent = transpose > 0 ? `+${transpose}` : String(transpose);
        generatePiano();
    }

    // ==========================================
    // Fire Ember Particles
    // ==========================================

    function createEmbers() {
        const colors = ['#ff2d2d', '#ff6b1a', '#ffb800', '#ff4500', '#cc0000', '#ff8844'];
        for (let i = 0; i < 35; i++) {
            const ember = document.createElement('div');
            ember.className = 'ember';
            const size = 1.5 + Math.random() * 3.5;
            const color = colors[Math.floor(Math.random() * colors.length)];
            const left = Math.random() * 100;
            const duration = 6 + Math.random() * 12;
            const delay = Math.random() * 15;
            ember.style.cssText = `
                width:${size}px; height:${size}px;
                background:${color};
                left:${left}%; bottom: -10px;
                animation-duration:${duration}s;
                animation-delay:${delay}s;
                box-shadow: 0 0 ${size*2}px ${color};
            `;
            bgParticles.appendChild(ember);
        }
    }

    // ==========================================
    // Init
    // ==========================================

    function init() {
        generatePiano();
        createEmbers();

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        volumeSlider.addEventListener('input', (e) => {
            audioEngine.setVolume(parseInt(e.target.value) / 100);
        });

        instrumentSelect.addEventListener('change', async (e) => {
            await audioEngine.setInstrument(e.target.value);
        });

        sustainBtn.addEventListener('click', () => {
            initAudio();
            toggleSustain();
        });

        showLabelsBtn.addEventListener('click', () => {
            showLabels = !showLabels;
            showLabelsBtn.classList.toggle('active', showLabels);
            labelsIndicator.textContent = showLabels ? 'ON' : 'OFF';
            pianoKeysContainer.classList.toggle('hide-labels', !showLabels);
        });

        transposeUpBtn.addEventListener('click', () => setTranspose(transpose + 1));
        transposeDownBtn.addEventListener('click', () => setTranspose(transpose - 1));

        pianoKeysContainer.addEventListener('contextmenu', e => e.preventDefault());

        // First click/keypress initializes audio (browser autoplay policy)
        const firstInteraction = () => {
            initAudio();
            document.removeEventListener('click', firstInteraction);
            document.removeEventListener('keydown', firstInteraction);
        };
        document.addEventListener('click', firstInteraction);
        document.addEventListener('keydown', firstInteraction);

        console.log('🔥 PianoMaR initialized! Real piano samples loading on first interaction.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
