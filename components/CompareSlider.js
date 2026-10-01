"use client";
import { useState } from "react";

// Vorher/Nachher übereinander, Regler blendet über
export default function CompareSlider({ a, b, labelA, labelB }) {
  const [pos, setPos] = useState(50);
  return (
    <div className="cmp">
      <div className="cmp-stage">
        <img src={b} alt={`Nachher ${labelB}`} />
        <img src={a} alt={`Vorher ${labelA}`} style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span className="cmp-line" style={{ left: `${pos}%` }} />
        <span className="cmp-tag l">{labelA}</span><span className="cmp-tag r">{labelB}</span>
      </div>
      <input type="range" min="0" max="100" value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="Vorher/Nachher überblenden" />
    </div>
  );
}
