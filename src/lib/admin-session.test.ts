import test from "node:test";
import assert from "node:assert/strict";
import {
  createAdminSessionToken,
  getSafeAdminNextPath,
  verifyAdminSessionToken,
} from "./admin-session";

test("admin session token round-trips through create and verify", async () => {
  const token = await createAdminSessionToken();
  const payload = await verifyAdminSessionToken(token);

  assert.ok(payload);
  assert.equal(payload?.role, "admin");
  assert.ok((payload?.expiresAt ?? 0) > Date.now());
});

test("getSafeAdminNextPath only allows internal admin destinations", () => {
  assert.equal(getSafeAdminNextPath("/admin/payments"), "/admin/payments");
  assert.equal(getSafeAdminNextPath("/packages"), "/admin");
  assert.equal(getSafeAdminNextPath("https://example.com"), "/admin");
  assert.equal(getSafeAdminNextPath("//evil.test"), "/admin");
});
