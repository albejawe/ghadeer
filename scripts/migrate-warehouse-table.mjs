import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrateWarehouseTable() {
  console.log("Starting warehouse table migration...");

  await db.batch([
    {
      sql: `CREATE TABLE IF NOT EXISTS warehouse_sales_new (
        id TEXT PRIMARY KEY,
        governorate_id TEXT NOT NULL,
        sale_date TEXT NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
        quantity INTEGER NOT NULL CHECK(quantity >= 0),
        amount REAL,
        note TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(governorate_id) REFERENCES governorates(id),
        FOREIGN KEY(created_by) REFERENCES app_users(id)
      )`,
      args: [],
    },
  ], "write");

  // Copy existing rows if any
  try {
    const existing = await db.execute("SELECT * FROM warehouse_monthly_sales");
    console.log(`Found ${existing.rows.length} existing warehouse rows.`);
    for (const row of existing.rows) {
      const now = new Date().toISOString();
      const saleDate = row.created_at ? String(row.created_at).slice(0, 10) : now.slice(0, 10);
      await db.execute({
        sql: `INSERT OR REPLACE INTO warehouse_sales_new 
              (id, governorate_id, sale_date, year, month, quantity, amount, note, created_by, created_at, updated_at) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          String(row.id),
          String(row.governorate_id),
          saleDate,
          Number(row.year),
          Number(row.month),
          Number(row.quantity),
          row.amount != null ? Number(row.amount) : null,
          "",
          String(row.created_by),
          String(row.created_at || now),
          String(row.updated_at || now),
        ],
      });
    }
  } catch (err) {
    console.log("Note on existing table:", err.message);
  }

  // Swap tables
  await db.batch([
    { sql: "DROP TABLE IF EXISTS warehouse_monthly_sales", args: [] },
    { sql: "ALTER TABLE warehouse_sales_new RENAME TO warehouse_monthly_sales", args: [] },
  ], "write");

  const tableInfo = await db.execute("PRAGMA table_info(warehouse_monthly_sales)");
  console.log("Updated warehouse_monthly_sales columns:", tableInfo.rows.map(c => c.name));
  console.log("Migration completed successfully!");
}

migrateWarehouseTable().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
