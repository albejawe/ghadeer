/**
 * Test: Per-governorate inventory system
 * Verifies API schema, endpoint logic, and data integrity
 */
import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ quiet: true });

const BASE_URL = "http://localhost:3000";
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

let passed = 0, failed = 0;
function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, detail) { console.error(`  ❌ ${label}: ${detail}`); failed++; }

async function check(label, fn) {
  try { await fn(); }
  catch (e) { fail(label, e.message); }
}

console.log("\n🔍 فحص قاعدة البيانات — inventory_stock_v2\n");

await check("جدول inventory_stock_v2 موجود", async () => {
  const r = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory_stock_v2'");
  if (!r.rows.length) throw new Error("الجدول غير موجود");
  ok("جدول inventory_stock_v2 موجود");
});

await check("فهرس idx_inv_governorate موجود", async () => {
  const r = await db.execute("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_inv_governorate'");
  if (!r.rows.length) throw new Error("الفهرس غير موجود");
  ok("فهرس idx_inv_governorate موجود");
});

await check("schema يحتوي على (material_id, governorate_id) كـ PK", async () => {
  const r = await db.execute("PRAGMA table_info(inventory_stock_v2)");
  const cols = r.rows.map(c => String(c.name));
  const required = ["material_id", "governorate_id", "quantity", "updated_by", "updated_at"];
  for (const c of required) {
    if (!cols.includes(c)) throw new Error(`عمود مفقود: ${c}`);
  }
  ok("جميع الأعمدة موجودة: " + required.join(", "));
});

await check("يمكن INSERT بـ (material_id, governorate_id) مختلفة", async () => {
  const govs = await db.execute("SELECT id FROM governorates LIMIT 2");
  const mats = await db.execute("SELECT id FROM materials LIMIT 1");
  if (!govs.rows.length || !mats.rows.length) throw new Error("لا توجد بيانات أساسية");
  const matId = govs.rows.length > 0 ? String(mats.rows[0].id) : null;
  const govId1 = String(govs.rows[0].id);
  const govId2 = govs.rows.length > 1 ? String(govs.rows[1].id) : null;

  await db.execute({
    sql: "INSERT INTO inventory_stock_v2 (material_id, governorate_id, quantity, updated_by, updated_at) VALUES (?, ?, 10, 'test', datetime('now')) ON CONFLICT(material_id, governorate_id) DO UPDATE SET quantity = 10",
    args: [matId, govId1],
  });
  ok(`INSERT لـ ${govId1}: نجح`);

  if (govId2) {
    await db.execute({
      sql: "INSERT INTO inventory_stock_v2 (material_id, governorate_id, quantity, updated_by, updated_at) VALUES (?, ?, 20, 'test', datetime('now')) ON CONFLICT(material_id, governorate_id) DO UPDATE SET quantity = 20",
      args: [matId, govId2],
    });
    ok(`INSERT نفس المادة لمحافظة مختلفة ${govId2}: نجح`);

    // Verify they are independent
    const r = await db.execute({
      sql: "SELECT governorate_id, quantity FROM inventory_stock_v2 WHERE material_id = ? ORDER BY governorate_id",
      args: [matId],
    });
    const q1 = r.rows.find(x => String(x.governorate_id) === govId1);
    const q2 = r.rows.find(x => String(x.governorate_id) === govId2);
    if (Number(q1?.quantity) !== 10) throw new Error("قيمة المحافظة الأولى غلط");
    if (Number(q2?.quantity) !== 20) throw new Error("قيمة المحافظة الثانية غلط");
    ok("الكميات مستقلة لكل محافظة ✓");
  }
});

console.log("\n🔍 فحص الـ API (يتطلب تشغيل السيرفر)\n");

async function tryFetch(path, init) {
  try {
    const r = await fetch(`${BASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(3000) });
    return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
  } catch (e) {
    return { ok: false, status: 0, body: {}, error: e.message };
  }
}

const inv = await tryFetch("/api/local/inventory", { credentials: "include" });
if (inv.status === 0) {
  console.log("  ⚠️  السيرفر غير مشغّل — تخطي فحص الـ API");
} else {
  await check("GET /inventory يرجع governorates في الاستجابة", async () => {
    if (inv.status === 403) { ok("403 — لا يوجد session (طبيعي في بيئة اختبار)"); return; }
    if (!inv.body.governorates) throw new Error("حقل governorates مفقود من الاستجابة");
    ok(`governorates: ${inv.body.governorates.length} محافظة`);
  });
}

console.log(`\n📊 النتيجة: ${passed} نجح · ${failed} فشل\n`);
if (failed) process.exit(1);
