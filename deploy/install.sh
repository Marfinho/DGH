#!/usr/bin/env bash
# Dorfplaner – Installer/Updater für einen VPS, auf dem auch andere Dienste laufen.
#
#   Prüfen (ändert nichts):   sudo bash install.sh --check
#   Installieren/Updaten:     sudo bash install.sh
#
# Optionen:
#   --domain NAME     öffentliche Adresse            (Standard: dgh.lindenweg16.online)
#   --dir PFAD        Installationsordner            (Standard: /opt/dorfplaner)
#   --branch NAME     Git-Branch                     (Standard: main)
#   --repo URL        Git-Repository                 (Standard: https://github.com/Marfinho/DGH.git)
#   --port N          lokaler Port der App           (Standard: erster freier ab 3100)
#   --proxy MODUS     auto | host-caddy | bundled | manual   (Standard: auto)
#   --check           nur prüfen und berichten
#   --yes             Rückfragen mit der Vorgabe beantworten (Admin/SMTP werden dann übersprungen)
#
# Was das Skript NIE tut: andere Container/Projekte stoppen oder neu starten, "docker prune",
# Firewall ändern, eine vorhandene .env überschreiben (sonst wären z. B. alle Push-Abos ungültig).
set -euo pipefail

DOMAIN="dgh.lindenweg16.online"
DIR="/opt/dorfplaner"
BRANCH="main"
REPO="https://github.com/Marfinho/DGH.git"
PORT=""
PROXY="auto"
CHECK=0
YES=0
# Für Tests überschreibbar
CADDYFILE="${DP_CADDYFILE:-}"
SKIP_ROOT="${DP_SKIP_ROOT:-0}"
NO_BUILD="${DP_NO_BUILD:-0}"
PUBLIC_IP="${DP_PUBLIC_IP:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --dir) DIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --proxy) PROXY="$2"; shift 2 ;;
    --check) CHECK=1; shift ;;
    --yes|-y) YES=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unbekannte Option: $1" >&2; exit 2 ;;
  esac
done
DOMAIN="$(printf '%s' "$DOMAIN" | tr '[:upper:]' '[:lower:]')"
case "$PROXY" in auto|host-caddy|bundled|manual) ;; *) echo "--proxy muss auto, host-caddy, bundled oder manual sein" >&2; exit 2 ;; esac

# ---------- Ausgabe ----------
if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[32m'; Y=$'\e[33m'; R=$'\e[31m'; N=$'\e[0m'; else B=""; G=""; Y=""; R=""; N=""; fi
ok()   { printf '%s✔%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$*"; WARNINGS=$((WARNINGS+1)); }
bad()  { printf '%s✘%s %s\n' "$R" "$N" "$*"; PROBLEMS=$((PROBLEMS+1)); }
info() { printf '  %s\n' "$*"; }
step() { printf '\n%s== %s%s\n' "$B" "$*" "$N"; }
die()  { printf '%sAbbruch:%s %s\n' "$R" "$N" "$*" >&2; exit 1; }
WARNINGS=0; PROBLEMS=0

# Rückfragen immer vom Terminal lesen (auch wenn das Skript per curl | bash kommt)
TTY=/dev/tty; [ -r "$TTY" ] || TTY=/dev/null
ask() { # ask "Frage" "Vorgabe" -> Antwort auf stdout
  local q="$1" def="${2:-}" a=""
  if [ "$YES" = 1 ] || [ "$TTY" = /dev/null ]; then printf '%s' "$def"; return; fi
  printf '%s%s%s ' "$B" "$q" "$N" > "$TTY"; [ -n "$def" ] && printf '[%s] ' "$def" > "$TTY"
  IFS= read -r a < "$TTY" || true
  printf '%s' "${a:-$def}"
}
ask_secret() {
  local q="$1" a=""
  if [ "$YES" = 1 ] || [ "$TTY" = /dev/null ]; then printf ''; return; fi
  printf '%s%s%s ' "$B" "$q" "$N" > "$TTY"; IFS= read -rs a < "$TTY" || true; printf '\n' > "$TTY"
  printf '%s' "$a"
}
yesno() { case "$(ask "$1 (j/n)" "$2")" in [jJyY]*) return 0 ;; *) return 1 ;; esac; }

# URL-Kodierung für SMTP-Zugangsdaten (ein @ oder : im Passwort würde die URL sonst zerbrechen)
urlencode() {
  local s="$1" out="" c i
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in [a-zA-Z0-9.~_-]) out+="$c" ;; *) out+="$(printf '%%%02X' "'$c")" ;; esac
  done
  printf '%s' "$out"
}

port_in_use() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q . ; }
port_owner() { # Prozessname, der auf Port $1 lauscht (leer = frei)
  ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -n1
}

compose() { docker compose --project-directory "$DIR" -f "$DIR/docker-compose.yml" "$@"; }

# =====================================================================
step "Vorabprüfung"
[ "$SKIP_ROOT" = 1 ] || [ "$(id -u)" = 0 ] || [ "$CHECK" = 1 ] || die "Bitte mit sudo bzw. als root ausführen."

for t in curl git openssl ss; do
  if command -v "$t" >/dev/null 2>&1; then ok "$t vorhanden"; else bad "$t fehlt (apt install ${t/ss/iproute2})"; fi
done
HAVE_DOCKER=0
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null || echo '?') mit Compose $(docker compose version --short 2>/dev/null)"; HAVE_DOCKER=1
else
  warn "Docker oder das Compose-Plugin fehlt – wird bei der Installation (nach Rückfrage) eingerichtet."
fi

# Speicher: der Next.js-Build braucht gut 1,5 GB
MEM_MB=$(awk '/MemTotal/{m=$2} /SwapTotal/{s=$2} END{print int((m+s)/1024)}' /proc/meminfo 2>/dev/null || echo 0)
if [ "$MEM_MB" -ge 2000 ]; then ok "Arbeitsspeicher + Swap: ${MEM_MB} MB"; else warn "Arbeitsspeicher + Swap nur ${MEM_MB} MB – der Build kann scheitern. Tipp: 2 GB Swap anlegen."; fi
DISK_MB=$(df -Pm "$(dirname "$DIR")" 2>/dev/null | awk 'NR==2{print $4}')
if [ "${DISK_MB:-0}" -ge 3000 ]; then ok "Freier Platz: ${DISK_MB} MB"; else warn "Nur ${DISK_MB:-?} MB frei – für Images und Build sollten es 3 GB sein."; fi

# DNS
[ -n "$PUBLIC_IP" ] || PUBLIC_IP="$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)"
DNS_A="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
DNS_AAAA="$(getent ahostsv6 "$DOMAIN" 2>/dev/null | awk '$1 ~ /:/ && $1 !~ /^::ffff:/ {print $1}' | sort -u | tr '\n' ' ' | sed 's/ $//')"
if [ -z "$DNS_A" ]; then bad "$DOMAIN hat keinen A-Eintrag. Beim DNS-Anbieter anlegen: $DOMAIN → ${PUBLIC_IP:-<IP des Servers>}"
elif [ -n "$PUBLIC_IP" ] && [[ " $DNS_A " != *" $PUBLIC_IP "* ]]; then bad "$DOMAIN zeigt auf $DNS_A, dieser Server ist aber $PUBLIC_IP."
else ok "DNS: $DOMAIN → $DNS_A"; fi
if [ -n "$DNS_AAAA" ]; then
  if ip -6 addr 2>/dev/null | grep -qiF "${DNS_AAAA%% *}"; then ok "IPv6: $DNS_AAAA (gehört zu diesem Server)"
  else warn "$DOMAIN hat einen AAAA-Eintrag ($DNS_AAAA), der nicht zu diesem Server gehört – löschen, sonst scheitert das Zertifikat."; fi
fi

# Wer hält 80/443?
OWN80="$(port_owner 80)"; OWN443="$(port_owner 443)"
P80="${OWN80:-frei}"; P443="${OWN443:-frei}"
if ! port_in_use 80 && ! port_in_use 443; then DETECTED="free"
elif [ "$OWN80" = caddy ] || [ "$OWN443" = caddy ]; then DETECTED="host-caddy"
elif [[ "$OWN80$OWN443" == *nginx* ]]; then DETECTED="nginx"
elif [[ "$OWN80$OWN443" == *apache* || "$OWN80$OWN443" == *httpd* ]]; then DETECTED="apache"
elif [[ "$OWN80$OWN443" == *docker-proxy* ]]; then DETECTED="container"
else DETECTED="other"; fi
case "$DETECTED" in
  free) ok "Port 80/443 frei – der mitgelieferte Caddy kann sie übernehmen." ;;
  host-caddy) ok "Port 80/443: Caddy auf dem Server (wird um einen Eintrag ergänzt, andere Einträge bleiben unberührt)." ;;
  nginx) warn "Port 80/443: nginx – das Skript gibt die passende Konfiguration aus, ändert nginx aber nicht selbst." ;;
  container)
    CNAME="$(docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null | grep -E ':(80|443)->' | awk '{print $1}' | head -n1)"
    warn "Port 80/443 gehören dem Container ${CNAME:-?} (eines anderen Projekts) – dort muss ein Eintrag ergänzt werden, das Skript gibt ihn aus." ;;
  *) if [ -z "$OWN80$OWN443" ]; then warn "Port 80/443 belegt, Programm nicht erkennbar – für Details mit sudo ausführen."
     else warn "Port 80: $P80, Port 443: $P443 – unbekannter Proxy, Konfiguration bitte von Hand ergänzen (Ausgabe am Ende)."; fi ;;
esac

# Lokaler Port für die App
if [ -z "$PORT" ] && [ -f "$DIR/.env" ]; then PORT="$(sed -n 's/^APP_PORT=//p' "$DIR/.env" | tail -n1)"; fi
if [ -z "$PORT" ]; then
  PORT=3100
  while port_in_use "$PORT" || [[ " 3000 3001 5432 " == *" $PORT "* ]]; do PORT=$((PORT+1)); done
  ok "Lokaler Port für die App: 127.0.0.1:$PORT"
elif port_in_use "$PORT" && ! (compose ps --status running app 2>/dev/null | grep -q app); then
  bad "Port $PORT ist schon belegt (von $(port_owner "$PORT")). Mit --port einen anderen wählen."
else ok "Lokaler Port für die App: 127.0.0.1:$PORT"; fi

if [ -d "$DIR/.git" ]; then info "Vorhandene Installation in $DIR (Branch $(git -C "$DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)) – wird aktualisiert."; else info "Neue Installation in $DIR aus $REPO ($BRANCH)."; fi

if [ "$CHECK" = 1 ]; then
  step "Ergebnis der Prüfung"
  if [ "$PROBLEMS" -gt 0 ]; then echo "${R}$PROBLEMS Problem(e)${N}, $WARNINGS Hinweis(e) – bitte erst beheben."; exit 1; fi
  echo "${G}Bereit.${N} $WARNINGS Hinweis(e). Installation starten mit: sudo bash $0${DOMAIN:+ --domain $DOMAIN}"
  exit 0
fi
[ "$PROBLEMS" -eq 0 ] || { yesno "Es gibt $PROBLEMS Problem(e). Trotzdem fortfahren?" n || die "abgebrochen."; }

# Proxy-Modus festlegen
if [ "$PROXY" = auto ]; then
  case "$DETECTED" in free) PROXY=bundled ;; host-caddy) PROXY=host-caddy ;; *) PROXY=manual ;; esac
fi
info "Reverse Proxy: $PROXY"

# =====================================================================
step "Docker"
if [ "$HAVE_DOCKER" = 0 ]; then
  yesno "Docker ist nicht installiert. Jetzt mit dem offiziellen Skript (get.docker.com) installieren?" j || die "Docker wird benötigt."
  curl -fsSL https://get.docker.com | sh
  docker compose version >/dev/null 2>&1 || die "Docker Compose fehlt weiterhin."
fi
ok "Docker bereit"

# =====================================================================
step "Programmcode"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --quiet origin "$BRANCH"
  git -C "$DIR" checkout --quiet "$BRANCH" 2>/dev/null || git -C "$DIR" checkout --quiet -b "$BRANCH" "origin/$BRANCH"
  git -C "$DIR" merge --ff-only --quiet "origin/$BRANCH" || die "Lokale Änderungen in $DIR verhindern das Update (git status prüfen)."
  ok "Aktualisiert auf $(git -C "$DIR" log -1 --format='%h %s' | cut -c1-70)"
else
  mkdir -p "$(dirname "$DIR")"
  git clone --quiet --branch "$BRANCH" "$REPO" "$DIR"
  ok "Geklont: $(git -C "$DIR" log -1 --format='%h %s' | cut -c1-70)"
fi
[ -f "$DIR/docker-compose.yml" ] && grep -q 'APP_PORT' "$DIR/docker-compose.yml" || die "Diese Version des Dorfplaners kennt den Betrieb neben anderen Diensten noch nicht – Branch prüfen (--branch)."

# =====================================================================
step "Konfiguration (.env)"
ENVF="$DIR/.env"
setenv_if_missing() { grep -q "^$1=" "$ENVF" 2>/dev/null || printf '%s=%s\n' "$1" "$2" >> "$ENVF"; }
NEW_ENV=0
if [ ! -f "$ENVF" ]; then
  NEW_ENV=1
  umask 077
  SMTP_URL=""; SMTP_FROM=""
  if yesno "E-Mail-Versand (Anmelde-Links, Einladungen, Protokolle) jetzt einrichten?" j; then
    SH="$(ask "SMTP-Server (z. B. smtp.ionos.de):" "")"
    SP="$(ask "Port (587 = STARTTLS, 465 = SSL):" "587")"
    SU="$(ask "Benutzername (meist die E-Mail-Adresse):" "")"
    SW="$(ask_secret "Passwort (wird nicht angezeigt):")"
    SMTP_FROM="$(ask "Absender, z. B. Dorfgemeinschaft <${SU:-dorfplaner@$DOMAIN}>:" "Dorfplaner <${SU}>")"
    if [ -n "$SH" ] && [ -n "$SU" ]; then
      SCHEME=smtp; [ "$SP" = 465 ] && SCHEME=smtps
      SMTP_URL="$SCHEME://$(urlencode "$SU"):$(urlencode "$SW")@$SH:$SP"
    fi
  fi
  cat > "$ENVF" <<EOF
# Erzeugt von deploy/install.sh am $(date +%F). Diese Datei NICHT neu erzeugen (Push-Schlüssel!).
DATABASE_URL="file:/data/dorfplaner.db"
DOMAIN=$DOMAIN
APP_URL="https://$DOMAIN"
APP_PORT=$PORT
CRON_SECRET=$(openssl rand -hex 24)
SMTP_URL="$SMTP_URL"
SMTP_FROM="$SMTP_FROM"
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT="mailto:${SU:-orga@$DOMAIN}"
MUNICIPALITY_EMAIL=
EOF
  [ "$PROXY" = bundled ] && echo "COMPOSE_PROFILES=caddy" >> "$ENVF"
  ok ".env angelegt"
else
  setenv_if_missing APP_PORT "$PORT"
  if [ "$PROXY" = bundled ]; then setenv_if_missing COMPOSE_PROFILES caddy; fi
  ok ".env vorhanden – bleibt unverändert (nur fehlende Einträge ergänzt)"
fi
chmod 600 "$ENVF"
PORT="$(sed -n 's/^APP_PORT=//p' "$ENVF" | tail -n1)"

# =====================================================================
step "Bauen und starten"
if [ "$NO_BUILD" = 1 ]; then compose up -d; else compose up -d --build; fi

# Push-Schlüssel einmalig aus dem fertigen Image erzeugen
if ! grep -q '^VAPID_PUBLIC_KEY=.\+' "$ENVF"; then
  KEYS="$(compose run --rm --no-deps -T app node -e 'const k=require("web-push").generateVAPIDKeys();console.log(k.publicKey+" "+k.privateKey)' 2>/dev/null | tail -n1 || true)"
  if [ -n "$KEYS" ]; then
    sed -i "s|^VAPID_PUBLIC_KEY=.*|VAPID_PUBLIC_KEY=${KEYS%% *}|; s|^VAPID_PRIVATE_KEY=.*|VAPID_PRIVATE_KEY=${KEYS##* }|" "$ENVF"
    compose up -d --force-recreate app reminders >/dev/null 2>&1
    ok "Push-Schlüssel erzeugt"
  else warn "Push-Schlüssel konnten nicht erzeugt werden – Push bleibt aus (siehe README)."; fi
fi

printf '  warte auf die App '
for _ in $(seq 1 90); do
  if curl -fs -o /dev/null "http://127.0.0.1:$PORT/login"; then printf '\n'; ok "App antwortet auf 127.0.0.1:$PORT"; READY=1; break; fi
  printf '.'; sleep 2
done
[ "${READY:-0}" = 1 ] || { printf '\n'; compose logs --tail 40 app; die "Die App startet nicht (Logs oben)."; }

# =====================================================================
step "Reverse Proxy für https://$DOMAIN"
BLOCK_BEGIN="# >>> dorfplaner $DOMAIN >>> (verwaltet von deploy/install.sh)"
BLOCK_END="# <<< dorfplaner $DOMAIN <<<"
caddy_block() {
  cat <<EOF
$BLOCK_BEGIN
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:$PORT
}
$BLOCK_END
EOF
}
case "$PROXY" in
  host-caddy)
    if [ -z "$CADDYFILE" ]; then
      CADDYFILE="$(systemctl show caddy -p ExecStart --value 2>/dev/null | grep -o -- '--config [^ ;]*' | awk '{print $2}' | head -n1)"
      [ -n "$CADDYFILE" ] || CADDYFILE=/etc/caddy/Caddyfile
    fi
    [ -f "$CADDYFILE" ] || die "Caddyfile nicht gefunden ($CADDYFILE). Pfad mit DP_CADDYFILE=… angeben."
    BACKUP="$CADDYFILE.bak-dorfplaner-$(date +%Y%m%d%H%M%S)"
    cp -p "$CADDYFILE" "$BACKUP"
    TMP="$(mktemp)"
    # alten Block (falls vorhanden) entfernen, neuen anhängen – so entsteht nie ein doppelter Eintrag
    awk -v b="$BLOCK_BEGIN" -v e="$BLOCK_END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$CADDYFILE" > "$TMP"
    if grep -qE "^[[:space:]]*(https?://)?$DOMAIN([:, ]|\{|$)" "$TMP"; then
      rm -f "$TMP" "$BACKUP"; die "$CADDYFILE enthält schon einen eigenen Eintrag für $DOMAIN – bitte prüfen und auf reverse_proxy 127.0.0.1:$PORT zeigen lassen."
    fi
    { cat "$TMP"; printf '\n'; caddy_block; } > "$TMP.new"; rm -f "$TMP"
    cat "$TMP.new" > "$CADDYFILE"; rm -f "$TMP.new"
    if caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy; then
      ok "Eintrag in $CADDYFILE ergänzt, Caddy neu geladen (Sicherung: $BACKUP)"
    else
      cat "$BACKUP" > "$CADDYFILE"; systemctl reload caddy >/dev/null 2>&1 || true
      die "Caddy hat die neue Konfiguration abgelehnt – die alte ist wiederhergestellt. Prüfen mit: caddy validate --config $CADDYFILE"
    fi ;;
  bundled)
    compose --profile caddy up -d caddy
    ok "Mitgelieferter Caddy läuft auf Port 80/443" ;;
  manual)
    warn "Bitte im vorhandenen Reverse Proxy eintragen (danach neu laden):"
    echo; echo "${B}--- Caddy ---${N}"; caddy_block
    cat <<EOF

${B}--- nginx (z. B. /etc/nginx/sites-available/dorfplaner, danach: certbot --nginx -d $DOMAIN) ---${N}
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 12m;            # Datei-Uploads bis 10 MB
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;    # Pflicht: sonst lehnt die App Formulare ab
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF
    if [ "$DETECTED" = container ]; then echo; info "Läuft der Proxy in einem Container, erreicht er die App nicht über 127.0.0.1 – dann statt 127.0.0.1:$PORT die Adresse host.docker.internal:$PORT (mit extra_hosts: host-gateway) oder die Docker-Bridge-IP 172.17.0.1:$PORT verwenden."; fi ;;
esac

# =====================================================================
step "Erster Zugang"
ADMINS="$(compose exec -T app node -e 'const{PrismaClient}=require("@prisma/client");const d=new PrismaClient();d.person.count({where:{role:"ADMIN"}}).then(n=>{console.log(n);return d.$disconnect()})' 2>/dev/null | tail -n1 || echo "?")"
if [ "$ADMINS" = 0 ]; then
  NAME="$(ask "Name des ersten Admins (z. B. Max Mustermann):" "")"
  MAIL="$(ask "E-Mail-Adresse des Admins (optional):" "")"
  if [ -n "$NAME" ]; then
    compose exec -T app npm run --silent admin -- "$NAME" ${MAIL:+"$MAIL"} | tail -n1
    info "Mit diesem Code unter https://$DOMAIN/login anmelden (7 Tage gültig)."
  else warn "Kein Admin angelegt. Später: cd $DIR && docker compose exec app npm run admin -- \"Name\" mail@example.de"; fi
  if yesno "Fertige Vorlagen (Osterfeuer, Dorfgemeinschaftsfest, Weihnachtsmarkt …) anlegen?" j; then
    compose exec -T app npm run --silent db:seed >/dev/null && ok "Vorlagen angelegt"
  fi
else ok "Admin-Zugang vorhanden ($ADMINS) – nichts zu tun."; fi

# =====================================================================
step "Fertig"
if [ "$PROXY" != manual ]; then
  sleep 3
  if curl -fsS -o /dev/null --max-time 15 "https://$DOMAIN/login"; then ok "https://$DOMAIN ist erreichbar"
  else warn "https://$DOMAIN antwortet noch nicht. Das Zertifikat kann ein, zwei Minuten dauern. Sonst: DNS, Port 80/443 in der Provider-Firewall und journalctl -u caddy bzw. docker compose logs caddy prüfen."; fi
fi
cat <<EOF

  Adresse:        https://$DOMAIN
  Ordner:         $DIR   (Einstellungen: $DIR/.env)
  Update:         sudo bash $DIR/deploy/install.sh --branch $BRANCH
  Logs:           cd $DIR && docker compose logs -f app
  Backups:        täglich ~3 Uhr im Volume dorfplaner_dorfplaner-data (/data/backups) – bitte zusätzlich extern sichern (README)
EOF
[ "$NEW_ENV" = 1 ] && grep -q '^SMTP_URL=""' "$ENVF" && echo "  Hinweis:        Kein Mailversand eingerichtet – SMTP_URL in $DIR/.env eintragen, dann: docker compose up -d"
exit 0
