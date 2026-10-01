"use client";
import { useEffect, useMemo, useState } from "react";
import DateField from "./DateField";

const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const RANGES = { woche: 7, monat: 30, quartal: 91, jahr: 365 };
const pad = (n) => String(n).padStart(2, "0");
const D = (s) => new Date(s + "T00:00:00Z");
const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const add = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const fmtD = (s) => `${s.slice(8, 10)}.${s.slice(5, 7)}.`;
const fmtF = (s) => `${fmtD(s)}${s.slice(0, 4)}`;
const mean = (a) => { const v = a.filter((x) => x != null && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const sum = (a, k) => a.reduce((s, p) => s + (p[k] || 0), 0);
const monday = (s) => { const d = D(s); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };
const isoWeek = (s) => { const t = D(s); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const y = Date.UTC(t.getUTCFullYear(), 0, 1); return Math.ceil(((t - y) / 864e5 + 1) / 7); };
const path = (pts) => pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join("");
const stateOf = (s) => (s >= 67 ? "good" : s >= 34 ? "warn" : "crit");

function buckets(days, g) {
  const m = new Map();
  for (const p of days) {
    const k = g === "tag" ? p.day : g === "woche" ? monday(p.day) : p.day.slice(0, 7);
    if (!m.has(k)) m.set(k, { start: p.day, days: [] });
    m.get(k).days.push(p);
  }
  return [...m.values()].map((b) => ({ ...b, label: g === "tag" ? fmtD(b.start) : g === "woche" ? "KW " + isoWeek(b.start) : MON[Number(b.start.slice(5, 7)) - 1],
    end: sum(b.days, "end"), str: sum(b.days, "str"), other: sum(b.days, "other"), score: mean(b.days.map((p) => p.score)) }));
}
function agg(days) {
  if (!days.length) return null;
  return { h: sum(days, "min") / 60, n: sum(days, "n"), end: sum(days, "end"), str: sum(days, "str"), other: sum(days, "other"),
    strN: days.filter((p) => p.str > 0).length, score: mean(days.map((p) => p.score)), hrv: mean(days.map((p) => p.hrv)), rhr: mean(days.map((p) => p.rhr)),
    sleep: mean(days.map((p) => p.sleep)), sleepScore: mean(days.map((p) => p.sleepScore)), bbHigh: mean(days.map((p) => p.bbHigh)), stress: mean(days.map((p) => p.stress)),
    readiness: mean(days.map((p) => p.readiness)), vo2max: mean(days.slice(-14).map((p) => p.vo2max)), deep: mean(days.map((p) => p.deep)), alc: days.filter((p) => p.alc > 0).length, weight: mean(days.slice(-14).map((p) => p.weight)), ctl: days[days.length - 1].ctl };
}
function Delta({ c, p, up = true, abs = false, unit = "" }) {
  if (p == null || c == null || !Number.isFinite(p) || (!abs && p === 0)) return <span className="delta flat">keine Vorperiode</span>;
  const dv = abs ? c - p : ((c - p) / Math.abs(p)) * 100;
  const flat = Math.abs(dv) < (abs ? (unit === " Pkt." ? 1 : 0.05) : 2);
  const cls = flat ? "flat" : (dv > 0) === up ? "up" : "down";
  const v = abs ? (Math.abs(dv) < 10 ? Math.abs(dv).toFixed(1) : Math.round(Math.abs(dv))) + unit : Math.round(Math.abs(dv)) + " %";
  return <span className={`delta ${cls}`}>{flat ? "■" : dv > 0 ? "▲" : "▼"} {v}</span>;
}
function Seg({ value, onChange, options, small }) {
  return <div className={`seg${small ? " sm" : ""}`} role="group">{options.map(([k, l]) => <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}>{l}</button>)}</div>;
}
const Svg = ({ html }) => <div dangerouslySetInnerHTML={{ __html: html }} />;

export default function Dashboard({ demo = false }) {
  const [range, setRange] = useState("jahr");
  const [group, setGroup] = useState("auto");
  const [heat, setHeat] = useState("load");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("fs-dash") || "{}"); if (s.range) setRange(s.range); if (s.group) setGroup(s.group); if (s.heat) setHeat(s.heat); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem("fs-dash", JSON.stringify({ range, group, heat })); } catch {} }, [range, group, heat]);

  const today = data?.today || iso(new Date());
  const [from, to] = useMemo(() => {
    if (range === "custom" && custom.from && custom.to) return custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
    return [add(today, -(RANGES[range] || 365) + 1), today];
  }, [range, custom, today]);

  useEffect(() => {
    let off = false;
    setErr("");
    fetch(`/api/dashboard?${demo ? "demo=1&" : ""}from=${from}&to=${to}`).then((r) => r.json()).then((j) => { if (off) return; if (j.error) setErr(j.error); else setData(j); }).catch(() => !off && setErr("Daten konnten nicht geladen werden."));
    return () => { off = true; };
  }, [from, to]);

  if (err) return <div className="notice crit">{err}</div>;
  if (!data) return <div className="empty">Lade Daten…</div>;

  const all = data.days;
  const days = all.filter((p) => p.day >= from && p.day <= to);
  const prevFrom = add(from, -days.length);
  const prev = all.filter((p) => p.day >= prevFrom && p.day < from);
  const C = agg(days), P = prev.some((p) => p.min > 0 || p.score != null) ? agg(prev) : null;
  const g = group !== "auto" ? group : days.length <= 31 ? "tag" : days.length <= 200 ? "woche" : "monat";
  const hasData = days.some((p) => p.min > 0 || p.score != null || p.weight != null);

  const controls = (
    <div className="panel dctl">
      <Seg value={range} onChange={setRange} options={[["woche", "Woche"], ["monat", "Monat"], ["quartal", "Quartal"], ["jahr", "Jahr"], ["custom", "Eigener"]]} />
      {range === "custom" && (
        <div className="form">
          <label className="f">Von<DateField value={custom.from || from} max={today} onChange={(v) => setCustom({ ...custom, from: v, to: custom.to || to })} required /></label>
          <label className="f">Bis<DateField value={custom.to || to} max={today} onChange={(v) => setCustom({ ...custom, to: v, from: custom.from || from })} required /></label>
        </div>
      )}
      <Seg small value={group} onChange={setGroup} options={[["auto", "Auto"], ["tag", "Tage"], ["woche", "Wochen"], ["monat", "Monate"]]} />
    </div>
  );
  const sub = <p className="note">{fmtF(from)} – {fmtF(to)} · {days.length} Tage · nach {g === "tag" ? "Tagen" : g === "woche" ? "Wochen" : "Monaten"} · {P ? `verglichen mit den ${prev.length} Tagen davor` : "keine Vorperiode in den Daten"}</p>;
  if (!hasData) return <>{controls}{sub}<div className="empty">Im gewählten Zeitraum liegen noch keine Daten. Quellen verbinden oder Beispieldaten laden.</div></>;

  const train = C.end + C.str, strShare = train ? (C.str / train) * 100 : 0, pStr = P && P.end + P.str ? (P.str / (P.end + P.str)) * 100 : null;

  // Gestapelte Balken
  const B = buckets(days, g), W = 760, H = 270, L = 40, Rr = 34, T = 12, Bt = 26;
  const maxL = Math.max(...B.map((b) => b.end + b.str + b.other), 1);
  const step = maxL > 2000 ? 1000 : maxL > 800 ? 250 : maxL > 300 ? 100 : maxL > 120 ? 50 : 25, top = Math.ceil(maxL / step) * step;
  const bw = (W - L - Rr) / B.length, X = (i) => L + i * bw, Y = (v) => T + ((top - v) * (H - T - Bt)) / top, YS = (v) => T + ((100 - v) * (H - T - Bt)) / 100;
  const full = g === "tag" ? 1 : g === "woche" ? 7 : 28, gap = Math.min(6, bw * 0.25), lstep = Math.ceil(B.length / 12);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Belastung nach Art">`;
  for (let v = 0; v <= top; v += step) s += `<line x1="${L}" x2="${W - Rr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${Y(v) + 3}" text-anchor="end">${v >= 1000 ? v / 1000 + "k" : v}</text>`;
  for (const v of [0, 50, 100]) s += `<text x="${W - Rr + 6}" y="${YS(v) + 3}">${v}</text>`;
  B.forEach((b, i) => {
    let base = 0; const bx = X(i) + gap / 2, w = Math.max(1, bw - gap), part = b.days.length < full;
    if (part) s += `<g opacity=".4">`;
    for (const [k, col, n] of [["end", "var(--c-end)", "Ausdauer"], ["str", "var(--c-str)", "Kraft"], ["other", "var(--c-day)", "Alltag"]]) {
      const v = b[k]; if (v <= 0) continue;
      s += `<rect x="${bx.toFixed(1)}" y="${Y(base + v).toFixed(1)}" width="${w.toFixed(1)}" height="${(Y(base) - Y(base + v)).toFixed(1)}" fill="${col}" rx="${Math.min(3, w / 4)}"><title>${b.label}: ${n} ${Math.round(v)}</title></rect>`;
      base += v;
    }
    if (part) s += `</g>`;
    if (i % lstep === 0) s += `<text x="${X(i) + bw / 2}" y="${H - 8}" text-anchor="middle">${b.label}</text>`;
  });
  const lp = B.map((b, i) => (b.score == null ? null : [X(i) + bw / 2, YS(b.score)])).filter(Boolean);
  if (lp.length > 1) s += `<path d="${path(lp)}" fill="none" stroke="var(--fg)" stroke-width="2" stroke-linejoin="round" opacity=".8"/>`;
  if (lp.length <= 60) lp.forEach((p) => (s += `<circle cx="${p[0]}" cy="${p[1]}" r="2.6" fill="var(--surface)" stroke="var(--fg)" stroke-width="1.5"/>`));
  s += "</svg>";

  // Aufteilung
  const tot = C.end + C.str + C.other || 1, zl = sum(days, "low"), zm = sum(days, "mid"), zh = sum(days, "high"), zt = zl + zm + zh || 1;
  const sbar = (parts) => (
    <>
      <div className="sbar">{parts.filter((p) => p[1] > 0.5).map((p) => <i key={p[0]} style={{ width: `${p[1]}%`, background: p[2] }} title={`${p[0]} ${Math.round(p[1])} %`} />)}</div>
      <div className="slegend">{parts.map((p) => <span key={p[0]}><i style={{ background: p[2] }} />{p[0]} <em>{Math.round(p[1])} %</em></span>)}</div>
    </>
  );
  const low = (zl / zt) * 100, mid = (zm / zt) * 100, high = (zh / zt) * 100;

  // Highlights
  const wk = buckets(days, "woche"), bestW = wk.reduce((m, b) => (b.end + b.str > m.end + m.str ? b : m), wk[0]);
  const scored = days.filter((p) => p.score != null), best = scored.reduce((m, p) => (p.score > m.score ? p : m), scored[0] || null);
  const longest = days.reduce((m, p) => (p.min > m.min ? p : m), days[0]);
  let run = 0, maxRun = 0; days.forEach((p) => { run = p.alc > 0 ? 0 : run + 1; maxRun = Math.max(maxRun, run); });
  const ftps = (data.tests || []).filter((t) => ["ramp", "twenty", "zftp"].includes(t.test) && t.day >= from && t.day <= to);
  const first = days.find((p) => p.ctl != null);

  // Werte
  const SB = buckets(days, days.length <= 31 ? "tag" : "woche");
  const metrics = [["Ø Tagesform", "score", (v) => Math.round(v), "/100", true, true, "var(--accent)"], ["Ø HRV", "hrv", (v) => Math.round(v), " ms", true, false, "var(--good)"],
    ["Ø Ruhepuls", "rhr", (v) => Math.round(v), " bpm", false, false, "var(--crit)"], ["Ø Schlaf", "sleep", (v) => v.toFixed(1), " h", true, true, "var(--s3)"],
    ["Gewicht", "weight", (v) => v.toFixed(1), " kg", false, true, "var(--s1)"], ["Fitness (CTL)", "ctl", (v) => Math.round(v), "", true, false, "var(--c-end)"],
    ["Ø Sleep Score", "sleepScore", (v) => Math.round(v), "/100", true, true, "var(--s2)"], ["Ø Body Battery max", "bbHigh", (v) => Math.round(v), "", true, true, "var(--good)"],
    ["Ø Stress", "stress", (v) => Math.round(v), "", false, true, "var(--warn)"], ["Training Readiness", "readiness", (v) => Math.round(v), "", true, true, "var(--accent)"],
    ["VO2max", "vo2max", (v) => v.toFixed(1), "", true, true, "var(--s4)"], ["Ø Tiefschlaf", "deep", (v) => v.toFixed(1), " h", true, true, "var(--s3)"]]
    .filter(([, key], i) => i < 6 || days.some((p) => p[key] != null));

  // Heatmap 12 Monate
  const HF = all.filter((p) => p.day > add(today, -365) && p.day <= today), cs = 12, gp = 3;
  const hstart = HF.length ? monday(HF[0].day) : today, weeks = Math.ceil(((D(today) - D(hstart)) / 864e5 + 1) / 7), HW = 34 + weeks * (cs + gp), HH = 22 + 7 * (cs + gp);
  const mx = Math.max(1, ...HF.map((p) => p.end + p.str));
  let hm = `<svg viewBox="0 0 ${HW} ${HH}" width="${HW}" role="img" aria-label="Jahresübersicht">`;
  ["Mo", "Mi", "Fr", "So"].forEach((d, i) => (hm += `<text x="0" y="${22 + [0, 2, 4, 6][i] * (cs + gp) + cs - 2}">${d}</text>`));
  let lastM = -1;
  HF.forEach((p) => {
    const wi = Math.floor((D(p.day) - D(hstart)) / 864e5 / 7), di = (D(p.day).getUTCDay() + 6) % 7, cx = 34 + wi * (cs + gp), cy = 22 + di * (cs + gp);
    const m = Number(p.day.slice(5, 7)) - 1;
    if (di === 0 && m !== lastM && Number(p.day.slice(8, 10)) <= 7) { lastM = m; hm += `<text x="${cx}" y="12">${MON[m]}</text>`; }
    let fill = "var(--sunk)", op = 1, tip = "";
    const l = p.end + p.str;
    if (heat === "load") { if (l > 0) { fill = p.str > p.end ? "var(--c-str)" : "var(--c-end)"; op = 0.18 + 0.82 * Math.min(1, l / mx); } tip = `Last ${l}`; }
    else if (heat === "score") { if (p.score != null) { fill = `var(--${stateOf(p.score)})`; op = 0.25 + (0.75 * Math.abs(p.score - 50)) / 50; } tip = p.score != null ? `Tagesform ${p.score}` : "keine Daten"; }
    else if (heat === "sleep") { if (p.sleep != null) { fill = "var(--s3)"; op = Math.max(0.08, Math.min(1, (p.sleep - 5) / 3.5)); } tip = p.sleep != null ? `Schlaf ${p.sleep.toFixed(1)} h` : "keine Daten"; }
    else { if (p.alc > 0) { fill = "var(--warn)"; op = 0.3 + 0.7 * Math.min(1, p.alc / 4); tip = `Vorabend ${p.alc} Gläser`; } else tip = "kein Alkohol"; }
    const inR = p.day >= from && p.day <= to;
    hm += `<rect x="${cx}" y="${cy}" width="${cs}" height="${cs}" rx="3" fill="${fill}" opacity="${(inR ? op : op * 0.3).toFixed(2)}"><title>${fmtF(p.day)} · ${tip}</title></rect>`;
  });
  hm += "</svg>";

  const o = data.origin || {}, api = (o.acts || 0) + (o.daily || 0), mxO = Math.max(1, api, o.manual || 0, o.media || 0);
  const orow = (l, v, col, subt) => (
    <div className="orow"><span>{l}<br /><small className="note" style={{ fontWeight: 500 }}>{subt}</small></span>
      <div className="mbar"><i style={{ width: `${Math.max(v ? 2 : 0, (v / mxO) * 100)}%`, background: col }} /></div>
      <span className="num" style={{ textAlign: "right" }}>{(v || 0).toLocaleString("de-CH")}</span></div>
  );
  const K = ({ l, v, u, children }) => <div className="dk"><span>{l}</span><b>{v}<small>{u}</small></b>{children}</div>;

  return (
    <>
      {controls}
      {sub}
      <div className="dkpis">
        <K l="Trainingszeit" v={Math.round(C.h)} u="h"><Delta c={C.h} p={P?.h} /></K>
        <K l="Einheiten" v={C.n} u=""><Delta c={C.n} p={P?.n} /></K>
        <K l="Trainingslast" v={Math.round(train).toLocaleString("de-CH")} u=""><Delta c={train} p={P ? P.end + P.str : null} /></K>
        <K l="Kraft-Anteil" v={Math.round(strShare)} u="%"><Delta c={strShare} p={pStr} abs unit=" Pkt." /></K>
        <K l="Ø Tagesform" v={C.score == null ? "–" : Math.round(C.score)} u="/100"><Delta c={C.score} p={P?.score} abs unit=" Pkt." /></K>
        <K l="Alkohol-Abende" v={C.alc} u=""><Delta c={C.alc} p={P?.alc} up={false} /></K>
      </div>
      <div className="panel chart">
        <div className="panel-head"><h2>Belastung nach Art</h2><span className="note">Balken = Trainingslast · Linie = Ø Tagesform</span></div>
        <Svg html={s} />
        <div className="legend"><span><i style={{ background: "var(--c-end)", height: 8 }} />Ausdauer</span><span><i style={{ background: "var(--c-str)", height: 8 }} />Kraft</span><span><i style={{ background: "var(--c-day)", height: 8 }} />Alltag</span><span><i style={{ background: "var(--fg)" }} />Ø Tagesform</span></div>
      </div>
      <div className="grid2e">
        <div className="panel">
          <div className="panel-head"><h2>Aufteilung</h2><span className="note">{(C.strN / Math.max(1, days.length / 7)).toFixed(1)} Krafteinheiten pro Woche</span></div>
          <h3>Last nach Art</h3>
          {sbar([["Ausdauer", (C.end / tot) * 100, "var(--c-end)"], ["Kraft", (C.str / tot) * 100, "var(--c-str)"], ["Alltag", (C.other / tot) * 100, "var(--c-day)"]])}
          <h3>Intensität Ausdauer (Zeit, nach Puls)</h3>
          {sbar([["locker", low, "#7C9BFF"], ["mittel", mid, "#F6B94A"], ["hart", high, "#DC4545"]])}
          <div className="verdict">{zt <= 1 ? "Für die Intensität braucht es Pulsdaten." : low >= 75 ? <><b>Gut verteilt.</b> {Math.round(low)} % locker, {Math.round(high)} % hart. Das entspricht etwa dem 80/20-Prinzip.</> : mid > 15 ? <><b>Viel mittlere Intensität.</b> {Math.round(mid)} % im Graubereich. Lockere Einheiten lockerer, harte härter.</> : <><b>Etwas viel hart.</b> Nur {Math.round(low)} % locker. Mehr Grundlage aufbauen.</>}</div>
        </div>
        <div className="panel">
          <div className="panel-head"><h2>Highlights</h2><span className="note">im gewählten Zeitraum</span></div>
          <div className="hl">
            <div className="hli"><span>Stärkste Woche</span><b>{Math.round(bestW.end + bestW.str)} Last</b><small>{bestW.label} · ab {fmtD(bestW.start)}</small></div>
            <div className="hli"><span>Längste Einheit</span><b>{Math.floor(longest.min / 60)} h {pad(longest.min % 60)}</b><small>{fmtF(longest.day)}</small></div>
            <div className="hli"><span>Beste Tagesform</span><b>{best ? `${best.score}/100` : "–"}</b><small>{best ? fmtF(best.day) : "keine Recovery-Daten"}</small></div>
            <div className="hli"><span>Ohne Alkohol</span><b>{maxRun} Tage</b><small>längste Serie</small></div>
            <div className="hli"><span>Fitness (CTL)</span><b>{Math.round(first?.ctl || 0)} → {Math.round(C.ctl)}</b><small>{first?.ctl ? `${C.ctl >= first.ctl ? "+" : ""}${Math.round((C.ctl / first.ctl - 1) * 100)} % im Zeitraum` : ""}</small></div>
            <div className="hli"><span>FTP</span><b>{ftps.length ? `${Number(ftps[ftps.length - 1].value)} W` : "–"}</b><small>{ftps.length > 1 ? `${Number(ftps[ftps.length - 1].value) - Number(ftps[0].value) >= 0 ? "+" : ""}${Number(ftps[ftps.length - 1].value) - Number(ftps[0].value)} W seit ${fmtD(ftps[0].day)}` : ftps.length ? `Test vom ${fmtD(ftps[0].day)}` : "kein Test im Zeitraum"}</small></div>
          </div>
        </div>
      </div>
      <div className="panel chart">
        <div className="panel-head"><h2>Werte</h2><span className="note">Verlauf im Zeitraum · Änderung zur Vorperiode</span></div>
        <div className="multi">
          {metrics.map(([lbl, key, f, unit, up, abs, col]) => {
            const vals = SB.map((b) => mean(b.days.map((p) => p[key])));
            const cv = C[key], pv = P ? P[key] : null;
            const pts0 = vals.map((v, i) => [i, v]).filter((p) => p[1] != null);
            if (!pts0.length || cv == null) return <div key={key} className="mc"><div className="top"><span>{lbl}</span></div><span className="v">–</span><span className="note">keine Daten</span></div>;
            const w = 240, h = 60, lo = Math.min(...pts0.map((p) => p[1])), hi = Math.max(...pts0.map((p) => p[1])), rg = hi - lo || 1;
            const pts = pts0.map(([i, v]) => [4 + (i * (w - 8)) / Math.max(1, vals.length - 1), 6 + ((hi - v) * (h - 12)) / rg]);
            const last = pts[pts.length - 1];
            return (
              <div key={key} className="mc">
                <div className="top"><span>{lbl}</span><Delta c={cv} p={pv} up={up} abs={abs} unit={abs ? (unit === "/100" ? " Pkt." : unit) : ""} /></div>
                <span className="v">{f(cv)}<small className="note">{unit}</small></span>
                <Svg html={`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${path(pts)} L${last[0]},${h} L${pts[0][0]},${h}Z" fill="${col}" opacity=".10"/><path d="${path(pts)}" fill="none" stroke="${col}" stroke-width="2" stroke-linejoin="round"/><circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${col}" stroke="var(--surface)" stroke-width="1.5"/></svg>`} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid2">
        <div className="panel">
          <div className="panel-head"><h2>Datenherkunft</h2><span className="note">getrennt gespeichert</span></div>
          {orow("API", api, "var(--accent)", "Workouts und Tageswerte")}
          {orow("Manuell", o.manual || 0, "var(--c-str)", "Gewicht, Trigger, Tests")}
          {orow("Bilder & PDF", o.media || 0, "var(--s2)", "Fotos, InBody, Blutwerte")}
          <p className="note">Datensätze im Zeitraum. Rohdaten der Schnittstellen bleiben unverändert gespeichert.</p>
        </div>
        <div className="panel chart">
          <div className="panel-head"><h2>Jahr auf einen Blick</h2><Seg small value={heat} onChange={setHeat} options={[["load", "Last"], ["score", "Tagesform"], ["sleep", "Schlaf"], ["alc", "Alkohol"]]} /></div>
          <div className="tbl-wrap heat"><Svg html={hm} /></div>
          <p className="note">Hell = ausserhalb des gewählten Zeitraums.</p>
        </div>
      </div>
    </>
  );
}
