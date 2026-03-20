import assert from "node:assert/strict";
import test from "node:test";
import { buildAppDataContext } from "./ai-data-context";

test("app data context includes live snapshot headings and query matches", async () => {
  const context = await buildAppDataContext({
    query: "Ceylon Heritage",
  });

  assert.match(context, /Live app data snapshot as of/);
  assert.match(context, /Bookings:/);
  assert.match(context, /Packages:/);
  assert.match(context, /Query-matched records for "Ceylon Heritage"/);
  assert.match(context, /Matching packages:/);
});
