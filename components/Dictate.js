"use client";
import { useEffect, useRef, useState } from "react";

// Diktieren statt tippen: nutzt die Spracherkennung des Browsers (Safari/Chrome). Kostet keine KI-Tokens –
// erkannt wird auf dem Gerät bzw. vom Browser-Anbieter, an Formstand geht nur der fertige Text.
export default function Dictate({ target, lang = "de-CH" }) {
  const [ok, setOk] = useState(false);
  const [on, setOn] = useState(false);
  const rec = useRef(null);
  // In der iOS-App (Capacitor): native Erkennung, die Musik weiterlaufen lässt
  const native = () => { const C = typeof window !== "undefined" ? window.Capacitor : null; return C?.isNativePlatform?.() ? (C.Plugins?.FormstandSpeech || C.registerPlugin?.("FormstandSpeech")) : null; };
  const subs = useRef([]);
  useEffect(() => { setOk(Boolean(native() || (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)))); }, []); // eslint-disable-line
  useEffect(() => () => rec.current?.stop(), []);
  if (!ok) return null;
  const el = () => (typeof target === "string" ? document.getElementById(target) : target?.current);
  const startNative = async (P) => {
    const t = el(); if (!t) return;
    const base = t.value ? t.value.replace(/\s*$/, " ") : "";
    for (const h of subs.current) h?.remove?.();
    subs.current = [
      await P.addListener("result", (d) => { t.value = (base + (d.text || "")).replace(/\s+/g, " ").trimStart(); t.dispatchEvent(new Event("input", { bubbles: true })); }),
      await P.addListener("end", () => setOn(false)),
    ];
    try { await P.start({ lang }); setOn(true); } catch (e) { setOn(false); alert(e?.message || "Diktieren nicht möglich."); }
  };
  const start = () => {
    const P = native(); if (P) return startNative(P);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition, r = new SR();
    r.lang = lang; r.interimResults = true; r.continuous = true;
    const t = el(); if (!t) return;
    const base = t.value ? t.value.replace(/\s*$/, " ") : "";
    let finalText = "";
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const s = e.results[i][0].transcript; if (e.results[i].isFinal) finalText += s; else interim += s; }
      t.value = (base + finalText + interim).replace(/\s+/g, " ").trimStart();
      t.dispatchEvent(new Event("input", { bubbles: true }));
    };
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r; r.start(); setOn(true);
  };
  const stop = () => { const P = native(); if (P) P.stop(); else rec.current?.stop(); setOn(false); };
  return (
    <button type="button" className={`btn ghost sm mic${on ? " on" : ""}`} onClick={on ? stop : start} aria-pressed={on} title="Diktieren statt tippen – keine KI-Kosten">
      {on ? "■ Stopp" : "🎤 Diktieren"}
    </button>
  );
}
