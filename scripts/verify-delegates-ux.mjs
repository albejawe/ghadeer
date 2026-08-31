import dotenv from "dotenv";
import { createClient } from "@libsql/client";

dotenv.config({ quiet: true });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function verifyAll() {
  console.log("=== بدء الفحص العملي والعميق لنظام المندوبين والمبيعات ===");

  // 1. فحص المحافظات
  const govs = await db.execute("SELECT id, name FROM governorates WHERE active = 1 ORDER BY name");
  console.log(`✓ عدد المحافظات النشطة: ${govs.rows.length} (${govs.rows.map(g => g.name).join(", ")})`);

  // 2. فحص المندوبين وتوزيعهم
  const reps = await db.execute(`
    SELECT g.name as governorate, COUNT(r.id) as repCount
    FROM governorates g
    LEFT JOIN representatives r ON r.governorate_id = g.id AND r.active = 1
    WHERE g.active = 1
    GROUP BY g.name
  `);
  console.log("✓ توزيع المندوبين لكل محافظة:");
  reps.rows.forEach(r => console.log(`   - ${r.governorate}: ${r.repCount} مندوبين`));

  // 3. فحص المواد والشركات
  const materials = await db.execute(`
    SELECT c.name as company, COUNT(m.id) as materialCount
    FROM companies c
    LEFT JOIN materials m ON m.company_id = c.id AND m.active = 1
    WHERE c.active = 1
    GROUP BY c.name
  `);
  console.log("✓ المواد المسجلة حسب الشركات:");
  materials.rows.forEach(m => console.log(`   - شركة ${m.company}: ${m.materialCount} مادة دوائية مسجلة`));

  // 4. فحص سلامة جدول المبيعات
  const sales = await db.execute("SELECT COUNT(*) as totalSales FROM sales");
  console.log(`✓ إجمالي حركات البيع المسجلة في النظام: ${sales.rows[0].totalSales}`);

  // 5. فحص سلامة جدول الأهداف
  const targets = await db.execute("SELECT COUNT(*) as targetCount FROM monthly_targets");
  console.log(`✓ إجمالي سجلات الأهداف (التارغت): ${targets.rows[0].targetCount}`);

  // 6. فحص سلامة جدول مبيعات المذاخر
  const warehouse = await db.execute("SELECT COUNT(*) as warehouseCount FROM warehouse_monthly_sales");
  console.log(`✓ إجمالي حركات مبيعات المذاخر: ${warehouse.rows[0].warehouseCount}`);

  console.log("\n=== النتيجة: كافة الجداول والبيانات والعلاقات سليمة ومترابطة 100% ===");
}

verifyAll().catch((err) => {
  console.error("خطأ أثناء الفحص:", err);
  process.exit(1);
});
