import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ path: process.env.TURSO_ENV_FILE || undefined, quiet: true });

if (process.env.ALLOW_DESTRUCTIVE_RESET !== "YES") {
  throw new Error("Destructive reset blocked. Set ALLOW_DESTRUCTIVE_RESET=YES only for an intentional full reset.");
}

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required");
}

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const governorates = ["الكوت", "العمارة", "البصرة", "الناصرية"];
const companies = ["LDP", "MEDREICH"];
const materials = [
  ["Ceftriaxone Vial 1 g IM", 3610, "LDP"],
  ["Ceftriaxone Vial 1 g IV", 3610, "LDP"],
  ["Ceftriaxone Vial 0.5 g IM/IV", 2475, "LDP"],
  ["Ceftriaxone Vial 0.5 g IM", 2062, "LDP"],
  ["Ceftriaxone Vial 0.25 g IM/IV", 2062, "LDP"],
  ["Cefotaxime Vial 1 g IM", 3093, "LDP"],
  ["Cefotaxime Vial 1 g IV", 3093, "LDP"],
  ["Cefotaxime Vial 0.5 g IM/IV", 2062, "LDP"],
  ["Ceftazidime Vial 1 g IM", 4743, "LDP"],
  ["Ceftazidime Vial 1 g IV", 4743, "LDP"],
  ["Nefopam Medisol 20 mg/2 ml Amp IM/IV", 21257, "LDP"],
  ["Meropenem Vial 1 g IV", 12022, "LDP"],
  ["Cefepime Vial 1 g IM/IV", 7012, "LDP"],
  ["Amitron Vial 0.5 g IM/IV", 1932, "LDP"],
  ["Azoxine 250 mg tab", 3999, "LDP"],
  ["Co-Amoxiclav 625 mg tab", 7734, "LDP"],
  ["Amitron cap 500 mg", 13044, "LDP"],
  ["Augmentin 625 mg", 7837, "MEDREICH"],
  ["Augmentin 1000 mg (20 tab)", 5775, "MEDREICH"],
  ["Amoxicillin cap 500 mg", 3547, "MEDREICH"],
  ["Amoxicillin & Clavulanate 457 mg/5 ml", 3093, "MEDREICH"],
  ["Amoxicillin & Clavulanate 312 mg/5 ml", 3609, "MEDREICH"],
  ["Loratadine tab", 1237, "MEDREICH"],
  ["Gabapentin 300 mg × 10 tab", 7218, "MEDREICH"],
  ["Gabapentin 100 mg × 10 cap", 6600, "MEDREICH"],
  ["Bisacodyl 5 mg × 10 cap", 3090, "MEDREICH"],
];

const now = new Date().toISOString();
const slug = (prefix, index) => `${prefix}-${String(index + 1).padStart(2, "0")}`;
const statements = [
  "DROP TABLE IF EXISTS payment_state",
  "DROP TABLE IF EXISTS invoices",
  "DROP TABLE IF EXISTS shared_links",
  "DROP TABLE IF EXISTS settings",
  "DROP TABLE IF EXISTS sync_metadata",
  "DROP TABLE IF EXISTS audit_logs",
  "DROP TABLE IF EXISTS sales",
  "DROP TABLE IF EXISTS warehouse_monthly_sales",
  "DROP TABLE IF EXISTS monthly_targets",
  "DROP TABLE IF EXISTS user_companies",
  "DROP TABLE IF EXISTS representatives",
  "DROP TABLE IF EXISTS materials",
  "DROP TABLE IF EXISTS companies",
  "DROP TABLE IF EXISTS governorates",
  "DROP TABLE IF EXISTS app_users",
  `CREATE TABLE app_users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin', 'supervisor')), password_hash TEXT NOT NULL, governorate_id TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE TABLE governorates (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE companies (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE materials (id TEXT PRIMARY KEY, name TEXT NOT NULL, company_id TEXT NOT NULL, unit_price REAL NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(name, company_id), FOREIGN KEY(company_id) REFERENCES companies(id))`,
  `CREATE TABLE representatives (id TEXT PRIMARY KEY, name TEXT NOT NULL, governorate_id TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(name, governorate_id), FOREIGN KEY(governorate_id) REFERENCES governorates(id))`,
  `CREATE TABLE user_companies (user_id TEXT NOT NULL, company_id TEXT NOT NULL, PRIMARY KEY(user_id, company_id), FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE)`,
  `CREATE TABLE sales (id TEXT PRIMARY KEY, supervisor_id TEXT NOT NULL, representative_id TEXT NOT NULL, governorate_id TEXT NOT NULL, company_id TEXT NOT NULL, material_id TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price REAL NOT NULL CHECK(unit_price >= 0), total_amount REAL NOT NULL DEFAULT 0 CHECK(total_amount >= 0), sale_date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(supervisor_id) REFERENCES app_users(id), FOREIGN KEY(representative_id) REFERENCES representatives(id), FOREIGN KEY(governorate_id) REFERENCES governorates(id), FOREIGN KEY(company_id) REFERENCES companies(id), FOREIGN KEY(material_id) REFERENCES materials(id))`,
  `CREATE TABLE warehouse_monthly_sales (id TEXT PRIMARY KEY, governorate_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), quantity INTEGER NOT NULL CHECK(quantity >= 0), amount REAL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(governorate_id, year, month), FOREIGN KEY(governorate_id) REFERENCES governorates(id), FOREIGN KEY(created_by) REFERENCES app_users(id))`,
  `CREATE TABLE monthly_targets (id TEXT PRIMARY KEY, governorate_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), target_quantity INTEGER NOT NULL DEFAULT 0 CHECK(target_quantity >= 0), target_amount REAL, created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(governorate_id, year, month), FOREIGN KEY(governorate_id) REFERENCES governorates(id), FOREIGN KEY(created_by) REFERENCES app_users(id))`,
  `CREATE TABLE audit_logs (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, details_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, FOREIGN KEY(actor_id) REFERENCES app_users(id))`,
  "CREATE INDEX sales_date_idx ON sales(sale_date)",
  "CREATE INDEX sales_governorate_idx ON sales(governorate_id)",
  "CREATE INDEX sales_supervisor_idx ON sales(supervisor_id)",
  "CREATE INDEX audit_created_idx ON audit_logs(created_at)",
];

await db.batch(statements.map((sql) => ({ sql, args: [] })), "write");

await db.batch([
  ...governorates.map((name, index) => ({ sql: "INSERT INTO governorates (id, name, created_at) VALUES (?, ?, ?)", args: [slug("gov", index), name, now] })),
  ...companies.map((name, index) => ({ sql: "INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)", args: [slug("company", index), name, now] })),
  ...materials.map(([name, price, company], index) => ({ sql: "INSERT INTO materials (id, name, company_id, unit_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", args: [slug("material", index), name, company === "LDP" ? "company-01" : "company-02", price, now, now] })),
], "write");

const tables = await db.batch([
  { sql: "SELECT COUNT(*) AS count FROM governorates", args: [] },
  { sql: "SELECT COUNT(*) AS count FROM companies", args: [] },
  { sql: "SELECT COUNT(*) AS count FROM materials", args: [] },
], "read");
console.log(JSON.stringify({ governorates: Number(tables[0].rows[0].count), companies: Number(tables[1].rows[0].count), materials: Number(tables[2].rows[0].count) }));
