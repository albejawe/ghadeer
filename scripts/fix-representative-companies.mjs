import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function fixRepresentativeCompanies() {
  console.log("Fixing representative_companies mappings...");
  const reps = await db.execute("SELECT id, name FROM representatives WHERE active = 1");
  const comps = await db.execute("SELECT id, name FROM companies WHERE active = 1");

  const statements = [];
  for (const r of reps.rows) {
    for (const c of comps.rows) {
      statements.push({
        sql: "INSERT OR IGNORE INTO representative_companies (representative_id, company_id) VALUES (?, ?)",
        args: [String(r.id), String(c.id)],
      });
    }
  }

  await db.batch(statements, "write");
  const count = await db.execute("SELECT COUNT(*) as count FROM representative_companies");
  console.log(`✓ Total rows in representative_companies now: ${count.rows[0].count} (Expected: ${reps.rows.length * comps.rows.length})`);
}

fixRepresentativeCompanies().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
