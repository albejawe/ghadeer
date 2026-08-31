import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function check() {
  const indexes = await db.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index'");
  console.log("Indexes in DB:");
  indexes.rows.forEach(i => console.log(`- ${i.tbl_name}: ${i.name} -> ${i.sql || '(auto)'}`));
}

check();
