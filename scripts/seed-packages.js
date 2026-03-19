#!/usr/bin/env node
/**
 * Re-seed packages from mock-data. Overwrites data/packages.json
 * with the latest mockPackages (including any newly added packages).
 * Run: npm run seed:packages
 */
const fs = require("fs");
const path = require("path");

const dataDir = path.join(process.cwd(), "data");
const packagesPath = path.join(dataDir, "packages.json");

// Dynamic import of mock data (ESM)
async function run() {
  const { mockPackages } = await import("../src/lib/mock-data.ts");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(packagesPath, JSON.stringify(mockPackages, null, 2), "utf-8");
  console.log(`✓ Seeded ${mockPackages.length} packages to ${packagesPath}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
