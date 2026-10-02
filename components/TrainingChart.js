"use client";
import { useState } from "react";

const W = 600, H = 180, L = 48, R = 70, T = 12, B = 28;
const dm = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;

// Fitness (CTL) und Ermüdung (ATL) als zwei Linien, direkt beschriftet; Fadenkreuz mit Form (TSB)
export function LoadChart({ days, ctl, atl, tsb }) {
  const [hi, setHi] = useState(null);
  const n = days.length, all = [...ctl, ...atl].filter((v) => v != null);
  const mn = Math.min(...all), mx = Math.max(...all), pd = (mx - mn) * 0.15 || 5;
  const lo = Math.max(0, mn - pd), hiV = mx + pd;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, n - 1), y = (v) => T + ((hiV - v) * (H - T - B)) / (hiV - lo);
  const line = (a) => a.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v ?? 0).toFixed(1)}`).join("");
  const onMove = (e) => { const r = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W; setHi(Math.max(0, Math.min(n - 1, Math.round(((px - L) / (W - L - R)) * (n - 1))))); };
  return (
    <div className="tchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fitness und Ermüdung" onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        {[lo + pd * 0.5, (lo + hiV) / 2, hiV - pd * 0.5].map((t, k) => <g key={k}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--line)" /><text x={L - 6} y={y(t) + 3} textAnchor="end">{Math.round(t)}</text></g>)}
        <path d={line(atl)} fill="none" stroke="var(--ch-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <path d={line(ctl)} fill="none" stroke="var(--ch-1)" strokeWidth="2.4" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        <text x={W - R + 6} y={y(ctl[n - 1]) + 4} className="dl">Fitness</text>
        <text x={W - R + 6} y={y(atl[n - 1]) + (Math.abs(y(atl[n - 1]) - y(ctl[n - 1])) < 12 ? (atl[n - 1] > ctl[n - 1] ? -8 : 16) : 4)} className="dl">Ermüdung</text>
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}>{dm(days[i])}</text>)}
        {hi != null && <line x1={x(hi)} x2={x(hi)} y1={T} y2={H - B} stroke="var(--muted)" />}
      </svg>
      {hi != null && (
        <div className="ttip" style={{ left: `${(x(hi) / W) * 100}%`, transform: `translateX(${x(hi) > W * 0.6 ? "-105%" : "5%"})` }}>
          <b>{new Date(days[hi] + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}</b>
          <span><i className="sw" style={{ background: "var(--ch-1)" }} />Fitness {Math.round(ctl[hi])}</span>
          <span><i className="sw" style={{ background: "var(--ch-2)" }} />Ermüdung {Math.round(atl[hi])}</span>
          <span>Form {Math.round(tsb[hi])}</span>
        </div>
      )}
    </div>
  );
}

// Wochenstunden: gestapelt Ausdauer + Kraft, 2px Lücke, Hover je Woche
export function WeeksChart({ weeks }) {
  const [hi, setHi] = useState(null);
  const Wd = 600, Hd = 160, l = 40, r = 6, t = 10, b = 28;
  const max = Math.max(1, ...weeks.map((w) => w.hours)) * 1.1, n = weeks.length;
  const bw = (Wd - l - r) / n, y = (v) => t + ((max - v) * (Hd - t - b)) / max;
  const avg = weeks.slice(0, -1).reduce((s, w) => s + w.hours, 0) / Math.max(1, n - 1);
  return (
    <div className="tchart">
      <svg viewBox={`0 0 ${Wd} ${Hd}`} role="img" aria-label="Trainingsstunden pro Woche">
        {[0, max / 2.2, max / 1.1].map((v, k) => <g key={k}><line x1={l} x2={Wd - r} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={l - 5} y={y(v) + 3} textAnchor="end">{v.toFixed(0)}</text></g>)}
        {weeks.map((w, i) => {
          const x0 = l + i * bw + 1, wd = Math.max(2, bw - 2), hE = y(0) - y(w.endH), hS = y(0) - y(w.strH);
          return (
            <g key={i} onPointerEnter={() => setHi(i)} onPointerLeave={() => setHi(null)}>
              <rect x={l + i * bw} y={t} width={bw} height={Hd - t - b} fill="transparent" />
              {w.endH > 0 && <rect x={x0} y={y(w.endH)} width={wd} height={Math.max(0, hE)} rx={Math.min(3, wd / 2)} fill="var(--ch-1)" opacity={hi == null || hi === i ? 1 : 0.5} />}
              {w.strH > 0.05 && <rect x={x0} y={y(w.endH + w.strH)} width={wd} height={Math.max(0, hS - 2)} rx={Math.min(3, wd / 2)} fill="var(--ch-2)" opacity={hi == null || hi === i ? 1 : 0.5} />}
            </g>
          );
        })}
        <line x1={l} x2={Wd - r} y1={y(avg)} y2={y(avg)} stroke="var(--muted)" strokeDasharray="4 4" />
        <text x={Wd - r} y={y(avg) - 4} textAnchor="end">Ø {avg.toFixed(1)} h</text>
        {[0, n - 1].map((i) => <text key={i} x={l + i * bw + bw / 2} y={Hd - 6} textAnchor={i === 0 ? "start" : "end"}>{dm(weeks[i].from)}</text>)}
      </svg>
      {hi != null && (
        <div className="ttip" style={{ left: `${((l + hi * bw + bw / 2) / Wd) * 100}%`, transform: `translateX(${hi > n * 0.6 ? "-105%" : "5%"})` }}>
          <b>Woche ab {dm(weeks[hi].from)}</b>
          <span>{weeks[hi].hours.toFixed(1)} h · {weeks[hi].sessions} Einheiten</span>
          <span><i className="sw" style={{ background: "var(--ch-1)" }} />Ausdauer {weeks[hi].endH.toFixed(1)} h</span>
          <span><i className="sw" style={{ background: "var(--ch-2)" }} />Kraft {weeks[hi].strH.toFixed(1)} h</span>
        </div>
      )}
    </div>
  );
}
