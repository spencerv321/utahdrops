import { test } from "node:test";
import assert from "node:assert/strict";
import { alertKindsFor, closeLabel, denverTime, kindsToSend, parseCloseDate } from "../lib/drawing-alerts";
import { parseRhdpWindows } from "../lib/dabs/rhdp";

const NOW = new Date("2026-12-02T18:00:00Z");

test("future drawings are announced; current ones are open", () => {
  assert.deepEqual(alertKindsFor({ drawing: "X", section: "future", closesAt: null }, NOW), ["announced"]);
  assert.deepEqual(alertKindsFor({ drawing: "X", section: "current", closesAt: null }, NOW), ["open"]);
});

test("closing goes out only with a known close date inside the lead time", () => {
  const soon = new Date(NOW.getTime() + 20 * 3600_000);
  const later = new Date(NOW.getTime() + 4 * 86400_000);
  assert.deepEqual(alertKindsFor({ drawing: "X", section: "current", closesAt: soon }, NOW), ["open", "closing"]);
  assert.deepEqual(alertKindsFor({ drawing: "X", section: "current", closesAt: later }, NOW), ["open"]);
});

test("a drawing still listed after its close date sends nothing", () => {
  const past = new Date(NOW.getTime() - 3600_000);
  assert.deepEqual(alertKindsFor({ drawing: "X", section: "current", closesAt: past }, NOW), []);
});

test("kindsToSend drops what was sent and puts the most urgent first", () => {
  assert.deepEqual(kindsToSend(["open", "closing"], []), ["closing", "open"]);
  assert.deepEqual(kindsToSend(["open", "closing"], ["open"]), ["closing"]);
  assert.deepEqual(kindsToSend(["announced"], ["announced"]), []);
});

test("denverTime handles standard and daylight time", () => {
  assert.equal(denverTime(2026, 12, 5, 23, 59).toISOString(), "2026-12-06T06:59:00.000Z");
  assert.equal(denverTime(2026, 9, 22, 17, 0).toISOString(), "2026-09-22T23:00:00.000Z");
});

test("parseCloseDate reads close words and ranges, never a lone date", () => {
  assert.equal(parseCloseDate("Entry period: 12/01/2026 - 12/05/2026")?.toISOString(), "2026-12-06T06:59:00.000Z");
  assert.equal(parseCloseDate("Drawing closes December 5, 2026 at 5:00 PM")?.toISOString(), "2026-12-06T00:00:00.000Z");
  assert.equal(parseCloseDate("Open Dec 1 through Dec 5, 2026")?.toISOString(), "2026-12-06T06:59:00.000Z");
  assert.equal(parseCloseDate("Sept 12 - Sept 22, 2023")?.toISOString(), "2023-09-23T05:59:00.000Z");
  assert.equal(parseCloseDate("Winners notified 12/10/2026"), null);
  assert.equal(parseCloseDate("PAPPY VAN WINKLE COLLECTION 2026"), null);
  assert.equal(parseCloseDate(""), null);
});

test("closeLabel shows the day, and the time only when DABS gave one", () => {
  assert.equal(closeLabel(denverTime(2026, 12, 5, 23, 59)), "Sat, Dec 5");
  assert.equal(closeLabel(denverTime(2026, 12, 5, 17, 0)), "Sat, Dec 5, 5 PM");
});

const PAGE = `
<div id="future">
  <a class="btn-link" href="#f1">ANTIQUE COLLECTION 2027</a>
  <div id="f1"><p>Entries open 01/10/2027 - 01/15/2027</p>
    <button class="NormalGridView">GEORGE T STAGG BOURBON - 018416 - $154.99 - 52 Bottles</button></div>
</div>
<div id="current">
  <a class="btn-link" href="#c1">PAPPY VAN WINKLE 2026</a>
  <div id="c1"><button class="NormalGridView">PAPPY 23 YR - 012345 - $299.99 - 6 Bottles</button></div>
</div>
<div id="past">
  <a class="btn-link" href="#p1">OLD DRAWING 2025</a>
  <div id="p1"><p>Closed 01/05/2025</p><p>Winner: Jane Example</p></div>
</div>`;

test("parseRhdpWindows reads open and upcoming drawings only, without product lines", () => {
  const w = parseRhdpWindows(PAGE);
  assert.deepEqual(
    w.map((x) => [x.section, x.drawing]),
    [["future", "ANTIQUE COLLECTION 2027"], ["current", "PAPPY VAN WINKLE 2026"]]
  );
  assert.equal(w[0].datesText, "Entries open 01/10/2027 - 01/15/2027");
  assert.equal(w[0].closesAt?.toISOString(), "2027-01-16T06:59:00.000Z");
  assert.equal(w[1].datesText, null);
  assert.equal(w[1].closesAt, null);
  assert.ok(!JSON.stringify(w).includes("Jane"));
});
