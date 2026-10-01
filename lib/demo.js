import * as repo from "./repo";
import { todayIso } from "./metrics";
import { generateDemo } from "./demogen";

// "Beispieldaten laden" für ein eigenes Konto: erzeugen und speichern (alle Zeilen is_demo=true).
export async function seedDemo(userId, kg = 80, { rich = false } = {}) {
  await clearDemo(userId);
  const { acts, daily, manual, feel } = generateDemo({ seed: userId, kg, rich, today: todayIso() });
  await repo.upsertActivities(userId, acts);
  await repo.upsertDaily(userId, daily);
  await repo.addManualMany(userId, manual);
  if (rich) await repo.write(`u/${userId}/feel.json`, feel);
  return acts.length + daily.length + manual.length;
}

export async function clearDemo(userId) {
  await repo.clearDemoData(userId);
}
