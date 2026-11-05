"use client";

import { memo, useEffect, useRef, type CSSProperties } from "react";
import { BLACK_OFFSET, KEYS, midiToName } from "@/lib/music";
import { getController } from "@/lib/piano/controller";
import { startAudio, type LabelMode } from "@/lib/store";

interface Props {
  labels: LabelMode;
  transpose: number;
  compact: boolean;
}

function KeyboardImpl({ labels, transpose, compact }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Key highlighting is driven straight from controller events (no React re-render per note).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = new Map<number, HTMLElement>();
    root.querySelectorAll<HTMLElement>("[data-key]").forEach((el) => els.set(Number(el.dataset.key), el));

    const c = getController();
    return c.subscribe((e) => {
      if (e.type === "on") {
        const el = els.get(e.key);
        if (!el) return;
        el.style.setProperty("--press", String(0.45 + (e.velocity / 127) * 0.55));
        el.classList.remove("ringing");
        el.classList.add("down");
      } else if (e.type === "off") {
        const el = els.get(e.key);
        if (!el) return;
        el.classList.remove("down");
        if (e.sustained) el.classList.add("ringing");
      } else if (e.type === "sustain" && !e.on) {
        for (const el of els.values()) el.classList.remove("ringing");
      } else if (e.type === "reset") {
        for (const el of els.values()) el.classList.remove("down", "ringing");
      }
    });
  }, []);

  // Pointer input: mouse, pen and multi-touch with glissando (slide across keys).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const c = getController();
    const active = new Map<number, number | null>();

    const keyAt = (x: number, y: number): number | null => {
      const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-key]");
      return el && root.contains(el) ? Number(el.dataset.key) : null;
    };

    const down = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      startAudio();
      const key = keyAt(e.clientX, e.clientY);
      active.set(e.pointerId, key);
      if (key !== null) c.press(`ptr:${e.pointerId}`, key);
    };
    const move = (e: PointerEvent) => {
      if (!active.has(e.pointerId)) return;
      const key = keyAt(e.clientX, e.clientY);
      if (key === active.get(e.pointerId)) return;
      active.set(e.pointerId, key);
      if (key === null) c.release(`ptr:${e.pointerId}`);
      else c.press(`ptr:${e.pointerId}`, key);
    };
    const up = (e: PointerEvent) => {
      if (!active.has(e.pointerId)) return;
      active.delete(e.pointerId);
      c.release(`ptr:${e.pointerId}`);
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === "mouse") up(e);
    };
    const noMenu = (e: Event) => e.preventDefault();

    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    root.addEventListener("pointerleave", leave);
    root.addEventListener("contextmenu", noMenu);
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
      root.removeEventListener("pointerleave", leave);
      root.removeEventListener("contextmenu", noMenu);
      for (const id of active.keys()) c.release(`ptr:${id}`);
    };
  }, []);

  return (
    <div ref={ref} className="keys" data-labels={labels} data-compact={compact} role="group" aria-label="Piano keyboard">
      {KEYS.map((k) => {
        const { full, name } = midiToName(k.midi + transpose);
        const vars: Record<string, number> = { "--i": k.whiteIndex };
        if (k.black) vars["--off"] = BLACK_OFFSET[k.midi % 12] ?? 0;
        const style = vars as CSSProperties;
        return (
          <div
            key={k.midi}
            data-key={k.midi}
            className={`key ${k.black ? "black" : "white"}${name === "C" ? " is-c" : ""}`}
            style={style}
            aria-label={`${full}, key ${k.char}`}
          >
            <span className="key-note">{full}</span>
            <span className="key-char">{k.char}</span>
          </div>
        );
      })}
    </div>
  );
}

export const Keyboard = memo(KeyboardImpl);
