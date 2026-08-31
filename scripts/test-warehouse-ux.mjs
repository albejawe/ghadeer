import dotenv from "dotenv";
import { createClient } from "@libsql/client";
import { randomUUID } from "node:crypto";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function testWarehouseSales() {
  console.log("==================================================================");
  console.log("🧪 فحص واختبار حركات وتواريخ مبيعات المذاخر المتعددة بعد التحديث");
  console.log("==================================================================");

  const govRes = await db.execute("SELECT id, name FROM governorates LIMIT 1");
  const govId = govRes.rows[0].id;
  const govName = govRes.rows[0].name;
  const userRes = await db.execute("SELECT id FROM app_users WHERE role = 'admin' LIMIT 1");
  const adminId = userRes.rows[0].id;

  const now = new Date().toISOString();
  const id1 = randomUUID();
  const id2 = randomUUID();

  console.log(`\n1. إضافة الحركة الأولى لمحافظة ${govName} بتاريخ 2026-08-10...`);
  await db.execute({
    sql: `INSERT INTO warehouse_monthly_sales 
          (id, governorate_id, sale_date, year, month, quantity, amount, note, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id1, govId, "2026-08-10", 2026, 8, 150, 450000, "وجبة رقم 1 - شحنة المستودع", adminId, now, now],
  });

  console.log(`2. إضافة الحركة الثانية لنفس المحافظة (${govName}) بنفس الشهر بتاريخ 2026-08-25...`);
  await db.execute({
    sql: `INSERT INTO warehouse_monthly_sales 
          (id, governorate_id, sale_date, year, month, quantity, amount, note, created_by, created_at, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id2, govId, "2026-08-25", 2026, 8, 200, 600000, "وجبة رقم 2 - تعزيز البضاعة", adminId, now, now],
  });

  // Verify both exist
  const check = await db.execute({
    sql: "SELECT * FROM warehouse_monthly_sales WHERE governorate_id = ? AND year = 2026 AND month = 8 ORDER BY sale_date DESC",
    args: [govId],
  });

  console.log(`\n✓ تم العثور على ${check.rows.length} حركات مسجلة لنفس الشهر (لم يتم حذف أو الكتابة فوق السابقة!):`);
  check.rows.forEach(r => {
    console.log(`   - تاريخ: ${r.sale_date} | الكمية: ${r.quantity} قطعة | المبلغ: ${r.amount} | الملاحظة: ${r.note}`);
  });

  if (check.rows.length >= 2) {
    console.log("\n✅ [PASS] نجح تسجيل حركات وتواريخ متعددة لنفس المحافظة ونفس الشهر دون أي استبدال!");
  } else {
    console.error("\n❌ [FAIL] فشل الاختبار: تم استبدال السجل!");
    process.exit(1);
  }

  // Clean up test rows
  await db.execute({ sql: "DELETE FROM warehouse_monthly_sales WHERE id IN (?, ?)", args: [id1, id2] });
  console.log("✓ تم تنظيف بيانات الاختبار المؤقتة بنجاح.");
}

testWarehouseSales().catch(err => {
  console.error("Test error:", err);
  process.exit(1);
});
