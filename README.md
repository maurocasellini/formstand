# Formstand

Trainings-Cockpit: Recovery, Workouts, Ernährung, Körper und Trigger aus allen Quellen, bereinigt zu einer Tagesform. Pro Konto getrennt, mit Rollen (Admin, Sportler, Coach).

## Stack
- Next.js 15 (App Router) auf Vercel
- Postgres (Neon via Vercel Storage), Schema legt die App beim ersten Start selbst an (`lib/db.js`)
- Vercel Blob (privat) für Fotos und PDFs
- Strava (OAuth + Webhook), WHOOP (OAuth v2); Garmin nach Freigabe des Developer Program

## Datenablage
| Tabelle | Inhalt |
|---|---|
| `raw_events` | Rohdaten der APIs, unverändert |
| `activities`, `daily_metrics` | normalisierte Workouts und Tageswerte je Quelle |
| `manual_entries` | Gewicht, Körperfett, Trigger, Tests, Notizen |
| `media` | Bilder und Dokumente (Datei im privaten Blob-Speicher) |
| `connections` | API-Verbindungen, Tokens AES-256-GCM verschlüsselt |
| `users`, `sessions`, `coach_athletes` | Konten, Logins, Coach-Zuordnung |

## Umgebungsvariablen
| Name | Zweck |
|---|---|
| `DATABASE_URL` | kommt automatisch mit Neon |
| `BLOB_READ_WRITE_TOKEN` | kommt automatisch mit Vercel Blob |
| `ENCRYPTION_KEY` | 32 Bytes base64, verschlüsselt API-Tokens |
| `CRON_SECRET` | schützt den täglichen Abgleich |
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN` | Strava-App (strava.com/settings/api) |
| `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET` | WHOOP-App (developer.whoop.com) |

Callback-URLs: `https://<domain>/api/oauth/strava` und `https://<domain>/api/oauth/whoop`.
Strava-Webhook einmalig registrieren:
```
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=$STRAVA_CLIENT_ID -F client_secret=$STRAVA_CLIENT_SECRET \
  -F callback_url=https://<domain>/api/webhooks/strava -F verify_token=$STRAVA_VERIFY_TOKEN
```

## Lokal
```
npm install
# .env.local: DATABASE_URL=postgres://…  LOCAL_PG=1  ENCRYPTION_KEY=…
npm run build && npm start
```
Das erste Konto unter `/setup` wird Admin.
