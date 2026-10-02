// Rückmeldungen an den Coach: freie Hinweise («Wochenende geht nicht, dafür Mo/Di 2×»), gültig diese Woche oder dauerhaft.
// Alle KI-Texte bekommen die aktiven Hinweise mit; auf Wunsch setzt die KI sie in den Wochenplan um.
import { addDays } from "./metrics";

export const mondayOfDay = (d) => addDays(d, -((new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7));
// aktiv: dauerhaft, oder «diese Woche» und noch in derselben Woche (bzw. bis Ende der Folgewoche, wenn am Wochenende geschrieben)
export function activeNotes(manual = [], today) {
  const mon = mondayOfDay(today);
  return manual.filter((e) => e.kind === "coach_note" && e.data?.text && (e.data.scope === "always" || addDays(mondayOfDay(e.day), e.data.nextWeek ? 13 : 6) >= today && e.day >= addDays(mon, -7)))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
export const notesBrief = (notes) => (notes.length ? notes.slice(0, 8).map((n) => ({ datum: n.day, hinweis: n.data.text, gilt: n.data.scope === "always" ? "dauerhaft" : "diese Woche", zu: n.data.ctx || null })) : null);
