// Mini-Verlauf: Linie der letzten Tage, Band = dein Normalbereich (Ø ± 1 Streuung), Punkt = heute
export default function Spark({ pts = [], m = null, s = null, tone = "", w = 160, h = 42 }) {
  const vals = pts.filter((v) => v != null);
  if (vals.length < 2) return null;
  const lo0 = Math.min(...vals, m != null && s ? m - s : Infinity), hi0 = Math.max(...vals, m != null && s ? m + s : -Infinity);
  const pad = (hi0 - lo0) * 0.12 || 1, lo = lo0 - pad, hi = hi0 + pad;
  const x = (i) => (i * (w - 6)) / Math.max(1, pts.length - 1) + 3, y = (v) => h - 3 - ((v - lo) / (hi - lo)) * (h - 6);
  let d = "", on = false;
  pts.forEach((v, i) => { if (v == null) { on = false; return; } d += `${on ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; on = true; });
  const li = pts.map((v, i) => (v == null ? -1 : i)).filter((i) => i >= 0).at(-1);
  const col = tone === "good" ? "var(--good)" : tone === "crit" ? "var(--crit)" : tone === "warn" ? "var(--warn)" : "var(--accent)";
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      {m != null && s ? <rect x="0" width={w} y={y(m + s)} height={Math.max(1, y(m - s) - y(m + s))} fill="var(--accent)" opacity=".1" rx="3" /> : null}
      {m != null && <line x1="0" x2={w} y1={y(m)} y2={y(m)} stroke="var(--line2)" strokeDasharray="3 3" />}
      <path d={d} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {vals.length < 10 && pts.map((v, i) => (v == null || i === li ? null : <circle key={i} cx={x(i)} cy={y(v)} r="2" fill={col} opacity=".6" />))}
      <circle cx={x(li)} cy={y(pts[li])} r="3" fill={col} />
    </svg>
  );
}
