import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cityFromAddress, displayName, parseLookerTable, titleCase, toLicensee } from "../lib/licensees";

// A trimmed copy of the report's real batchedDataV2 response (7 rows, with
// null addresses and dates), so a Looker format change fails here first.
const body = readFileSync(join(__dirname, "fixtures/looker-licensees.txt"), "utf8");

test("parses the report's column-wise table, filling nullIndex gaps", () => {
  const rows = parseLookerTable(body)!;
  assert.equal(rows.length, 7);
  assert.equal(rows[0][0], "AL-1");
  assert.equal(rows[0].length, 9);
  const mr = rows.find((r) => r[0] === "MR-67")!;
  assert.equal(mr[4], "", "null address stays empty");
  const tv = toLicensee(rows.find((r) => r[0] === "TV-1")!);
  assert.equal(tv.type, "On-Premise Beer Retailer (Tavern - 5% or less ABV)");
  assert.equal(tv.city, "St. George");
  assert.equal(tv.original_issue_date, "2003-11-20");
  assert.equal(toLicensee(rows.find((r) => r[0] === "BE-184")!).original_issue_date, null);
});

test("returns null for responses without the 9-column table", () => {
  assert.equal(parseLookerTable(")]}'\n{\"dataResponse\":[]}"), null);
  assert.equal(parseLookerTable("not json"), null);
});

test("cityFromAddress handles DABS's municipality spellings", () => {
  const cases: [string, string | null][] = [
    ["3920 W TERMINAL DR, SALT LAKE CITY, UT 84122", "Salt Lake City"],
    ["221 S MAIN ST, MOAB CITY, UT 84532", "Moab"],
    ["625 MAIN ST, PARK CITY (SUMMIT CO), UT 84060", "Park City"],
    ["123 RD, Unit 400, CITY OF HOLLADAY, UT 84121", "Holladay"],
    ["1 X ST, DRAPER CITY (SL CO), UT 84020", "Draper"],
    ["1 X ST, SOUTH SALT LAKE CITY, UT 84115", "South Salt Lake"],
    ["1 X ST, WEST VALLEY CITY, UT 84119", "West Valley City"],
    ["1 X ST, HERRIMAN TOWN, UT 84096", "Herriman"],
    ["770 W State Road 9, Virgin, Utah 84779", "Virgin"],
    ["785 E MAIN ST, UT 84078", null],
    ["1 X ST, Wasatch County, UT 84032", null],
    ["", null],
  ];
  for (const [address, city] of cases) assert.equal(cityFromAddress(address), city, address);
});

test("display names are readable without changing mixed-case names", () => {
  assert.equal(titleCase("BEERHIVE PUB"), "Beerhive Pub");
  assert.equal(titleCase("GRACIE'S"), "Gracie's");
  assert.equal(titleCase("Bongo Lounge"), "Bongo Lounge");
  assert.equal(displayName("BEWILDER BREWING COMPANY (BAR)"), "Bewilder Brewing Company");
  assert.equal(displayName("Maggiano's (CBN-2-003)"), "Maggiano's");
  assert.equal(displayName("ONE AND ONLY"), "One and Only");
});
