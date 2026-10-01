"use client";
import { useEffect, useRef, useState } from "react";

// Eigener Datumswähler statt des Browser-Kalenders: gleiches Aussehen wie die übrigen Felder,
// Monats- und Jahresansicht, Mo–So. Schickt den Wert als YYYY-MM-DD im versteckten Feld mit.
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MSHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WDL = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => { const d = new Date(); return iso(d.getFullYear(), d.getMonth(), d.getDate()); };
const parse = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || "") ? { y: +s.slice(0, 4), m: +s.slice(5, 7) - 1, d: +s.slice(8, 10) } : null);
export const nice = (s) => { const p = parse(s); if (!p) return ""; const dt = new Date(Date.UTC(p.y, p.m, p.d)); return `${WDL[dt.getUTCDay()]}, ${p.d}. ${MSHORT[p.m]} ${p.y}`; };

export default function DateField({ name, defaultValue, value, onChange, min, max, required, clearable = false, placeholder = "Datum wählen" }) {
  const [inner, setInner] = useState(defaultValue || "");
  const val = value !== undefined ? value : inner;
  const start = parse(val) || parse(min && min > todayIso() ? min : todayIso());
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("days");
  const box = useRef(null);

  useEffect(() => { if (value === undefined && defaultValue !== undefined) setInner(defaultValue || ""); }, [defaultValue, value]);
  // Formular zurückgesetzt (z. B. nach dem Speichern) → Startwert wiederherstellen
  useEffect(() => {
    const f = box.current?.closest("form");
    if (!f || value !== undefined) return;
    const r = () => setInner(defaultValue || "");
    f.addEventListener("reset", r);
    return () => f.removeEventListener("reset", r);
  }, [defaultValue, value]);
  useEffect(() => {
    if (!open) return;
    const off = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", off); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", off); document.removeEventListener("keydown", esc); };
  }, [open]);

  const pick = (s) => { if (value === undefined) setInner(s); onChange?.(s); setOpen(false); };
  const show = () => { const p = parse(val) || start; setView({ y: p.y, m: p.m }); setMode("days"); setOpen((o) => !o); };
  const step = (n) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const ok = (s) => (!min || s >= min) && (!max || s <= max);

  const first = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const len = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];
  const t = todayIso();

  return (
    <span className="df" ref={box}>
      <input type="hidden" name={name} value={val} />
      <button type="button" className={`df-btn${val ? "" : " empty"}`} onClick={show} aria-haspopup="dialog" aria-expanded={open} aria-required={required || undefined}>
        <span>{val ? nice(val) : placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M3.5 10h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <div className="df-pop" role="dialog" aria-label="Datum wählen" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
          <div className="df-head">
            <button type="button" className="df-nav" onClick={() => (mode === "days" ? step(-1) : setView((v) => ({ ...v, y: v.y - 1 })))} aria-label="zurück">‹</button>
            <button type="button" className="df-title" onClick={() => setMode(mode === "days" ? "months" : "days")}>{mode === "days" ? `${MONTHS[view.m]} ${view.y}` : view.y}</button>
            <button type="button" className="df-nav" onClick={() => (mode === "days" ? step(1) : setView((v) => ({ ...v, y: v.y + 1 })))} aria-label="weiter">›</button>
          </div>
          {mode === "days" ? (
            <div className="df-grid">
              {WD.map((w, i) => <span key={w} className={`df-wd${i > 4 ? " we" : ""}`}>{w}</span>)}
              {cells.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const s = iso(view.y, view.m, d);
                return <button type="button" key={s} disabled={!ok(s)} onClick={() => pick(s)} className={`df-d${s === val ? " sel" : ""}${s === t ? " today" : ""}${i % 7 > 4 ? " we" : ""}`}>{d}</button>;
              })}
            </div>
          ) : (
            <div className="df-months">
              {MSHORT.map((n, i) => <button type="button" key={n} className={`df-m${view.m === i ? " sel" : ""}`} onClick={() => { setView((v) => ({ ...v, m: i })); setMode("days"); }}>{n}</button>)}
            </div>
          )}
          <div className="df-foot">
            {ok(t) && <button type="button" className="df-link" onClick={() => pick(t)}>Heute</button>}
            {clearable && !required && val && <button type="button" className="df-link muted" onClick={() => pick("")}>Leeren</button>}
          </div>
        </div>
      )}
    </span>
  );
}
