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
    // These maps are the single source of truth for on-screen labels.
    // Physical-key detection below (CODE_TO_WHITE_MIDI) derives from
    // WHITE_KEY_MAP so it works regardless of the OS keyboard layout
    // (e.keyCode/e.key differ across layouts, e.code does not).

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

    // Physical key (KeyboardEvent.code) -> white-key MIDI, derived from WHITE_KEY_MAP
    // so it stays layout-independent (AZERTY, QWERTZ, etc. all use the same physical
    // rows/columns). Whether Shift is held decides white vs. the black key above it.
    const CODE_TO_WHITE_MIDI = {};
    for (const [ch, midi] of Object.entries(WHITE_KEY_MAP)) {
        const code = /[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
        CODE_TO_WHITE_MIDI[code] = midi;
    }

    function midiToNoteName(midi) {
        const idx = ((midi % 12) + 12) % 12;
        const octave = Math.floor(midi / 12) - 1;
        return { name: NOTE_NAMES[idx], octave };
    }

    // ==========================================
    // State
    // ==========================================

    let transpose = 0;
    let sustain = false;
    let showLabels = true;
    let audioReady = false;
    let visualizerMode = false;
    const pressedPhysicalKeys = new Map();
    const activeTouches = new Map(); // touch identifier -> baseMidi
    const activeNotes = new Set();
    const sustainedNotes = new Set();
    const noteHistory = [];
    const noteTrails = new Map(); // baseMidi -> trail state
    let trailRafId = null;

    // ==========================================
    // DOM
    // ==========================================

    const appEl = document.getElementById('app');
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
    const loadingHint = document.querySelector('.loading-hint');
    const visualizerToggleBtn = document.getElementById('visualizerToggleBtn');
    const visualizerTrack = document.getElementById('visualizerTrack');
    const pianoBody = document.getElementById('pianoBody');
    const helpToggleBtn = document.getElementById('helpToggleBtn');
    const helpPopover = document.getElementById('helpPopover');

    // ==========================================
    // Audio Engine
    // ==========================================

    const audioEngine = new AudioEngine();

    // Loading callbacks
    audioEngine.onLoadStart = (name) => {
        loadingInstrument.textContent = name.replace(/_/g, ' ');
        if (loadingHint) loadingHint.textContent = 'Click anywhere to start';
        loadingOverlay.classList.remove('hidden');
    };
    audioEngine.onLoadEnd = (name) => {
        if (audioEngine.currentInstrument) {
            loadingOverlay.classList.add('hidden');
            audioReady = true;
        }
    };
    audioEngine.onLoadError = (name, err) => {
        loadingInstrument.textContent = 'Failed to load piano samples';
        if (loadingHint) loadingHint.textContent = 'Check your internet connection, then reload the page.';
        loadingOverlay.classList.remove('hidden');
    };
    audioEngine.onLoadProgress = (name, loaded, total) => {
        if (loadingHint) loadingHint.textContent = `Loading samples… ${loaded}/${total}`;
    };

    async function initAudio() {
        if (audioReady) return;
        try {
            await audioEngine.init();
            if (audioEngine.currentInstrument) audioReady = true;
        } catch(e) {
            console.error('Audio init error:', e);
        }
    }

    // ==========================================
    // Piano + Visualizer Rendering
    // ==========================================

    function generatePiano() {
        pianoKeysContainer.innerHTML = '';
        visualizerTrack.innerHTML = '';
        clearAllTrails();

        WHITE_KEYS_ORDER.forEach((keyChar, idx) => {
            const baseMidi = WHITE_KEY_MAP[keyChar];
            const midi = baseMidi + transpose;
            const { name, octave } = midiToNoteName(midi);

            const el = document.createElement('div');
            el.className = 'key key-white';
            el.dataset.midi = String(baseMidi);
            el.id = `key-${baseMidi}`;
            el.setAttribute('role', 'button');
            el.tabIndex = -1;
            el.setAttribute('aria-label', `${name}${octave}`);

            const label = document.createElement('span');
            label.className = 'key-label';
            label.textContent = `${name}${octave}`;
            el.appendChild(label);

            const mapping = document.createElement('span');
            mapping.className = 'key-mapping';
            mapping.textContent = keyChar.toUpperCase();
            el.appendChild(mapping);

            addKeyEvents(el, baseMidi);
            pianoKeysContainer.appendChild(el);

            const slot = document.createElement('div');
            slot.className = 'vis-slot vis-slot-white';
            slot.id = `slot-${baseMidi}`;
            visualizerTrack.appendChild(slot);
        });

        // Measure actual rendered key sizes (they shrink at mobile breakpoints via CSS)
        // instead of assuming fixed desktop pixel widths, so black keys stay aligned
        // with the white key boundaries at every screen size.
        const firstWhite = pianoKeysContainer.querySelector('.key-white');
        let whiteKeyPitch = 31;
        let blackKeyWidth = 20;
        if (firstWhite) {
            const whiteStyle = getComputedStyle(firstWhite);
            whiteKeyPitch = firstWhite.getBoundingClientRect().width
                + parseFloat(whiteStyle.marginLeft || 0)
                + parseFloat(whiteStyle.marginRight || 0);
        }
        const blackWidthProbe = getComputedStyle(document.documentElement);
        blackKeyWidth = parseFloat(blackWidthProbe.getPropertyValue('--key-black-width')) || blackKeyWidth;

        WHITE_KEYS_ORDER.forEach((keyChar, idx) => {
            const baseMidi = WHITE_KEY_MAP[keyChar];
            const blackMidi = baseMidi + 1;
            const blackKeyChar = MIDI_TO_BLACK_KEY[blackMidi];

            if (blackKeyChar && idx < WHITE_KEYS_ORDER.length - 1) {
                const transposedMidi = blackMidi + transpose;
                const { name, octave } = midiToNoteName(transposedMidi);

                const el = document.createElement('div');
                el.className = 'key key-black';
                el.dataset.midi = String(blackMidi);
                el.id = `key-${blackMidi}`;
                el.setAttribute('role', 'button');
                el.tabIndex = -1;
                el.setAttribute('aria-label', `${name}${octave}`);

                const leftPos = (idx + 1) * whiteKeyPitch - (blackKeyWidth / 2);
                el.style.left = `${leftPos}px`;

                const label = document.createElement('span');
                label.className = 'key-label';
                label.textContent = `${name}${octave}`;
                el.appendChild(label);

                const mapping = document.createElement('span');
                mapping.className = 'key-mapping';
                mapping.textContent = blackKeyChar;
                el.appendChild(mapping);

                addKeyEvents(el, blackMidi);
                pianoKeysContainer.appendChild(el);

                const slot = document.createElement('div');
                slot.className = 'vis-slot vis-slot-black';
                slot.id = `slot-${blackMidi}`;
                slot.style.left = `${leftPos}px`;
                visualizerTrack.appendChild(slot);
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
    }

    // ==========================================
    // Touch Input (with glissando support)
    // ==========================================

    function keyMidiFromPoint(x, y) {
        const el = document.elementFromPoint(x, y);
        const keyEl = el && el.closest ? el.closest('.key') : null;
        if (!keyEl) return null;
        return parseInt(keyEl.dataset.midi, 10);
    }

    function handleTouchStart(e) {
        e.preventDefault();
        initAudio();
        for (const touch of e.changedTouches) {
            const midi = keyMidiFromPoint(touch.clientX, touch.clientY);
            if (midi !== null) {
                activeTouches.set(touch.identifier, midi);
                startNote(midi);
            }
        }
    }

    function handleTouchMove(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            const prevMidi = activeTouches.get(touch.identifier);
            const midi = keyMidiFromPoint(touch.clientX, touch.clientY);
            if (midi === prevMidi) continue;
            if (prevMidi !== undefined) stopNote(prevMidi);
            if (midi !== null) {
                activeTouches.set(touch.identifier, midi);
                startNote(midi);
            } else {
                activeTouches.delete(touch.identifier);
            }
        }
    }

    function handleTouchEnd(e) {
        for (const touch of e.changedTouches) {
            const midi = activeTouches.get(touch.identifier);
            if (midi !== undefined) {
                stopNote(midi);
                activeTouches.delete(touch.identifier);
            }
        }
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

        const { name, octave } = midiToNoteName(midi);
        noteNameEl.textContent = name;
        noteOctaveEl.textContent = octave;

        const displayChar = MIDI_TO_WHITE_KEY[baseMidi] || MIDI_TO_BLACK_KEY[baseMidi] || '';
        noteHistory.push(displayChar);
        if (noteHistory.length > 60) noteHistory.shift();
        noteHistoryEl.textContent = noteHistory.join('');

        startTrail(baseMidi, el ? el.classList.contains('key-black') : false);
    }

    function stopNote(baseMidi) {
        const midi = baseMidi + transpose;
        if (!activeNotes.has(baseMidi)) return;

        activeNotes.delete(baseMidi);

        // Always remove visual highlight on release (audio may sustain)
        const el = document.getElementById(`key-${baseMidi}`);
        if (el) el.classList.remove('active');

        if (sustain) {
            // Audio keeps playing, just track it
            sustainedNotes.add(baseMidi);
            audioEngine.stopNote(midi);
        } else {
            audioEngine.stopNote(midi);
        }

        releaseTrail(baseMidi);
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
    // Note Trail Visualizer
    // ==========================================

    const TRAIL_SPEED = 130; // px/sec while held
    const TRAIL_FLOAT_DURATION = 3.2; // seconds the bar drifts upward after release (must match style.css .note-trail.releasing)
    const TRAIL_FLOAT_DISTANCE = TRAIL_SPEED * TRAIL_FLOAT_DURATION; // keeps the same speed into the float phase

    function startTrail(baseMidi, isBlack) {
        const slot = document.getElementById(`slot-${baseMidi}`);
        if (!slot) return;

        const existing = noteTrails.get(baseMidi);
        if (existing) {
            existing.el.remove();
            noteTrails.delete(baseMidi);
        }

        const el = document.createElement('div');
        el.className = 'note-trail' + (isBlack ? ' black-note' : '');
        slot.appendChild(el);
        noteTrails.set(baseMidi, { el, start: performance.now(), height: 0, released: false });

        ensureTrailLoop();
    }

    function releaseTrail(baseMidi) {
        const t = noteTrails.get(baseMidi);
        if (!t || t.released) return;
        t.released = true;
        noteTrails.delete(baseMidi);

        const el = t.el;
        el.style.height = `${t.height}px`;
        requestAnimationFrame(() => {
            el.classList.add('releasing');
            el.style.transform = `translateY(-${t.height + TRAIL_FLOAT_DISTANCE}px)`;
            el.style.opacity = '0';
        });
        setTimeout(() => el.remove(), TRAIL_FLOAT_DURATION * 1000 + 100);
    }

    function clearAllTrails() {
        noteTrails.clear();
    }

    function ensureTrailLoop() {
        if (trailRafId !== null) return;
        const loop = (now) => {
            let hasActive = false;
            for (const t of noteTrails.values()) {
                if (t.released) continue;
                hasActive = true;
                t.height = ((now - t.start) / 1000) * TRAIL_SPEED;
                t.el.style.height = `${t.height}px`;
            }
            trailRafId = hasActive ? requestAnimationFrame(loop) : null;
        };
        trailRafId = requestAnimationFrame(loop);
    }

    function setVisualizerMode(on) {
        visualizerMode = on;
        appEl.classList.toggle('visualizer-mode', on);
        visualizerToggleBtn.classList.toggle('active', on);
        visualizerToggleBtn.setAttribute('aria-pressed', String(on));
        if (on) setHelpPopoverOpen(false);
    }

    function setHelpPopoverOpen(open) {
        helpPopover.hidden = !open;
        helpToggleBtn.classList.toggle('active', open);
        helpToggleBtn.setAttribute('aria-expanded', String(open));
    }

    // Keep the visualizer track horizontally aligned with the piano when it scrolls
    // (small screens where the keyboard is wider than the viewport). visualizer-track
    // is centered via translateX(-50%); we adjust that offset by the piano's scroll
    // position rather than relying on native scrolling, since the track itself never
    // overflows its own (non-scrolling) stage container.
    pianoBody.addEventListener('scroll', () => {
        visualizerTrack.style.transform = `translateX(calc(-50% - ${pianoBody.scrollLeft}px))`;
    });

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

        if (key === 'Escape') {
            if (!helpPopover.hidden) {
                setHelpPopoverOpen(false);
                return;
            }
            setVisualizerMode(!visualizerMode);
            return;
        }

        if (key === 'Shift') return;

        initAudio();

        if (pressedPhysicalKeys.has(code)) return;

        const whiteMidi = CODE_TO_WHITE_MIDI[code];
        if (whiteMidi === undefined) return;

        e.preventDefault();
        let baseMidi = whiteMidi;
        if (e.shiftKey && MIDI_TO_BLACK_KEY[whiteMidi + 1] !== undefined) {
            baseMidi = whiteMidi + 1;
        }
        pressedPhysicalKeys.set(code, baseMidi);
        startNote(baseMidi);
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
            // Audio engine's setSustain(false) already stops sustained sounds
            sustainedNotes.clear();
        }
    }

    function setTranspose(val) {
        for (const baseMidi of activeNotes) {
            const midi = baseMidi + transpose;
            audioEngine.stopNote(midi);
            const el = document.getElementById(`key-${baseMidi}`);
            if (el) el.classList.remove('active');
            releaseTrail(baseMidi);
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

        pianoKeysContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        pianoKeysContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
        pianoKeysContainer.addEventListener('touchend', handleTouchEnd);
        pianoKeysContainer.addEventListener('touchcancel', handleTouchEnd);

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

        visualizerToggleBtn.addEventListener('click', () => setVisualizerMode(!visualizerMode));

        helpToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            setHelpPopoverOpen(helpPopover.hidden);
        });
        document.addEventListener('click', (e) => {
            if (!helpPopover.hidden && !helpPopover.contains(e.target) && e.target !== helpToggleBtn) {
                setHelpPopoverOpen(false);
            }
        });

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
