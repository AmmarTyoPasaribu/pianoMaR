export function Footer() {
  return (
    <footer className="foot shell">
      <div className="foot-keys">
        <span>
          <kbd>Shift</kbd> black keys
        </span>
        <span>
          <kbd>Space</kbd> sustain
        </span>
        <span>
          <kbd>←</kbd>
          <kbd>→</kbd> transpose
        </span>
        <span>
          <kbd>Esc</kbd> focus
        </span>
      </div>
      <div>
        Grand piano:{" "}
        <a href="https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html" target="_blank" rel="noreferrer">
          Salamander Grand
        </a>{" "}
        by Alexander Holm (CC-BY) · Other sounds:{" "}
        <a href="https://github.com/gleitz/midi-js-soundfonts" target="_blank" rel="noreferrer">
          MusyngKite
        </a>
      </div>
    </footer>
  );
}
