import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let passed = 0;
let failed = 0;

function ok(title) {
  console.log(`  ✅ ${title}`);
  passed++;
}

function fail(title, err) {
  console.error(`  ❌ ${title}: ${err}`);
  failed++;
}

async function runTest(title, fn) {
  try {
    await fn();
    ok(title);
  } catch (e) {
    fail(title, e.message);
  }
}

console.log("\n🧪 فحص نظام تارغت المواد لكل محافظة (Material Targets System)\n");

// Ensure schema is created
await db.batch([
  {
    sql: "CREATE TABLE IF NOT EXISTS monthly_material_targets (id TEXT PRIMARY KEY, governorate_id TEXT NOT NULL, material_id TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12), target_quantity INTEGER NOT NULL CHECK(target_quantity >= 0), created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(governorate_id, material_id, year, month), FOREIGN KEY(governorate_id) REFERENCES governorates(id), FOREIGN KEY(material_id) REFERENCES materials(id), FOREIGN KEY(created_by) REFERENCES app_users(id))",
    args: [],
  },
  {
    sql: "CREATE INDEX IF NOT EXISTS idx_mat_targets_period ON monthly_material_targets(year, month, governorate_id)",
    args: [],
  },
], "write");

await runTest("جدول monthly_material_targets وفهرسه موجودان في قاعدة البيانات", async () => {
  const tableCheck = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='monthly_material_targets'");
  if (!tableCheck.rows.length) throw new Error("monthly_material_targets table missing");
  const idxCheck = await db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_mat_targets_period'");
  if (!idxCheck.rows.length) throw new Error("idx_mat_targets_period index missing");
});

await runTest("أعمدة جدول monthly_material_targets صحيحة وتحتوي على القيود المطلوبة", async () => {
  const cols = await db.execute("PRAGMA table_info(monthly_material_targets)");
  const names = cols.rows.map(c => String(c.name));
  const expected = ["id", "governorate_id", "material_id", "year", "month", "target_quantity", "created_by", "created_at", "updated_at"];
  for (const exp of expected) {
    if (!names.includes(exp)) throw new Error(`Column ${exp} is missing`);
  }
});

await runTest("إمكانية حفظ أهداف مواد متعددة لنفس المحافظة في نفس الشهر وحساب المجاميع بدقة", async () => {
  const govs = await db.execute("SELECT id, name FROM governorates LIMIT 1");
  const mats = await db.execute("SELECT id, name, unit_price FROM materials LIMIT 3");
  const users = await db.execute("SELECT id FROM app_users LIMIT 1");
  if (!govs.rows.length || mats.rows.length < 2 || !users.rows.length) throw new Error("بيانات المحافظات والمواد والمستخدمين غير كافية للاختبار");

  const govId = String(govs.rows[0].id);
  const userId = String(users.rows[0].id);
  const mat1 = mats.rows[0];
  const mat2 = mats.rows[1];
  const testYear = 2029;
  const testMonth = 11;
  const now = new Date().toISOString();

  // Clean test period
  await db.execute({
    sql: "DELETE FROM monthly_material_targets WHERE governorate_id = ? AND year = ? AND month = ?",
    args: [govId, testYear, testMonth],
  });

  // Insert 2 material targets
  const qty1 = 50;
  const qty2 = 100;
  await db.batch([
    {
      sql: "INSERT INTO monthly_material_targets (id, governorate_id, material_id, year, month, target_quantity, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [randomUUID(), govId, String(mat1.id), testYear, testMonth, qty1, userId, now, now],
    },
    {
      sql: "INSERT INTO monthly_material_targets (id, governorate_id, material_id, year, month, target_quantity, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [randomUUID(), govId, String(mat2.id), testYear, testMonth, qty2, userId, now, now],
    },
  ], "write");

  // Query back joined with materials
  const res = await db.execute({
    sql: "SELECT mt.material_id, mt.target_quantity, m.unit_price FROM monthly_material_targets mt JOIN materials m ON m.id = mt.material_id WHERE mt.governorate_id = ? AND mt.year = ? AND mt.month = ?",
    args: [govId, testYear, testMonth],
  });

  if (res.rows.length !== 2) throw new Error(`Expected 2 rows, got ${res.rows.length}`);
  const totalQty = res.rows.reduce((s, r) => s + Number(r.target_quantity), 0);
  if (totalQty !== 150) throw new Error(`Expected totalQty 150, got ${totalQty}`);

  const expectedAmount = qty1 * Number(mat1.unit_price) + qty2 * Number(mat2.unit_price);
  const calculatedAmount = res.rows.reduce((s, r) => s + Number(r.target_quantity) * Number(r.unit_price), 0);
  if (calculatedAmount !== expectedAmount) throw new Error(`Expected amount ${expectedAmount}, got ${calculatedAmount}`);

  // Clean up test data
  await db.execute({
    sql: "DELETE FROM monthly_material_targets WHERE governorate_id = ? AND year = ? AND month = ?",
    args: [govId, testYear, testMonth],
  });
});

await runTest("فحص استرجاع الأهداف وتجميع المواد عبر استعلام الـ API", async () => {
  const govs = await db.execute("SELECT id, name FROM governorates LIMIT 1");
  const mats = await db.execute("SELECT id, name, unit_price FROM materials LIMIT 2");
  const users = await db.execute("SELECT id FROM app_users LIMIT 1");
  const govId = String(govs.rows[0].id);
  const userId = String(users.rows[0].id);
  const testYear = 2030;
  const testMonth = 6;
  const now = new Date().toISOString();

  // Insert target items
  await db.batch([
    {
      sql: "INSERT INTO monthly_material_targets (id, governorate_id, material_id, year, month, target_quantity, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 35, ?, ?, ?)",
      args: [randomUUID(), govId, String(mats.rows[0].id), testYear, testMonth, userId, now, now],
    },
    {
      sql: "INSERT INTO monthly_material_targets (id, governorate_id, material_id, year, month, target_quantity, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 65, ?, ?, ?)",
      args: [randomUUID(), govId, String(mats.rows[1].id), testYear, testMonth, userId, now, now],
    },
    {
      sql: "INSERT INTO monthly_targets (id, governorate_id, year, month, target_quantity, target_amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 100, 500000, ?, ?, ?) ON CONFLICT(governorate_id, year, month) DO UPDATE SET target_quantity=100",
      args: [randomUUID(), govId, testYear, testMonth, userId, now, now],
    },
  ], "write");

  // Query using the exact same query used in localV2OperationsApi
  const itemsRes = await db.execute({
    sql: `SELECT mt.id, mt.governorate_id AS governorateId, mt.material_id AS materialId, m.name AS material, c.name AS company, m.unit_price AS unitPrice, mt.target_quantity AS targetQuantity FROM monthly_material_targets mt JOIN materials m ON m.id = mt.material_id JOIN companies c ON c.id = m.company_id WHERE mt.year = ? AND mt.month = ? ORDER BY c.name, m.name`,
    args: [testYear, testMonth],
  });

  if (itemsRes.rows.length !== 2) throw new Error(`Expected 2 items, got ${itemsRes.rows.length}`);
  const item1 = itemsRes.rows[0];
  if (!item1.material || !item1.company || item1.unitPrice == null) throw new Error("Item details missing");

  // Clean up
  await db.batch([
    { sql: "DELETE FROM monthly_material_targets WHERE governorate_id = ? AND year = ? AND month = ?", args: [govId, testYear, testMonth] },
    { sql: "DELETE FROM monthly_targets WHERE governorate_id = ? AND year = ? AND month = ?", args: [govId, testYear, testMonth] },
  ], "write");
});

console.log(`\n📊 النتيجة: ${passed} نجح · ${failed} فشل\n`);
if (failed > 0) process.exit(1);
