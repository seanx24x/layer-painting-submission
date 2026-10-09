import { strict as assert } from "node:assert";
import { test } from "node:test";
import { materialReturnHref } from "./study-links";

test("full lessons return a material to the same guide step without changing its route", () => {
  const from = "/paint/blood-angels-classic?step=shadows";
  const url = new URL(materialReturnHref(from, "gold/ornament")!, "https://layer.test");
  assert.equal(url.pathname, "/paint/blood-angels-classic");
  assert.equal(url.searchParams.get("step"), "shadows");
  assert.equal(url.searchParams.get("material"), "gold/ornament");
  assert.equal(materialReturnHref(from), from);
});

test("lesson return links reject external and unrelated destinations", () => {
  for (const href of [undefined, "https://example.com", "//example.com", "/paint/../settings", "/saved", "/paint/guide?step=base&redirect=evil"]) {
    assert.equal(materialReturnHref(href, "gold"), undefined);
  }
});
