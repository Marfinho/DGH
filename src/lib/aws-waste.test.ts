import { test } from "node:test";
import assert from "node:assert/strict";
import { assertAllowedUrl, AwsError, parseHiddenFields, extractAboUrl, extractMessage, extractAddress } from "./aws-waste.ts";
import { parseIcs } from "./ics-import.ts";

const OK = "https://kundenlogin.aws-shg.de/WasteManagementSchaumburg/WasteManagementServiceServlet?ApplicationName=Calendar&SubmitAction=sync&StandortID=1&AboID=2&Fra=P;R;B;S;V";

test("Nur freigegebene https-Hosts sind erlaubt (SSRF-Schutz)", () => {
  assert.equal(assertAllowedUrl(OK).hostname, "kundenlogin.aws-shg.de");
  for (const bad of ["http://kundenlogin.aws-shg.de/x", "https://evil.example.com/x.ics", "https://kundenlogin.aws-shg.de.evil.com/x", "https://user:pw@kundenlogin.aws-shg.de/x", "https://kundenlogin.aws-shg.de:8443/x", "https://127.0.0.1/x", "https://localhost/x", "file:///etc/passwd", "kein url"])
    assert.throws(() => assertAllowedUrl(bad), AwsError, bad);
});

test("Portal-Antworten werden gelesen", () => {
  const html = `<INPUT NAME="SessionId" ID="SessionId" VALUE="ABC" TYPE="HIDDEN"><INPUT NAME="Ajax" VALUE="false" TYPE="HIDDEN"><INPUT NAME="Hausnummer" TYPE="TEXT">
  <SPAN>Adresse</SPAN> <SPAN class="x">Dorfstr. 2, 31559 Haste</SPAN> Stand
  <P ID="ICalAboLink_Stage">${OK.replace(/&/g, "&amp;")}</P>`;
  assert.deepEqual(parseHiddenFields(html), { SessionId: "ABC", Ajax: "false" });
  assert.equal(extractAboUrl(html), OK);
  assert.equal(extractAddress(html), "Dorfstr. 2, 31559 Haste");
  const err = `<H2>Hinweise und Fehlermeldungen</H2><SPAN>Bitte wählen Sie eine vollständige Adresse.</SPAN></DIV>`;
  assert.match(extractMessage(err) ?? "", /vollständige Adresse/);
  assert.equal(extractAboUrl(err), null);
});

test("AWS-Kalender (Format des Portals) wird korrekt eingelesen", () => {
  const ics = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VTIMEZONE\nTZID:Europe/Berlin\nBEGIN:STANDARD\nDTSTART:19701025T030000\nRRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU\nEND:STANDARD\nEND:VTIMEZONE\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261112\nDTEND;VALUE=DATE:20261113\nLOCATION;LANGUAGE=de:Dorfstr. 2\\, 31559 Haste\nSUMMARY;LANGUAGE=de:Restabfall \nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261119\nSUMMARY;LANGUAGE=de:Bioabfall \nEND:VEVENT\nEND:VCALENDAR\n`;
  const r = parseIcs(ics, { now: new Date("2026-11-10T00:00:00Z") });
  assert.deepEqual(r.map((x) => `${x.type} ${x.date.toISOString().slice(0, 10)}`), ["Restabfall 2026-11-12", "Bioabfall 2026-11-19"]);
});
