import test from "node:test";
import assert from "node:assert/strict";
import { leadSchema } from "./validation";

test("leadSchema: name + email required", () => {
  const res = leadSchema.safeParse({});
  assert.equal(res.success, false);
});

test("leadSchema: minimal valid lead", () => {
  const res = leadSchema.safeParse({
    name: "Jane",
    email: "jane@example.com",
  });
  assert.equal(res.success, true);
});

test("leadSchema: packageId without pax is rejected", () => {
  const res = leadSchema.safeParse({
    name: "Jane",
    email: "jane@example.com",
    packageId: "pkg_abc",
  });
  assert.equal(res.success, false);
  if (!res.success) {
    const msg = res.error.issues.map((i) => i.message).join(" | ");
    assert.match(msg, /traveler count/i);
  }
});

test("leadSchema: packageId with pax is accepted", () => {
  const res = leadSchema.safeParse({
    name: "Jane",
    email: "jane@example.com",
    packageId: "pkg_abc",
    pax: 2,
  });
  assert.equal(res.success, true);
});

test("leadSchema: invalid travel date is rejected", () => {
  const res = leadSchema.safeParse({
    name: "Jane",
    email: "jane@example.com",
    travelDate: "not-a-date",
  });
  assert.equal(res.success, false);
});

test("leadSchema: valid YYYY-MM-DD travel date is accepted", () => {
  const res = leadSchema.safeParse({
    name: "Jane",
    email: "jane@example.com",
    travelDate: "2026-06-15",
  });
  assert.equal(res.success, true);
});

test("leadSchema: empty travelDate string is tolerated", () => {
  const res = leadSchema.safeParse({
    name: "Jane",
    email: "jane@example.com",
    travelDate: "",
  });
  assert.equal(res.success, true);
});
