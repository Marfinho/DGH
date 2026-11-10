# Dorfplaner

Selbst gehostetes Planungstool für Veranstaltungen der Dorfgemeinschaft und Keimzelle einer Bürgerapp (Next.js 15, Prisma/SQLite, Caddy). UI auf Deutsch.

## Funktionen
**Planung (Orga):** Vorlagen mit Fristen relativ zum Veranstaltungstag · Veranstaltungen als Projekte mit Meilensteinen, Aufgaben (Status, Zuständige) · Lessons Learned · „Als Vorlage speichern“ · Änderungsprotokoll · Helfer-Slots · Zu-/Absagen-Übersicht

**Bewohner:** Veranstaltungen ansehen, zu-/absagen (mit Begleitung), sich für Helfer-Slots eintragen · „Meine Aufgaben“ · Neuigkeiten · Vereine/Gruppen & Ansprechpartner · Müllkalender

**Technik:** Login per Einladungscode oder E-Mail-Link · Rollen Admin / Organisator / Bewohner · persönlicher iCal-Feed · PWA (installierbar) mit Push-Benachrichtigungen · DSGVO-Datenexport und Konto löschen

| Rolle | darf |
|---|---|
| Bewohner | veröffentlichte Veranstaltungen sehen, zu-/absagen, Slots, eigene Aufgaben abhaken, Neuigkeiten/Gruppen/Müll lesen |
| Organisator | + Vorlagen, Veranstaltungen, Aufgaben, Slots, Neuigkeiten, Gruppen, Kontakte, Müllkalender pflegen |
| Admin | + Personen, Rollen, Einladungen, Sitzungen verwalten |

Aufgaben und Änderungsprotokoll sehen nur Organisatoren; Bewohner sehen nur ihre eigenen Aufgaben. Neue Veranstaltungen sind zunächst **Entwürfe** und erscheinen für Bewohner erst nach „Veröffentlichen“.

## Lokal entwickeln
```bash
cp .env.example .env
npm install
npx prisma migrate dev
npm run db:seed                              # Vorlagen „Dorffest“, „Laternenumzug“
npm run admin -- "Dein Name" du@example.de   # legt den ersten Admin an, gibt Einladungscode aus
npm run dev                                  # http://localhost:3000 → mit dem Code anmelden
npm test
```
Ohne `SMTP_URL` landen E-Mail-Links im Server-Log; Einladungscodes funktionieren immer.

## Deployment (VPS, Docker Compose)
```bash
cp .env.example .env     # DOMAIN, APP_URL (https://…), CRON_SECRET, optional SMTP_URL, VAPID_*
npx web-push generate-vapid-keys             # Push-Schlüssel in .env eintragen
docker compose up -d --build
docker compose exec app npm run admin -- "Dein Name" du@example.de
docker compose exec app npm run db:seed      # optional
```
Caddy holt automatisch Let's-Encrypt-Zertifikate (DNS muss auf den VPS zeigen). Der Dienst `reminders` löst täglich ~7–8 Uhr die Push-Erinnerungen aus. Push funktioniert nur über HTTPS; auf dem iPhone erst „Zum Home-Bildschirm“.

## Updates & Backup
```bash
git pull && docker compose up -d --build     # Migrationen laufen beim Start
docker compose exec app cp /data/dorfplaner.db /data/backup.db
docker compose cp app:/data/backup.db ./backup-$(date +%F).db
```

## Datenschutz (DSGVO)
- Gespeichert werden Name, freiwillig E-Mail/Telefon, Rolle, Zu-/Absagen, Helfer-Einträge, Push-Abos. Kein Tracking, keine externen Fonts/CDNs, keine Cookies außer dem Sitzungs-Cookie.
- Sitzungs-Tokens, Einladungscodes und Anmelde-Links werden nur als SHA-256-Hash gespeichert. Anmelde-Links gelten 15 Min und einmalig, Codes 7 Tage und einmalig.
- Jede Person kann unter „Mein Profil“ ihre Daten exportieren (JSON) und ihr Konto löschen; Admins können Personen löschen und Sitzungen beenden.
- „Vereine & Kontakte“ ist für alle angemeldeten Bewohner sichtbar – Kontaktdaten nur mit Einverständnis eintragen.
- Der iCal-Link enthält ein geheimes Token (jederzeit erneuerbar). Der Service Worker speichert keine Seiteninhalte.
- Ins Verarbeitungsverzeichnis des Verantwortlichen (Verein/Gemeinde) aufnehmen; Datenschutzerklärung bereitstellen.

## Struktur
`prisma/` Schema, Migrationen, Seed, Admin-CLI · `src/app` Seiten, Server Actions, API (iCal, Push, Cron, Export) · `src/lib` Auth, Datums-/Vorlagenlogik, iCal, Push, Mail · `public/` Manifest, Service Worker, Icons
