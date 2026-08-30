import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

dotenv.config({ quiet: true });

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required");
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function seedRepresentatives() {
  console.log("Fetching governorates...");
  const govsResult = await db.execute("SELECT id, name FROM governorates WHERE active = 1 ORDER BY name");
  const governorates = govsResult.rows;
  console.log("Found governorates:", governorates);

  const now = new Date().toISOString();
  const statements = [];

  for (const gov of governorates) {
    console.log(`Generating 6 representatives for ${gov.name} (${gov.id})...`);
    for (let i = 1; i <= 6; i++) {
      const repName = `مندوب ${gov.name} ${i}`;
      const repId = randomUUID();
      statements.push({
        sql: `INSERT INTO representatives (id, name, governorate_id, active, created_at, updated_at) 
              VALUES (?, ?, ?, 1, ?, ?) 
              ON CONFLICT(name, governorate_id) DO UPDATE SET active = 1, updated_at = excluded.updated_at`,
        args: [repId, repName, gov.id, now, now],
      });
    }
  }

  console.log(`Executing batch insert of ${statements.length} representatives...`);
  await db.batch(statements, "write");

  const countResult = await db.execute("SELECT COUNT(*) as count FROM representatives WHERE active = 1");
  console.log("Total active representatives in DB:", countResult.rows[0].count);

  const allReps = await db.execute(`
    SELECT r.id, r.name, g.name as governorate 
    FROM representatives r 
    JOIN governorates g ON g.id = r.governorate_id 
    WHERE r.active = 1 
    ORDER BY g.name, r.name
  `);
  console.log("Representatives list count:", allReps.rows.length);
  console.log("Sample representatives:\n", JSON.stringify(allReps.rows, null, 2));
  console.log("SUCCESS: Seeded 6 representatives per governorate!");
}

seedRepresentatives().catch((err) => {
  console.error("Error seeding representatives:", err);
  process.exit(1);
});
