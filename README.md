# Dorfplaner

Selbst gehostetes Planungstool für Veranstaltungen der Dorfgemeinschaft und Keimzelle einer Bürgerapp (Next.js 15, Prisma/SQLite, Caddy). UI auf Deutsch.

**Design „Plakat“:** Logo-Farben Grün `#0B4F2A`, Rot `#BA1722`, Gelb `#FFCA01`, kräftige Rahmen, Condensed-Überschriften; Handy mit Tab-Leiste, Desktop mit Kopfmenü. Farben und Schriften stehen in `tailwind.config.ts` und `src/app/globals.css`, das Logo in `public/logo.png`.

## Funktionen
**Zwei Gesichter, eine App:** Für Bewohner ist der Dorfplaner eine einfache Bürger-App, für die Orga zusätzlich ein Planungswerkzeug.
- *Bewohner* sehen im Menü nur **Start · Termine · Brett · Müll** (+ „Mehr“). Die Startseite zeigt die nächste Veranstaltung mit „Ich komme!“, die nächste Müllabfuhr, Neuigkeiten, offene Umfragen und das Brett. „Mein Einsatz“ (zugewiesene Aufgaben, Helfer-Schichten) und „Zur Freigabe“ erscheinen nur, wenn es für die Person etwas gibt.
- *Orga* hat **Start · Termine · Planung · Aufgaben** (+ „Mehr“). Start ist dieselbe Bürgerseite (die Orga kann selbst zusagen), oben eine kompakte Karte zur **Planung** (`/planung`): alle laufenden Planungen mit Aufgaben, Überfälligen, Material, Helferbelegung, Zusagen und offenen Freigaben, dazu Eingang (Reservierungsanfragen, neue Anliegen, gemeldete Beiträge), überfällige und anstehende Fristen und die Werkzeuge (Vorlagen, Kalender, Archiv, Aushang, Umfrage, Neuigkeit).
- In jeder Veranstaltung zeigt **👁 Bürgeransicht** der Orga, wie Bewohner die Seite sehen (bei Entwürfen mit Hinweis).
- „Mehr“ ist gegliedert in *Für alle*, *Orga* und *Verwaltung*.

**Planung (Orga):** Vorlagen mit Fristen relativ zum Veranstaltungstag · Veranstaltungen als Projekte mit Meilensteinen, Aufgaben (Status, Zuständige) · Lessons Learned · „Als Vorlage speichern“ · Änderungsprotokoll · Helfer-Slots · Zu-/Absagen-Übersicht · **Budget pro Veranstaltung** (Rahmen, Ausgaben/Einnahmen, Prognose, Freigabe-Workflow)

**Bewohner:** Veranstaltungen ansehen, zu-/absagen (mit Begleitung), sich für Helfer-Slots eintragen · „Meine Aufgaben“ · Neuigkeiten · Vereine/Gruppen & Ansprechpartner · Müllkalender · Umfragen · Räume & Inventar reservieren

**Technik:** Login per Einladungscode oder E-Mail-Link · Rollen Admin / Organisator / Bewohner · persönlicher iCal-Feed · PWA (installierbar) mit Push-Benachrichtigungen · DSGVO-Datenexport und Konto löschen

| Rolle | darf |
|---|---|
| Bewohner | veröffentlichte Veranstaltungen sehen, zu-/absagen, Slots, eigene Aufgaben abhaken, Neuigkeiten/Gruppen/Müll lesen, abstimmen, reservieren |
| Organisator | + Vorlagen, Veranstaltungen, Aufgaben, Slots, Neuigkeiten, Gruppen, Kontakte, Müllkalender, Umfragen, Räume/Inventar und Reservierungen pflegen |
| Admin | + Personen, Rollen, Einladungen, Sitzungen verwalten |

**Freigeber pro Termin:** Für jede Veranstaltung können Personen (auch normale Bewohner) als *Freigeber* benannt werden. Sie sehen nur das Budget dieses Termins und geben Ausgaben frei oder lehnen sie (mit Begründung) ab. Ablauf einer Ausgabe: *Geplant → Zur Freigabe → Freigegeben/Abgelehnt → Bezahlt*. Eigene Anfragen kann niemand selbst freigeben (Vier-Augen-Prinzip, gilt auch für Admins); Beträge bis zu einer einstellbaren Grenze brauchen keine Freigabe. Wird ein freigegebener Betrag geändert, ist die Freigabe wieder offen. Freigeber und Antragsteller bekommen Push-Nachrichten, offene Freigaben stehen auf der Startseite. Budget-Posten werden mit der Vorlage übernommen (ohne Freigaben).

**Versammlungen des Orga-Teams** (`/versammlungen`, unter „Planung“; nur Organisator und Admin):
- *Termin*: Datum, Beginn/Ende, Ort, Tagesordnung (ein Punkt pro Zeile, sortierbar) und ein Einladungstext. Eingeladen sind zunächst alle mit Orga- oder Admin-Rolle, die Auswahl lässt sich anpassen.
- *Einladung*: „Einladung senden“ verschickt eine persönliche Mail mit Tagesordnung, Link zur Zu-/Absage und Kalenderdatei (`.ics`, Uhrzeit korrekt in Berliner Zeit) und eine Push-Nachricht. Pro Person ist zu sehen, ob eingeladen, ob die Mail rausging (oder keine Adresse hinterlegt ist) und wer kommt. Wer schon eingeladen ist, bekommt nichts doppelt; „Allen erneut senden“ verschickt eine Aktualisierung. **Ohne `SMTP_URL` in der `.env` werden keine Mails verschickt** – die Seite sagt das deutlich und bietet „Mailprogramm öffnen“ (vorbereitete Mail an alle) und die `.ics`-Datei an.
- *Protokoll*: Sitzungsleitung, Protokollführung, Anwesenheit, Gäste, Notizen und Beschluss je Tagesordnungspunkt, Verschiedenes und To-dos (Person, Frist, TOP). Alles wird mit einem Knopf gespeichert, To-do-Knöpfe und „Speichern & abschließen“ speichern vorher mit; beim Verlassen (auch über das Menü) mit ungespeicherten Änderungen kommt eine Warnung. Schreiben zwei Personen gleichzeitig, werden nur die Felder übernommen, die jemand selbst geändert hat – nichts wird überschrieben. Protokolle vergangener Treffen lassen sich nachtragen (Datum in der Vergangenheit erlaubt). „Abschließen“ macht Protokoll, Eingeladene und Termin schreibgeschützt; danach per Mail an alle Eingeladenen schicken, drucken bzw. als PDF speichern oder wieder öffnen.
- *To-dos* erscheinen bei der Person unter „Mein Einsatz“ und im Kalender; noch offene To-dos stehen bei der nächsten Versammlung unter „Offen aus früheren Versammlungen“. Versammlungen stehen für die Orga im Kalender und im persönlichen iCal-Abo.
- Namen im Protokoll bleiben auch erhalten, wenn ein Konto später gelöscht wird. Protokolltexte werden nie ins Server-Log geschrieben.

**Fertige Vorlagen für Osterfeuer, Dorfgemeinschaftsfest und Weihnachtsmarkt:** Unter „Vorlagen“ mit einem Klick anlegen (oder per `npm run db:seed`). Sie bringen Aufgaben mit Fristen und Meilensteinen, Themengebiete, Helfer-Schichten, Ablaufplan, Materialliste und einen Budget-Rahmen mit. Vorhandene Vorlagen gleichen Namens werden nie überschrieben. Die Inhalte sind ein Startpunkt: Welche Anmeldungen und Genehmigungen (Feuer, Ausschank, Sondernutzung, GEMA …) nötig sind und mit welchem Vorlauf, ist je nach Land und Gemeinde verschieden – bitte vor dem ersten Einsatz anpassen und nach der Veranstaltung mit „Als Vorlage speichern“ verbessern.

**Orga-Reiter einer Veranstaltung:** *Aufgaben · Ablaufplan · Material & Einkauf · Budget*.
- **Ablaufplan** (`/veranstaltungen/<id>/ablauf`): Programmpunkte vom Aufbau am Vortag bis zum Abbau – Tag relativ zum Veranstaltungstag (wandert beim Verschieben mit), Uhrzeit von/bis, Ort, verantwortliche Person (mit Telefon), Notiz. Druckbar als **Laufzettel**. Punkte mit „Im Programm zeigen“ sehen Bewohner bei veröffentlichten Veranstaltungen als *Programm*.
- **Material & Einkauf** (`/veranstaltungen/<id>/material`): was gebraucht wird, Menge, woher (Inventar, kaufen, leihen bei …), wer sich kümmert; Status per Tipp *Offen → Organisiert → Vor Ort*, Filter „Nur offene“, druckbare Liste. Fortschritt steht im Reiter.
- Helfer-Schichten, Ablauf und Material werden mit „Als Vorlage speichern“ übernommen und beim nächsten Mal mit angelegt (Eintragungen, Zuständige und Status starten neu).

**Themengebiete:** Jede Veranstaltung kann in Bereiche wie *Marketing & Presse*, *Technik & Aufbau* oder *Verpflegung* gegliedert werden (eigene Gebiete oder Standardset; Vorlagen bringen ihre Gebiete mit). Aufgaben und Budgetposten werden einem Gebiet zugeordnet, jedes Gebiet hat optional eine Leitung. Die Aufgabenliste lässt sich per Klick nach Gebiet filtern, das Budget zeigt Teilsummen je Gebiet. Zuständige lassen sich direkt in der Liste per Auswahl ändern (auch am Handy).

**Dateien:** Pro Veranstaltung (Genehmigungen, Flyer, Pläne) und als Beleg an Budgetposten (PDF, Bilder, Office; max. 10 MB; Inhalt wird gegen die Endung geprüft). Dateien sind standardmäßig nur für die Orga sichtbar; bei veröffentlichten Veranstaltungen kann man einzelne für Bewohner freigeben. Belege sehen nur Orga und Freigeber. Die Dateien liegen im Volume (`UPLOAD_DIR`) unter Zufallsnamen und werden nur über die geprüfte Download-Route ausgeliefert.

**Archiv & Jahresübersicht:** (Orga) vergangene Veranstaltungen nach Jahr mit Aufgaben-Quote, Gästen, Ausgaben, Ergebnis und Lessons Learned; Jahresvergleich über alle Jahre und Veränderung gegenüber dem Vorgänger derselben Vorlage.

Aufgaben und Änderungsprotokoll sehen nur Organisatoren; Bewohner sehen nur ihre eigenen Aufgaben. Neue Veranstaltungen sind zunächst **Entwürfe** und erscheinen für Bewohner erst nach „Veröffentlichen“.

## Weitere Bürger-Funktionen
- **Schwarzes Brett** (`/brett`): Suche & Biete, Mitfahren, Leihen & Verschenken, Nachbarschaftshilfe – mit Foto, freiwilligem Kontakt (klickbar), Laufzeit (Standard 30 Tage), „erledigt“, Verlängern und Melden. Abgelaufene Beiträge verschwinden und werden nach 30 Tagen gelöscht. Die Orga moderiert gemeldete Beiträge.
- **Kalender / Monatsansicht** (`/kalender`, auch über „Termine“ → „Monatsansicht“): alles auf einen Blick – Veranstaltungen (inkl. Vereinsterminen, ✓ bei eigener Zusage; Orga sieht auch Entwürfe), Müllabfuhr, Reservierungen (für andere nur „belegt“, eigene als „deine Reservierung“; Orga sieht Namen und offene Anfragen), eigene Aufgaben-Fristen und das Ende von Umfragen. Arten lassen sich per Knopf ein-/ausblenden (`?zeige=TERMIN,MUELL`), Monate blättern (`?monat=2026-12`). Am Handy zeigen farbige Punkte die Belegung, darunter steht die Tagesliste; ein Tipp auf den Tag springt dorthin.
- **Umfragen** (`/umfragen`): Die Orga stellt eine Frage mit 2–20 Antworten (eine oder mehrere wählbar), optional mit letztem Abstimmungstag und Push an alle. Jede Person hat eine Stimme und kann sie bis zum Ende ändern oder zurückziehen. Ergebnisse erscheinen nach der eigenen Abstimmung bzw. nach Ende – nur als Summen, niemand sieht, wer wie abgestimmt hat. Offene Umfragen ohne eigene Stimme stehen auf der Startseite („Deine Stimme ist gefragt“).
- **Reservieren & Ausleihen** (`/reservierung`): Die Orga legt Räume (Dorfgemeinschaftshaus) und Inventar (Bierzeltgarnituren, Pavillon …) an – mit Beschreibung, Abholhinweis (Schlüssel) und der Wahl, ob Anfragen bestätigt werden müssen. Bewohner sehen einen Monatskalender (frei / angefragt / belegt) und reservieren ganze Tage (max. 14 am Stück, Uhrzeit als Freitext). Überschneidungen werden serverseitig verhindert; Name, Kontaktdaten aus dem Profil und Zweck sieht nur die Orga. Ablauf: *Angefragt → Bestätigt/Abgelehnt*, Stornieren jederzeit; Push an die Orga bei neuen Anfragen, an die Person bei Entscheidung und am Vortag (mit Abholhinweis). Abgelehnte/stornierte Einträge werden nach 30 Tagen, alle anderen ein Jahr nach Ende gelöscht.
- **Neue Veranstaltung per Push:** Beim ersten Veröffentlichen kann die Orga alle per Push einladen („Beim Veröffentlichen alle per Push einladen“).
- **Fundbüro** (`/fundbuero`): gefunden/verloren, gleiche Technik wie das Brett (60 Tage).
- **Vereinsbereich** (`/gruppen/<id>`): Die Orga benennt pro Verein einen *Vorstand*. Der pflegt Termine (erscheinen im Kalender mit Veranstalter, auch im iCal-Feed) und Neuigkeiten des Vereins selbst – ohne Zugriff auf Aufgaben, Budget oder andere Vereine. Termine mit Aufgaben/Budget kann nur die Orga löschen.
- **Anliegen & Mängel** (`/anliegen`): Meldung mit Foto und optionalem Standort (nur nach Antippen). Sichtbar für die meldende Person und die Orga, optional für alle (gegen Doppelmeldungen). Orga setzt Status (Neu → In Bearbeitung → An Gemeinde weitergeleitet → Erledigt) und antwortet; die Person bekommt Push. Mit `MUNICIPALITY_EMAIL` in der `.env` entsteht ein Knopf, der eine vorbereitete E-Mail an die Gemeinde öffnet (es wird nichts automatisch versendet).
- **Müllkalender automatisch vom AWS Schaumburg:** Unter `/muell` (Orga) Ort, Straße und Hausnummer einer Adresse eingeben (z. B. Haste, Dorfstr., 2) – der Dorfplaner fragt das Kundenportal des AWS Schaumburg ab, richtet die öffentliche iCal-Abo-Adresse dieser Adresse als *Quelle* ein und gleicht sie täglich ab (Cron-Lauf 06:00 UTC; Feiertagsverschiebungen werden so übernommen). Alternativ kann die Abo-Adresse direkt aus dem Portal eingefügt werden. Es werden nur freigegebene Hosts abgerufen (`WASTE_ALLOWED_HOSTS`, Standard `kundenlogin.aws-shg.de`), ohne Weiterleitungen. Bei mehreren Bereichen mit anderen Abfuhrtagen je Bereich eine Quelle mit Bezeichnung anlegen. Manuell gepflegte Termine bleiben unberührt; schlägt ein Abgleich fehl, bleiben die bisherigen Termine erhalten und die Orga sieht die Fehlermeldung. Im Portal stehen Termine nur für das laufende und das nächste Jahr; die Angabe „Quelle: AWS Schaumburg, Stand …“ erscheint für alle Bewohner. Hinweis: Das Portal hat keine offizielle Schnittstelle – ändert der Entsorger sein Portal, steht als Rückfall das Einfügen der Abo-Adresse oder der `.ics`-Import zur Verfügung.
- **Müllkalender als `.ics`:** *Import* (Orga, `/muell`): Kalenderdatei vom Landkreis/Entsorger hochladen – Tonnenart aus dem Terminnamen, einfache Wiederholungen (RRULE/EXDATE) und UTC-Zeiten werden verstanden, Doppelte werden übersprungen, optional werden zukünftige Termine der betroffenen Tonnen vorher ersetzt. *Export*: öffentlicher Abo-Feed `/muell.ics` (ohne Login, keine personenbezogenen Daten) für iPhone, Google Kalender, Outlook; Filter `?art=Bio,Papier`, Erinnerung am Vorabend `?erinnerung=1`, Datei-Download `?dl=1`.
- **Müll-Erinnerung:** Unter „Mein Profil“ einschalten (pro Tonnenart wählbar). Der Dienst `reminders` schickt abends (16:00 UTC ≈ 17/18 Uhr) eine Push-Nachricht, wenn am nächsten Tag abgeholt wird.
- **Aushang (PDF)** (`/aushang`, Orga): DIN-A4 mit großer Schrift für Schaukasten/Dorfladen – kommende Termine, Müllabfuhr, Neuigkeiten, QR-Code zur App.

Fotos werden beim Hochladen verkleinert und neu kodiert; dabei gehen EXIF-Daten (u. a. GPS-Standort der Kamera) verloren. Dateien liegen im Upload-Ordner (im Backup enthalten); verwaiste Dateien räumt der tägliche Lauf auf.

## App aufs Handy / Button für die Website
Die öffentliche Seite `/installieren` („Dorfplaner aufs Handy holen“) hat einen Installationsknopf (Android/Chrome), eine Anleitung für iPhone, den Weg zur Anmeldung und einen QR-Code (`/installieren/qr.svg`, druckbar). Unter „Personen“ (Admin) steht ein fertiger Button-Code zum Einfügen in die Dorf-Website (WordPress: Block „Eigenes HTML“). `APP_URL` muss auf die öffentliche https-Adresse zeigen, sonst stimmen QR-Code und Button-Link nicht.

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

### Mit dem Installer (empfohlen, auch neben anderen Diensten)
`deploy/install.sh` richtet alles ein und ist zugleich das Update-Skript:
```bash
curl -fsSL https://raw.githubusercontent.com/Marfinho/DGH/main/deploy/install.sh -o install.sh
sudo bash install.sh --check                                 # prüft nur: Docker, DNS, Ports, Speicher
sudo bash install.sh --domain dgh.lindenweg16.online         # installiert bzw. aktualisiert
```
Was er tut: Code nach `/opt/dorfplaner` holen, `.env` **einmalig** anlegen (Geheimnis für die Erinnerungen, Push-Schlüssel, optional SMTP – eine vorhandene `.env` wird nie überschrieben), bauen und starten, die App nur lokal auf `127.0.0.1:<Port ab 3100>` veröffentlichen und dann den Reverse Proxy einrichten:
- **Caddy läuft schon auf dem Server** (z. B. für andere Projekte): ein markierter Eintrag für die Domain wird an die Caddyfile angehängt (Sicherung vorher, `caddy validate`, bei Fehler Rückbau), andere Einträge bleiben unberührt.
- **Port 80/443 frei:** der mitgelieferte Caddy wird gestartet (`COMPOSE_PROFILES=caddy` in der `.env`).
- **nginx oder ein Proxy-Container:** der Installer gibt die fertige Konfiguration aus (für nginx mit `Host`/`X-Forwarded-*`-Kopfzeilen und 12 MB Upload-Grenze) und ändert dort nichts.

Danach legt er auf Wunsch den ersten Admin an (Einladungscode) und die fertigen Vorlagen. Andere Container werden nie angehalten oder neu gestartet; Docker-Projektname ist fest `dorfplaner`. Optionen: `--branch`, `--dir`, `--port`, `--proxy auto|host-caddy|bundled|manual`, `--help`.

### Von Hand
```bash
cp .env.example .env     # DOMAIN, APP_URL (https://…), CRON_SECRET, optional SMTP_URL, VAPID_*; COMPOSE_PROFILES=caddy falls 80/443 frei
npx web-push generate-vapid-keys             # Push-Schlüssel in .env eintragen
docker compose up -d --build
docker compose exec app npm run admin -- "Dein Name" du@example.de
docker compose exec app npm run db:seed      # optional
```
Der Caddy holt automatisch Let's-Encrypt-Zertifikate (DNS muss auf den VPS zeigen). Der Dienst `reminders` löst täglich ~7–8 Uhr die Push-Erinnerungen aus. Push funktioniert nur über HTTPS; auf dem iPhone erst „Zum Home-Bildschirm“.

## Updates
```bash
sudo bash /opt/dorfplaner/deploy/install.sh  # oder: git pull && docker compose up -d --build (Migrationen laufen beim Start)
```

## Backup
Der Compose-Dienst `backup` läuft täglich gegen 3 Uhr und legt im Volume unter `/data/backups` ab: einen konsistenten Datenbank-Snapshot (`dorfplaner-JJJJ-MM-TT.db`, die letzten 14 bleiben) und einen Spiegel aller Uploads (`uploads/`). Manuell: `docker compose exec backup npx tsx prisma/backup.ts`. Admins können den DB-Snapshot außerdem unter „Personen“ herunterladen.

**Wichtig:** Das Volume liegt auf demselben Server – bitte zusätzlich extern sichern, z. B. per Cronjob auf dem VPS:
```bash
docker run --rm -v dorfplaner_dorfplaner-data:/data -v "$PWD":/out alpine tar czf /out/dorfplaner-$(date +%F).tgz -C /data backups
# danach per rsync/rclone/scp auf einen anderen Rechner kopieren
```
Wiederherstellen: Dienste stoppen, gewünschte `.db` als `/data/dorfplaner.db` zurückkopieren, `uploads/` nach `/data/uploads/`, Dienste starten.

## Datenschutz (DSGVO)
- Gespeichert werden Name, freiwillig E-Mail/Telefon, Rolle, Zu-/Absagen, Helfer-Einträge, Push-Abos. Kein Tracking, keine externen Fonts/CDNs (Schriften Barlow, Barlow Condensed und Kaushan Script liegen lokal im Build), keine Cookies außer dem Sitzungs-Cookie.
- Sitzungs-Tokens, Einladungscodes und Anmelde-Links werden nur als SHA-256-Hash gespeichert. Anmelde-Links gelten 15 Min und einmalig, Codes 7 Tage und einmalig.
- Jede Person kann unter „Mein Profil“ ihre Daten exportieren (JSON) und ihr Konto löschen; Admins können Personen löschen und Sitzungen beenden.
- „Vereine & Kontakte“ ist für alle angemeldeten Bewohner sichtbar – Kontaktdaten nur mit Einverständnis eintragen.
- Der iCal-Link enthält ein geheimes Token (jederzeit erneuerbar). Der Service Worker speichert keine Seiteninhalte.
- Ins Verarbeitungsverzeichnis des Verantwortlichen (Verein/Gemeinde) aufnehmen; Datenschutzerklärung bereitstellen.

## Struktur
`prisma/` Schema, Migrationen, Seed, Admin-CLI · `src/app` Seiten, Server Actions, API (iCal, Push, Cron, Export) · `src/lib` Auth, Datums-/Vorlagenlogik, iCal, Push, Mail · `public/` Manifest, Service Worker, Icons
