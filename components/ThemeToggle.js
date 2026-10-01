"use client";
import { useEffect, useState } from "react";

// Darstellung: System (folgt dem Gerät) → Hell → Dunkel. Gespeichert pro Gerät.
const NEXT = { system: "light", light: "dark", dark: "system" };
const LABEL = { system: "Darstellung: wie Gerät", light: "Darstellung: hell", dark: "Darstellung: dunkel" };

export function applyTheme(t) {
  const el = document.documentElement;
  if (t === "light" || t === "dark") el.dataset.theme = t; else delete el.dataset.theme;
  try { t === "system" ? localStorage.removeItem("theme") : localStorage.setItem("theme", t); } catch {}
}

export default function ThemeToggle({ withLabel = false }) {
  const [t, setT] = useState("system");
  useEffect(() => { try { setT(localStorage.getItem("theme") || "system"); } catch {} }, []);
  const click = () => { const n = NEXT[t]; setT(n); applyTheme(n); };
  return (
    <button type="button" className={`btn ghost sm theme-t${withLabel ? "" : " icon"}`} onClick={click} title={`${LABEL[t]} – tippen zum Wechseln`} aria-label={LABEL[t]}>
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {t === "dark" ? <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
          : t === "light" ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
          : <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>}
      </svg>
      {withLabel && <span>{{ system: "Wie Gerät", light: "Hell", dark: "Dunkel" }[t]}</span>}
    </button>
  );
}
