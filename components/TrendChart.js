"use client";
import { useState } from "react";

const W = 600, H = 180, L = 48, R = 10, T = 12, B = 28;
const dm = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;

// Verlauf einer Kennzahl: Tageswerte (Punkte bzw. dünne Linie), 7-Tage-Schnitt (kräftige Linie), Normalbereich (Band), Ø (gestrichelt).
// Hover/Touch: Fadenkreuz mit Datum, Tageswert und Schnitt.
export default function TrendChart({ days, vals, roll, m, s, unit = "", dec = 0, tone = "", label = "", sparse = false }) {
  const [hi, setHi] = useState(null);
  const pts = vals.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return null;
  const ys = [...pts.map(([, v]) => v), ...(m != null && s ? [m - s, m + s] : [])];
  let lo = Math.min(...ys), hiV = Math.max(...ys); const pad = (hiV - lo) * 0.1 || 1; lo -= pad; hiV += pad;
  const n = days.length, x = (i) => L + (i * (W - L - R)) / Math.max(1, n - 1), y = (v) => T + ((hiV - v) * (H - T - B)) / (hiV - lo);
  const line = (arr) => { let d = "", on = false; arr.forEach((v, i) => { if (v == null) { if (!sparse) on = false; return; } d += `${on ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; on = true; }); return d; };
  const col = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : "var(--ch-1)";
  const ticks = [lo + pad, (lo + hiV) / 2, hiV - pad];
  const dense = n > 120;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
    let i = Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))));
    // lückenhafte Reihen: zur nächsten Messung springen
    if (sparse && vals[i] == null) i = pts.reduce((best, [k]) => (Math.abs(k - i) < Math.abs(best - i) ? k : best), pts[0][0]);
    setHi(i);
  };
  const f = (v) => (v == null ? "–" : `${v.toFixed(dec)}${unit ? ` ${unit}` : ""}`);
  return (
    <div className="tchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: Verlauf ${dm(days[0])} bis ${dm(days[n - 1])}`} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        {m != null && s ? <rect x={L} width={W - L - R} y={y(m + s)} height={Math.max(1, y(m - s) - y(m + s))} fill="var(--ch-1)" opacity=".08" /> : null}
        {ticks.map((t, k) => <g key={k}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={L - 6} y={y(t) + 3} textAnchor="end">{t.toFixed(dec)}</text></g>)}
        {m != null && <line x1={L} x2={W - R} y1={y(m)} y2={y(m)} stroke="var(--line2)" strokeDasharray="4 4" />}
        {dense ? <path d={line(vals)} fill="none" stroke={col} strokeOpacity=".3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          : pts.map(([i, v]) => <circle key={i} cx={x(i)} cy={y(v)} r="2.2" fill={col} opacity=".35" />)}
        <path d={line(roll)} fill="none" stroke={col} strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{dm(days[i])}</text>)}
        {hi != null && <>
          <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="var(--muted)" strokeWidth="1" />
          {vals[hi] != null && <circle cx={x(hi)} cy={y(vals[hi])} r="4" fill={col} stroke="var(--surface)" strokeWidth="2" />}
          {roll[hi] != null && <circle cx={x(hi)} cy={y(roll[hi])} r="3" fill="var(--surface)" stroke={col} strokeWidth="2" />}
        </>}
      </svg>
      {hi != null && (
        <div className="ttip" style={{ left: `${(x(hi) / W) * 100}%`, transform: `translateX(${x(hi) > W * 0.65 ? "-105%" : "5%"})` }}>
          <b>{new Date(days[hi] + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}</b>
          <span>Tag: {f(vals[hi])}</span><span>{sparse ? "Ø letzte 3 Messungen" : "Ø 7 Tage"}: {f(roll[hi])}</span>
        </div>
      )}
    </div>
  );
}
