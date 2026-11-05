"use client";

import { ChevronLeft, ChevronRight, Smartphone } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { WHITE_KEY_COUNT } from "@/lib/music";
import { useSettings, useUI } from "@/lib/store";
import { Keyboard } from "./Keyboard";
import { Visualizer } from "./Visualizer";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Stage() {
  const labels = useSettings((s) => s.labels);
  const theme = useSettings((s) => s.theme);
  const transpose = useUI((s) => s.transpose);
  const focus = useUI((s) => s.focus);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState({ kw: 34, kh: 190, measured: false });
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const centered = useRef(false);

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflow({ left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  }, []);

  // Fit the keyboard to the available space: as wide as possible, keys never
  // narrower than a fingertip on touch screens (the keyboard scrolls instead).
  useIsoLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const inner = innerRef.current;
    if (!scroller || !inner) return;

    const measure = () => {
      const cs = getComputedStyle(inner);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const cheek = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--cheek")) || 14;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const W = scroller.clientWidth;
      const H = scroller.clientHeight;
      const minKw = coarse ? 26 : 18;
      const kw = Math.floor(Math.min(46, Math.max(minKw, (W - padX - cheek * 2) / WHITE_KEY_COUNT)));
      const shortScreen = window.innerHeight < 620;
      const minVis = shortScreen ? 30 : 70;
      const caseChrome = 12 + 16 + 10; // case padding + margin
      const avail = H - minVis - caseChrome;
      // On touch screens taller keys are easier to hit, so use more of the free height.
      const ideal = coarse ? Math.max(kw * 5.6, avail * 0.6) : kw * 5.6;
      const kh = Math.round(Math.max(96, Math.min(ideal, avail, 260)));
      setGeo((g) => (g.measured && g.kw === kw && g.kh === kh ? g : { kw, kh, measured: true }));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(scroller);
    return () => ro.disconnect();
  }, []);

  // When the keyboard is wider than the screen, start centred on middle C.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || !geo.measured) return;
    if (!centered.current && el.scrollWidth > el.clientWidth) {
      const c4 = el.querySelector<HTMLElement>('[data-key="60"]');
      if (c4) {
        const r = c4.getBoundingClientRect();
        const s = el.getBoundingClientRect();
        // centre the C4–C5 octave
        el.scrollLeft += r.left - s.left + geo.kw * 3.5 - el.clientWidth / 2;
      }
      centered.current = true;
    }
    updateOverflow();
  }, [geo, updateOverflow]);

  const scrollByOctave = (dir: number) => {
    scrollerRef.current?.scrollBy({ left: dir * geo.kw * 7, behavior: "smooth" });
  };

  const style = { "--kw": `${geo.kw}px`, "--kh": `${geo.kh}px` } as CSSProperties;

  return (
    <main className="stage" style={style} data-focus={focus}>
      <div ref={scrollerRef} className="piano-scroller" onScroll={updateOverflow}>
        <div ref={innerRef} className="piano-inner">
          <Visualizer kw={geo.kw} theme={theme} />
          <div className="case">
            <Keyboard labels={labels} transpose={transpose} compact={geo.kw < 28} />
          </div>
        </div>
      </div>
      {(overflow.left || overflow.right) && (
        <div className="rotate-hint" aria-hidden>
          <Smartphone size={14} /> Rotate your phone for more keys
        </div>
      )}
      {overflow.left && (
        <button type="button" className="scroll-hint left" onClick={() => scrollByOctave(-1)} aria-label="Scroll keyboard left">
          <ChevronLeft size={18} />
        </button>
      )}
      {overflow.right && (
        <button type="button" className="scroll-hint right" onClick={() => scrollByOctave(1)} aria-label="Scroll keyboard right">
          <ChevronRight size={18} />
        </button>
      )}
    </main>
  );
}
