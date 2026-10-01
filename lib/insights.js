// "Was hat sich verändert?" – nur Veränderungen, die über dem persönlichen Rauschen liegen.
// Vergleich: letzte 30 Tage gegen die 30 Tage vor 90 Tagen (Volumen: letzte 4 Wochen gegen 4 Wochen vor 90 Tagen).
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const sd = (a) => { const m = mean(a); return a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : 0; };
const vals = (all, key, end, len) => all.slice(Math.max(0, end - len + 1), end + 1).map((d) => d[key]).filter((v) => v != null);

export function changes(all, { focus = "performance", manual = [], zonesHistory = [] } = {}) {
  const i = all.length - 1, j = i - 90, res = [];
  if (j < 35) return res;
  const cmp = (key, label, { len = 30, mode = "pct", dir = 1, min = 0, unit = "", scale = 1, dec = 1 }) => {
    const A = vals(all, key, i, len), B = vals(all, key, j, len);
    if (A.length < len * 0.4 || B.length < len * 0.4) return;
    const a = mean(A), b = mean(B), d = a - b, se = Math.sqrt(sd(A) ** 2 / A.length + sd(B) ** 2 / B.length);
    const val = mode === "pct" ? (d / b) * 100 : d * scale;
    res.push({ key, label, val, unit: mode === "pct" ? " %" : unit, dec: mode === "pct" ? 1 : dec, dir, sig: Math.abs(d) > 2 * se && Math.abs(val) >= min, z: se ? Math.abs(d) / se : 0, now: a * (mode === "pct" ? 1 : scale), before: b * (mode === "pct" ? 1 : scale) });
  };
  cmp("vo2max", "VO₂max", { len: 14, dir: 1, min: 1 });
  cmp("hrv", "HRV", { dir: 1, min: 3 });
  cmp("rhr", "Ruhepuls", { mode: "abs", dir: -1, min: 1, unit: " bpm" });
  cmp("sleep", "Schlaf", { mode: "abs", dir: 1, min: 12, unit: " min", scale: 60, dec: 0 });
  cmp("weight", "Gewicht", { len: 14, mode: "abs", dir: focus === "cut" ? -1 : focus === "muscle" ? 1 : 0, min: 0.8, unit: " kg" });
  cmp("score", "Ø Tagesform", { mode: "abs", dir: 1, min: 4, unit: " Pkt.", dec: 0 });

  // Volumen über Wochensummen
  const weeks = (key, end) => [0, 1, 2, 3].map((w) => all.slice(Math.max(0, end - 7 * (w + 1) + 1), end - 7 * w + 1).reduce((s, d) => s + (d[key] || 0), 0));
  for (const [key, label] of [["end", "Ausdauerlast"], ["str", "Kraftvolumen"]]) {
    const A = weeks(key, i), B = weeks(key, j), a = mean(A), b = mean(B);
    if (!b && !a) continue;
    if (b < 5) { if (a > 20) res.push({ key, label, val: null, text: `${label} neu aufgebaut`, dir: 0, sig: true, z: 3 }); continue; }
    const val = ((a - b) / b) * 100, se = Math.sqrt(sd(A) ** 2 / 4 + sd(B) ** 2 / 4);
    res.push({ key, label, val, unit: " %", dec: 0, dir: 0, sig: Math.abs(a - b) > 2 * se && Math.abs(val) >= 15, z: se ? Math.abs(a - b) / se : 0, warn: key === "str" && val <= -15 });
  }
  // Fitness (CTL)
  if (all[j].ctl > 5) { const val = ((all[i].ctl - all[j].ctl) / all[j].ctl) * 100; res.push({ key: "ctl", label: "Fitness (CTL)", val, unit: " %", dec: 0, dir: 1, sig: Math.abs(val) >= 8, z: Math.abs(val) / 4 }); }
  // FTP aus Tests
  const ftp = manual.filter((m) => m.kind === "test" && ["ramp", "twenty", "zftp"].includes(m.data?.test)).sort((a, b) => (a.day < b.day ? -1 : 1));
  if (ftp.length >= 2) {
    const last = ftp[ftp.length - 1], prev = [...ftp].reverse().find((t) => t.day <= all[j].day) || ftp[0];
    if (prev !== last) { const val = ((Number(last.value) - Number(prev.value)) / Number(prev.value)) * 100; res.push({ key: "ftp", label: "FTP", val, unit: " %", dec: 1, dir: 1, sig: Math.abs(val) >= 2, z: Math.abs(val), extra: `${Number(prev.value)} → ${Number(last.value)} W` }); }
  }
  // Körperfett
  const bf = manual.filter((m) => m.kind === "bodyfat").sort((a, b) => (a.day < b.day ? -1 : 1));
  if (bf.length >= 2) {
    const last = bf[bf.length - 1], prev = [...bf].reverse().find((t) => t.day <= all[j].day);
    if (prev && prev !== last) { const val = Number(last.value) - Number(prev.value); res.push({ key: "bodyfat", label: "Körperfett", val, unit: " Pkt.", dec: 1, dir: -1, sig: Math.abs(val) >= 1, z: Math.abs(val) * 2, extra: `${Number(prev.value)} → ${Number(last.value)} %` }); }
  }
  return res.sort((a, b) => b.sig - a.sig || b.z - a.z);
}
