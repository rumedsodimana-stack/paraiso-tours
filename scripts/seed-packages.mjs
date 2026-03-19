#!/usr/bin/env node
/**
 * Re-seed packages from mock-data. Overwrites data/packages.json
 * with the latest mockPackages.
 */
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const packagesPath = path.join(dataDir, "packages.json");

async function run() {
  const { mockPackages } = await import("../src/lib/mock-data.ts");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(packagesPath, JSON.stringify(mockPackages, null, 2), "utf-8");
  console.log(`Seeded ${mockPackages.length} packages to ${packagesPath}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
