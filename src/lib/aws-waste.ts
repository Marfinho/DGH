// Anbindung an den Abfuhrkalender des AWS Schaumburg (Abfallwirtschaft Landkreis Schaumburg).
// Das Kundenportal veröffentlicht pro Adresse eine öffentliche iCal-Abo-Adresse. Wir rufen NUR freigegebene Hosts ab
// (Schutz vor SSRF) und gleichen höchstens einmal täglich ab.

export class AwsError extends Error {}

const PORTAL = "https://kundenlogin.aws-shg.de/WasteManagementSchaumburg/WasteManagementServlet";
const UA = "Dorfplaner/1.0 (Abfuhrkalender-Abgleich fuer die Dorfgemeinschaft)";

export const allowedHosts = () => (process.env.WASTE_ALLOWED_HOSTS ?? "kundenlogin.aws-shg.de").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

/** Nur https, nur freigegebene Hosts, keine Zugangsdaten/Ports in der Adresse. */
export function assertAllowedUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new AwsError("Das ist keine gültige Internetadresse."); }
  if (u.protocol !== "https:" || u.username || u.password || (u.port && u.port !== "443")) throw new AwsError("Nur https-Adressen ohne Zugangsdaten sind erlaubt.");
  if (!allowedHosts().includes(u.hostname.toLowerCase())) throw new AwsError(`Diese Quelle ist nicht freigegeben. Erlaubt: ${allowedHosts().join(", ")}.`);
  return u;
}

export async function fetchIcs(raw: string): Promise<string> {
  const u = assertAllowedUrl(raw);
  let res: Response;
  try { res = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(20_000), headers: { "user-agent": UA, accept: "text/calendar" } }); }
  catch { throw new AwsError("Der Kalender konnte nicht abgerufen werden (keine Verbindung oder Zeitüberschreitung)."); }
  if (!res.ok) throw new AwsError(`Der Server antwortete mit Fehler ${res.status}.`);
  const text = await res.text();
  if (text.length > 3_000_000) throw new AwsError("Die Antwort ist unerwartet groß.");
  if (!text.includes("BEGIN:VCALENDAR")) throw new AwsError("Die Adresse liefert keinen Kalender (.ics).");
  return text;
}

// ---- Adresssuche im Portal (Ort → Straße → Hausnummer → Abo-Adresse) ----
const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&uuml;/g, "ü").replace(/&Uuml;/g, "Ü").replace(/&ouml;/g, "ö").replace(/&auml;/g, "ä").replace(/&szlig;/g, "ß").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const norm = (s: string) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim().toLowerCase();

export function parseHiddenFields(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<INPUT\s[^>]*>/gi)) {
    const t = m[0];
    if (!/TYPE="HIDDEN"/i.test(t)) continue;
    const n = /NAME="([^"]*)"/i.exec(t), v = /VALUE="([^"]*)"/i.exec(t);
    if (n) out[n[1]] = v ? decode(v[1]) : "";
  }
  return out;
}
export const extractAboUrl = (html: string) => /https:\/\/kundenlogin\.aws-shg\.de\/WasteManagementSchaumburg\/WasteManagementServiceServlet\?[^<"'\s]*SubmitAction=sync[^<"'\s]*/i.exec(decode(html))?.[0] ?? null;
export const extractAddress = (html: string) => { const a = /Adresse\s*<[^>]*>[\s\S]{0,300}?<[^>]*>\s*([^<]+?)\s*</i.exec(html)?.[1]; return a ? decode(a).replace(/\s+/g, " ").trim() : null; };
export function extractMessage(html: string): string | null {
  const m = /Hinweise und Fehlermeldungen[\s\S]{0,1200}?<\/(?:P|SPAN|DIV)>/i.exec(html);
  if (!m) return null;
  const t = decode(m[0].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").replace(/^Hinweise und Fehlermeldungen\s*/i, "").trim();
  return t || null;
}

async function portal(cookie: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const res = await fetch(PORTAL, { method: "POST", body: fd, redirect: "error", signal: AbortSignal.timeout(25_000), headers: { "user-agent": UA, cookie } });
  if (!res.ok) throw new AwsError(`Das Portal antwortete mit Fehler ${res.status}.`);
  return res.text();
}

/** Ermittelt die Kalender-Abo-Adresse für eine Adresse im Landkreis Schaumburg. Wirft AwsError mit verständlicher Meldung. */
export async function lookupAwsAbo(a: { ort: string; strasse: string; hausnummer: string; zusatz?: string }): Promise<{ url: string; address: string }> {
  try {
    const first = await fetch(`${PORTAL}?SubmitAction=wasteDisposalServices&InFrameMode=TRUE`, { redirect: "error", signal: AbortSignal.timeout(25_000), headers: { "user-agent": UA } });
    if (!first.ok) throw new AwsError(`Das Portal antwortete mit Fehler ${first.status}.`);
    const cookie = (first.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
    const html = await first.text();
    const fields = parseHiddenFields(html);
    const zeitraum = /NAME="Zeitraum"\s+VALUE="([^"]+)"/i.exec(html)?.[1];

    const ort = a.ort.trim(), strasse = a.strasse.trim(), nr = a.hausnummer.trim();
    if (!ort || !strasse || !nr) throw new AwsError("Bitte Ort, Straße und Hausnummer angeben.");

    const j1 = JSON.parse(await portal(cookie, { ...fields, Ort: ort, SubmitAction: "CITYCHANGED", Ajax: "true" })) as { Response: { values: { name?: string; items?: { item: string }[] }[] } };
    const val = (n: string) => j1.Response.values.find((v) => v.name === n)?.items?.map((i) => i.item) ?? [];
    const orte = val("Ort");
    const ortHit = orte.find((o) => norm(o) === norm(ort));
    if (!ortHit) throw new AwsError(`Ort „${ort}“ nicht gefunden. Beispiele: ${orte.filter((o) => norm(o).includes(norm(ort).slice(0, 3))).slice(0, 8).join(", ") || orte.slice(0, 8).join(", ")}.`);
    const streets = val("Strasse");
    const exact = streets.find((s) => norm(s) === norm(strasse)) ?? streets.find((s) => norm(s).replace(/\./g, "") === norm(strasse).replace(/\./g, "")) ?? streets.find((s) => norm(s).replace(/(straße|strasse|str\.?)$/, "str") === norm(strasse).replace(/(straße|strasse|str\.?)$/, "str"));
    if (!exact) {
      const sug = streets.filter((s) => norm(s).includes(norm(strasse).slice(0, 3))).slice(0, 12);
      throw new AwsError(`Straße „${strasse}“ in ${ortHit} nicht gefunden. ${sug.length ? "Meintest du: " + sug.join(", ") + "?" : "Vorhanden sind z. B.: " + streets.slice(0, 10).join(", ") + " …"}`);
    }
    const out = await portal(cookie, { ...fields, Ort: ortHit, Strasse: exact, Hausnummer: nr, Hausnummerzusatz: (a.zusatz ?? "").trim(), ...(zeitraum ? { Zeitraum: decode(zeitraum) } : {}), SubmitAction: "forward", Ajax: "false" });
    const url = extractAboUrl(out);
    if (!url) {
      const msg = extractMessage(out);
      throw new AwsError(msg ? `Das Portal meldet: ${msg}` : "Für diese Adresse wurde kein Kalender gefunden. Bitte Hausnummer (und Zusatz) prüfen.");
    }
    return { url, address: extractAddress(out) ?? `${exact} ${nr}, ${ortHit}` };
  } catch (e) {
    if (e instanceof AwsError) throw e;
    throw new AwsError("Das AWS-Portal ist gerade nicht erreichbar oder hat sich verändert. Bitte später erneut versuchen oder die Abo-Adresse manuell einfügen.");
  }
}
