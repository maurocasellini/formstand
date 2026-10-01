"use client";
import { useState } from "react";

export default function CopyBox({ text }) {
  const [ok, setOk] = useState(false);
  return (
    <div className="copybox">
      <textarea readOnly value={text} rows={Math.min(14, text.split("\n").length + 1)} onFocus={(e) => e.target.select()} />
      <button className="btn sm" type="button" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 2000); } catch {} }}>{ok ? "Kopiert ✓" : "Text kopieren"}</button>
    </div>
  );
}
