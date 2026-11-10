# Dorfplaner

Selbst gehostetes Planungstool für Veranstaltungen der Dorfgemeinschaft (Next.js, Prisma/SQLite, Caddy). UI auf Deutsch.

**Stufe 1 (MVP):** Vorlagen mit relativen Fristen, Veranstaltungen als Projekte, Meilensteine, Aufgaben mit Status und Zuständigen, Übersicht, Lessons Learned, „Als Vorlage speichern“, Änderungsprotokoll.

## Lokal entwickeln
```bash
cp .env.example .env
npm install
npx prisma migrate dev     # DB anlegen
npm run db:seed            # Vorlagen „Dorffest“ und „Laternenumzug“
npm run dev                # http://localhost:3000
npm test                   # Datumslogik
```

## Deployment (VPS)
```bash
cp .env.example .env       # DOMAIN, BASIC_AUTH_USER, BASIC_AUTH_HASH setzen
docker run --rm caddy caddy hash-password --plaintext 'GEHEIMES-PASSWORT'   # -> BASIC_AUTH_HASH (jedes $ in .env als $$ schreiben)
docker compose up -d --build
docker compose exec app npx tsx prisma/seed.ts   # optional: Beispielvorlagen
```
Caddy holt automatisch Let's-Encrypt-Zertifikate; DNS muss auf den VPS zeigen. Schutz in Stufe 1: ein gemeinsames Passwort (Basic Auth).

## Backup
Die SQLite-Datei liegt im Volume `dorfplaner-data` (`/data/dorfplaner.db`):
```bash
docker compose exec app sh -c 'cp /data/dorfplaner.db /data/backup.db'
docker compose cp app:/data/backup.db ./backup-$(date +%F).db
```

## Datenschutz (DSGVO)
- Gespeichert werden nur Name und freiwillig E-Mail/Telefon der Zuständigen; kein Tracking, keine externen Schriften/CDNs.
- Personen können unter „Personen“ vollständig gelöscht werden (Aufgaben bleiben ohne Zuständigen).
- Die Anwendung gehört ins Verarbeitungsverzeichnis des Verantwortlichen (Verein/Gemeinde); Zweck: Veranstaltungsorganisation.
- Mit Stufe 2 (Login/Rollen) kommen Einwilligung/Einladung hinzu.

## Struktur
`prisma/` Schema, Migrationen, Seed · `src/app` Seiten + Server Actions · `src/lib` Datumslogik, Vorlagen-Logik, DB · `src/components` UI-Bausteine
