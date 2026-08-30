import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function clean() {
  const kut1Rep = await db.execute("SELECT id FROM representatives WHERE name = 'kut1' LIMIT 1");
  const targetRep = await db.execute("SELECT id FROM representatives WHERE name = 'مندوب الكوت 1' LIMIT 1");
  
  if (kut1Rep.rows.length > 0 && targetRep.rows.length > 0) {
    const kut1Id = kut1Rep.rows[0].id;
    const targetId = targetRep.rows[0].id;
    await db.execute({
      sql: "UPDATE sales SET representative_id = ? WHERE representative_id = ?",
      args: [targetId, kut1Id],
    });
    await db.execute({
      sql: "DELETE FROM representatives WHERE id = ?",
      args: [kut1Id],
    });
  }

  const count = await db.execute("SELECT COUNT(*) as count FROM representatives WHERE active = 1");
  console.log("Clean active reps count (should be exactly 24):", count.rows[0].count);
  
  const allReps = await db.execute(`
    SELECT r.name, g.name as governorate 
    FROM representatives r 
    JOIN governorates g ON g.id = r.governorate_id 
    WHERE r.active = 1 
    ORDER BY g.name, r.name
  `);
  console.log("All 24 representatives:", allReps.rows);
}
clean();
