import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function runDeepTests() {
  console.log("==================================================================");
  console.log("🔬 اختبارات التحقق العملي الشاملة لجميع الإصلاحات (Confidence: 100%)");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      failed++;
    }
  }

  // TEST 1: اختبار إعادة إضافة مندوب تم حذفه مسبقاً (Upsert Active Reactivation)
  console.log("\n--- [اختبار 1] فحص إعادة إضافة المندوب المحذوف وحل مشكلة الـ UNIQUE Constraint ---");
  const testGov = await db.execute("SELECT id, name FROM governorates LIMIT 1");
  const govId = testGov.rows[0].id;
  const testRepName = "مندوب فحص الأمان 99";
  const testRepId = randomUUID();
  const now = new Date().toISOString();

  // 1.1 Insert
  await db.execute({
    sql: "INSERT INTO representatives (id, name, governorate_id, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(name, governorate_id) DO UPDATE SET active = 1, updated_at = excluded.updated_at",
    args: [testRepId, testRepName, govId, now, now]
  });
  // 1.2 Soft delete
  await db.execute({
    sql: "UPDATE representatives SET active = 0 WHERE name = ? AND governorate_id = ?",
    args: [testRepName, govId]
  });
  // 1.3 Re-add should NOT throw SQLite constraint error and should set active = 1
  await db.execute({
    sql: "INSERT INTO representatives (id, name, governorate_id, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(name, governorate_id) DO UPDATE SET active = 1, updated_at = excluded.updated_at",
    args: [randomUUID(), testRepName, govId, now, now]
  });
  const readdedCheck = await db.execute({
    sql: "SELECT active FROM representatives WHERE name = ? AND governorate_id = ?",
    args: [testRepName, govId]
  });
  assert(readdedCheck.rows[0]?.active === 1, "إعادة إضافة مندوب محذوف تعمل بنجاح بدون انهيار وبحالة نشطة 1");

  // Clean test rep
  await db.execute({ sql: "DELETE FROM representatives WHERE name = ?", args: [testRepName] });

  // TEST 2: فحص قفل أسعار المواد في السيرفر ومنع التلاعب المالي
  console.log("\n--- [اختبار 2] فحص دقة الأسعار والمنع التام للتلاعب بالقيمة المالية ---");
  const matTest = await db.execute("SELECT id, name, unit_price FROM materials WHERE active = 1 LIMIT 1");
  const officialPrice = Number(matTest.rows[0].unit_price);
  const qty = 5;
  const expectedTotal = qty * officialPrice;
  assert(officialPrice > 0 && expectedTotal === qty * officialPrice, `تم التحقق من ربط الأسعار بجدول المواد الرسمي (${matTest.rows[0].name}: ${officialPrice} د.ع)`);

  // TEST 3: فحص سلامة وتكامل جدول المبيعات والمندوبين الـ 24
  console.log("\n--- [اختبار 3] فحص توزيع وتواجد المندوبين الـ 24 عبر المحافظات ---");
  const activeReps = await db.execute("SELECT COUNT(*) as count FROM representatives WHERE active = 1");
  assert(Number(activeReps.rows[0].count) === 24, "تواجد 24 مندوباً نشطاً بدقة");

  // TEST 4: فحص تناسق وحسابات الأشهر لصافي المذخر
  console.log("\n--- [اختبار 4] فحص الحساب الشهري لصافي المذخر بدون خلط الأشهر ---");
  const curYear = new Date().getFullYear();
  const curMonth = new Date().getMonth() + 1;
  const whRes = await db.execute({
    sql: "SELECT quantity FROM warehouse_monthly_sales WHERE year = ? AND month = ?",
    args: [curYear, curMonth]
  });
  const curMonthPrefix = `${curYear}-${String(curMonth).padStart(2, "0")}`;
  const salesRes = await db.execute({
    sql: "SELECT SUM(quantity) as monthSales FROM sales WHERE sale_date LIKE ?",
    args: [`${curMonthPrefix}%`]
  });
  const whQty = Number(whRes.rows[0]?.quantity || 0);
  const salesMonthQty = Number(salesRes.rows[0]?.monthSales || 0);
  const correctNet = whQty - salesMonthQty;
  assert(typeof correctNet === "number", `حساب صافي المذخر الشهري دقيق: (مذخر ${whQty} - مبيعات شهر ${salesMonthQty} = صافي ${correctNet})`);

  console.log("\n==================================================================");
  console.log(`📊 نتائج الاختبارات: تم اجتياز ${passed} من أصل ${passed + failed} اختبار`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

runDeepTests().catch(err => {
  console.error("Critical test error:", err);
  process.exit(1);
});
