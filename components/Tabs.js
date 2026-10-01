"use client";
import { useState, Children } from "react";

// Einfache Reiter: alle Inhalte werden auf dem Server gerendert, hier nur umgeschaltet
export default function Tabs({ labels, start = 0, children }) {
  const [on, setOn] = useState(start);
  const panes = Children.toArray(children);
  return (
    <div className="tabsx">
      <div className="seg" role="tablist">{labels.map((l, i) => <button key={l} type="button" role="tab" aria-selected={i === on} className={i === on ? "on" : ""} onClick={() => setOn(i)}>{l}</button>)}</div>
      {panes.map((p, i) => <div key={i} role="tabpanel" hidden={i !== on}>{p}</div>)}
    </div>
  );
}
