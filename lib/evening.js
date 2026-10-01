// Einflussfaktoren je Tag aus den manuellen Einträgen: { "2026-09-30": { alc: 2, f: ["spaet", "stress"] } }
export function eveningMap(manual, fromDay) {
  const out = {};
  for (const e of manual) {
    if (e.kind !== "trigger" || (fromDay && e.day < fromDay)) continue;
    const o = (out[e.day] ||= { alc: 0, f: [] });
    if (e.data?.t === "alkohol") o.alc += Number(e.value) || 1;
    else if (e.data?.t && !o.f.includes(e.data.t)) o.f.push(e.data.t);
  }
  return out;
}
