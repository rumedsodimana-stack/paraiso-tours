import test from "node:test";
import assert from "node:assert/strict";
import { toCsv } from "./csv";

test("toCsv: empty rows → empty string", () => {
  assert.equal(toCsv([]), "");
});

test("toCsv: basic row", () => {
  const out = toCsv([{ a: 1, b: "hi" }]);
  assert.equal(out, "a,b\r\n1,hi");
});

test("toCsv: RFC-4180 quoting for commas, quotes, newlines", () => {
  const out = toCsv([{ a: `he said "hi"`, b: "x,y", c: "line1\nline2" }]);
  // Expected: each tricky field wrapped in quotes, inner quotes doubled.
  const lines = out.split("\r\n");
  assert.equal(lines[0], "a,b,c");
  assert.match(lines[1], /"he said ""hi""","x,y","line1\nline2"/);
});

test("toCsv: null/undefined become empty", () => {
  const out = toCsv([{ a: null, b: undefined, c: "ok" }]);
  assert.equal(out, "a,b,c\r\n,,ok");
});

test("toCsv: respects explicit column order", () => {
  const out = toCsv(
    [{ a: 1, b: 2, c: 3 }],
    ["c", "a", "b"]
  );
  assert.equal(out, "c,a,b\r\n3,1,2");
});
