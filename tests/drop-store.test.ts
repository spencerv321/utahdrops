import { test } from "node:test";
import assert from "node:assert/strict";
import { matchDropStore, streetTokens, type StoreAddress } from "../lib/dabs/drop-store";

// Stores as in production on 2026-10-11 (report.yml → dropstores), the ones that matter here.
const STORES: StoreAddress[] = [
  { id: 1, address: "151 East 300 South", city: "Salt Lake City" },
  { id: 3, address: "5432 High Market Drive, Suite F", city: "West Valley City" },
  { id: 6, address: "75 W 400 N", city: "Logan" },
  { id: 7, address: "50 N 1ST W", city: "Price" },
  { id: 8, address: "520 N 500 W", city: "Bountiful" },
  { id: 10, address: "433 N MAIN ST", city: "Tooele" },
  { id: 13, address: "1255 W N TEMPLE", city: "Salt Lake City" },
  { id: 24, address: "1160 PATTERSON AVE", city: "Ogden" },
  { id: 29, address: "1814 E MURRAY HOLLADAY RD", city: "HOLLADAY" },
  { id: 37, address: "1612 UTE BLVD - #103", city: "Park City" },
  { id: 38, address: "1550 SNOWCREEK DR", city: "Park City" },
  { id: 39, address: "161 N 900 E", city: "Saint George" },
  { id: 41, address: "300 W HARRIS AVE", city: "Salt Lake City" },
  { id: 44, address: "671 S PLEASANT GROVE BLVD", city: "Pleasant Grove" },
  { id: 46, address: "6262 S 5600 W", city: "WEST VALLEY CITY" },
  { id: 47, address: "865 W ANTELOPE DR", city: "SYRACUSE" },
  { id: 48, address: "5278 W ANTHEM PEAK LANE", city: "HERRIMAN" },
  { id: 52, address: "1880 E 9400 S", city: "Sandy" },
  { id: 53, address: "1115 W 12th St", city: "MARRIOTT-SLATERVILLE" },
];

test("every drop address DABS has used matches the right store", () => {
  const cases: [string, number][] = [
    ["280 W Harris Ave, SLC 84115", 41],
    ["280 W Harris Ave, Salt Lake City 84115", 41],
    ["1814 E Murray Holladay Road, Holladay 84117", 29],
    ["1550 Snowcreek Dr, Park City 84060", 38],
    ["1880 E 9400 S, Sandy 84092", 52],
    ["671 S Pleasant Grove Blvd, Pleasant Grove 84062", 44],
    ["5278 West Anthem Peak Lane, Herriman 84096", 48],
    ["1160 Patterson, Ogden 84403", 24],
    ["161 N 900 E, St George 84770", 39],
    ["520 N 500 W, Bountiful 84010", 8],
    ["6262 S. 5600 W, West Valley City, 84118", 46],
    ["865 W. Antelope Dr, Syracuse 84075", 47],
    ["75 W 4TH N, Logan 84321", 6],
    ["433 N Main, Tooele 84074", 10],
  ];
  for (const [text, id] of cases) assert.equal(matchDropStore(text, STORES), id, text);
});

test("no match rather than a wrong one", () => {
  assert.equal(matchDropStore("", STORES), null);
  assert.equal(matchDropStore("999 W Nowhere Rd, Ogden 84403", STORES), null);
  // Harris Ave in another city isn't #41
  assert.equal(matchDropStore("280 W Harris Ave, Provo 84601", STORES), null);
  // no city: only exact street matches count
  assert.equal(matchDropStore("280 W Harris Ave", STORES), null);
});

test("streetTokens normalizes spelling, suites and Utah grid ordinals", () => {
  assert.deepEqual(streetTokens("75 W 4TH N"), ["75", "W", "400", "N"]);
  assert.deepEqual(streetTokens("1115 W 12th St"), ["1115", "W", "12TH", "ST"]);
  assert.deepEqual(streetTokens("1612 UTE BLVD - #103"), ["1612", "UTE", "BLVD"]);
  assert.deepEqual(streetTokens("5432 High Market Drive, Suite F"), ["5432", "HIGH", "MARKET", "DR"]);
  assert.deepEqual(streetTokens("6262 S. 5600 W"), ["6262", "S", "5600", "W"]);
});
