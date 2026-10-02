# Formstand iOS-App

Eine schlanke iOS-App um **formstand.vercel.app** (Capacitor). Die Inhalte kommen weiterhin live von der Webseite – jede Änderung an Formstand ist sofort auch in der App, ohne neues App-Update.

**Warum die App?** Beim Diktieren im Browser pausiert iOS die Musik (Safari öffnet das Mikrofon exklusiv). Die App nutzt eine eigene, native Spracherkennung (`FormstandSpeechPlugin` in `ios/App/App/AppDelegate.swift`), die das Mikrofon mit `mixWithOthers` öffnet: **Spotify & Co. laufen weiter.** Erkannt wird, wenn möglich, direkt auf dem iPhone – keine KI-Kosten.

## Was du brauchst
1. **Apple Developer Program** (99 USD pro Jahr): developer.apple.com/programs
2. **Einen Mac mit Xcode** (aktuelle Version, gratis im App Store).
   Ohne Mac geht es über einen Cloud-Build-Dienst (z. B. Codemagic oder Xcode Cloud) – etwas mehr Einrichtung.

## Bauen und aufs iPhone (ca. 20 Minuten beim ersten Mal)
```bash
cd mobile
npm install
npx cap sync ios
npx cap open ios        # öffnet das Projekt in Xcode
```
In Xcode:
1. Links **App** anklicken → Reiter **Signing & Capabilities** → bei **Team** dein Developer-Konto wählen.
   Falls die Bundle-ID `app.formstand.ios` schon vergeben ist: eine eigene setzen, z. B. `ch.deinname.formstand`.
2. iPhone per Kabel anschliessen, oben als Ziel wählen, **▶ Run**. Beim ersten Mal auf dem iPhone unter
   *Einstellungen → Allgemein → VPN & Geräteverwaltung* dem Entwickler vertrauen.

## An Kollegen verteilen (TestFlight)
1. In Xcode: **Product → Archive** → **Distribute App** → **TestFlight & App Store**.
2. Auf appstoreconnect.apple.com die App anlegen (Name, Bundle-ID).
3. **Interne Tester**: Kollegen unter *Benutzer und Zugriff* einladen, dann in TestFlight hinzufügen – bis 100 Personen, ohne Apple-Prüfung.
   Externe Tester (ohne Konto-Zugang) brauchen eine kurze Beta-Prüfung durch Apple.
4. Die Kollegen installieren die App **TestFlight** und tippen auf die Einladung.

Ein öffentlicher App-Store-Eintrag ist möglich, Apple lehnt reine «Webseiten in einer Hülle» aber oft ab. Für den Kollegenkreis ist TestFlight der richtige Weg.

## Gut zu wissen
- **Diktieren**: in der App automatisch nativ (Musik läuft weiter); im Browser weiterhin über Safari/Chrome.
- **Anmeldung**: Die App hat ihren eigenen Speicher – einmal neu anmelden.
- **Morgen-Erinnerung (Push)**: Web-Push funktioniert in iOS-Apps dieser Art nicht. Die Erinnerung weiterhin über die Web-App vom Home-Bildschirm laufen lassen – oder als nächsten Schritt native Push-Mitteilungen (Apple Push) einbauen.
- **Nächster sinnvoller Ausbau**: Apple Health (HealthKit) direkt anbinden – Schlaf, HRV, Ruhepuls und Workouts der Apple Watch ohne Umweg.
- **Nach Änderungen an der App selbst** (z. B. `AppDelegate.swift`, Icon): `npx cap sync ios`, dann in Xcode neu bauen. Änderungen an der Webseite brauchen kein App-Update.
