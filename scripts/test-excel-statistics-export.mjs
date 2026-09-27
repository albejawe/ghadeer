import {
  buildStatisticsExcelHtml,
  buildSalesHistoryExcelHtml,
} from "../client/src/lib/exportUtils.js";

async function verifyExcelExports() {
  console.log("==================================================================");
  console.log("🔬 TESTING CORPORATE EXCEL STATISTICS EXPORT & FILTER COMBINATIONS");
  console.log("==================================================================");

  // Test Case 1: Comprehensive Statistics with all filters active
  console.log("\n[Test 1] Testing Excel Export with Full Filters & Target Achievements...");
  const statsFull = {
    periodLabel: "2026-09",
    activeFilters: {
      governorate: "بغداد",
      company: "شركة غدير الدولية",
      representative: "أحمد العبيدي",
      material: "أوجمنتين 1 غرام",
    },
    kpis: {
      warehouseUnits: 5000,
      warehouseAmount: 12500000,
      repUnits: 4200,
      repAmount: 10500000,
      directUnits: 800,
      salesCount: 120,
    },
    targetRows: [
      { governorate: "بغداد", targetQuantity: 4000, sold: 4200, percent: 105 },
      { governorate: "البصرة", targetQuantity: 2000, sold: 1600, percent: 80 },
      { governorate: "النجف", targetQuantity: 1500, sold: 900, percent: 60 },
    ],
    repRanking: [
      { name: "أحمد العبيدي", quantity: 2200, amount: 5500000, percent: 52.4 },
      { name: "علي سامي", quantity: 2000, amount: 5000000, percent: 47.6 },
    ],
    govRanking: [
      { name: "بغداد", quantity: 4200, amount: 10500000, percent: 84 },
      { name: "البصرة", quantity: 800, amount: 2000000, percent: 16 },
    ],
    materialRanking: [
      { name: "أوجمنتين 1 غرام", quantity: 3000, amount: 7500000, percent: 60 },
      { name: "بانادول إكسترا", quantity: 2000, amount: 5000000, percent: 40 },
    ],
    sales: [
      {
        saleDate: "2026-09-15",
        governorate: "بغداد",
        representative: "أحمد العبيدي",
        company: "شركة غدير الدولية",
        material: "أوجمنتين 1 غرام",
        quantity: 150,
        unitPrice: 2500,
        totalAmount: 375000,
        supervisor: "حيدر كاظم",
      },
    ],
    batches: [
      {
        saleDate: "2026-09-14",
        governorate: "بغداد",
        company: "شركة غدير الدولية",
        material: "أوجمنتين 1 غرام",
        quantity: 500,
        unitPrice: 2500,
        totalAmount: 1250000,
        createdByName: "أمين المذخر",
        note: "دفعة صيدليات الكرخ",
      },
    ],
  };

  const htmlFull = buildStatisticsExcelHtml(statsFull);

  // Assertions for Test 1
  if (!htmlFull.includes('xmlns:x="urn:schemas-microsoft-com:office:excel"')) {
    throw new Error("Missing Office Excel XML schema");
  }
  if (!htmlFull.includes("<x:DisplayRightToLeft/>")) {
    throw new Error("Missing RightToLeft worksheet configuration");
  }
  if (!htmlFull.includes("نظام غدير المحاسبي - تقرير إحصائيات المبيعات والأداء")) {
    throw new Error("Missing Corporate Brand Title");
  }
  if (!htmlFull.includes("أحمد العبيدي") || !htmlFull.includes("أوجمنتين 1 غرام")) {
    throw new Error("Missing active filter details in Excel");
  }
  if (!htmlFull.includes("5,000 قطعة") || !htmlFull.includes("12,500,000 د.ع")) {
    throw new Error("Missing KPI formatted numbers");
  }
  if (!htmlFull.includes("مكتمل بنجاح 🎯") || !htmlFull.includes("قريب من الهدف ⚡") || !htmlFull.includes("قيد الإنجاز ⏳")) {
    throw new Error("Missing target achievement status badges");
  }
  if (!htmlFull.includes("دفعة صيدليات الكرخ")) {
    throw new Error("Missing warehouse batch details");
  }
  console.log("✅ [PASS] Test 1: Full filters, KPIs, Targets, Rankings, and Transactions rendered flawlessly.");

  // Test Case 2: Minimal Statistics (All periods, no filters)
  console.log("\n[Test 2] Testing Excel Export with 'كل الفترات' and No Filters...");
  const statsMinimal = {
    periodLabel: "كل الفترات",
    kpis: {
      warehouseUnits: 0,
      warehouseAmount: 0,
      repUnits: 0,
      repAmount: 0,
      directUnits: 0,
      salesCount: 0,
    },
  };
  const htmlMinimal = buildStatisticsExcelHtml(statsMinimal);
  if (!htmlMinimal.includes("كل الفترات") || !htmlMinimal.includes("كل المحافظات")) {
    throw new Error("Missing default fallback labels in minimal export");
  }
  console.log("✅ [PASS] Test 2: Minimal export handled cleanly without crashing or errors.");

  // Test Case 3: Sales History Excel Export
  console.log("\n[Test 3] Testing Sales History Corporate Excel Export...");
  const salesHistory = {
    periodLabel: "هذا الشهر",
    activeFilters: { governorate: "البصرة", representative: "سيف علي" },
    kpis: {
      warehouseUnits: 300,
      warehouseAmount: 900000,
      repUnits: 300,
      repAmount: 900000,
      directUnits: 0,
      salesCount: 5,
    },
    sales: [
      {
        saleDate: "2026-09-20",
        governorate: "البصرة",
        representative: "سيف علي",
        company: "شركة الأدوية",
        material: "فيتامين د",
        quantity: 60,
        unitPrice: 3000,
        totalAmount: 180000,
        supervisor: "مشرف الجنوب",
      },
    ],
    batches: [],
    legacy: [
      {
        saleDate: "2026-09-01",
        governorate: "البصرة",
        quantity: 50,
        amount: 150000,
        createdByName: "سجل قديم",
        note: "حساب يدوي",
      },
    ],
  };
  const htmlHistory = buildSalesHistoryExcelHtml(salesHistory);
  if (!htmlHistory.includes("سجل المبيعات وحركات المذاخر")) {
    throw new Error("Missing sales history title");
  }
  if (!htmlHistory.includes("فيتامين د") || !htmlHistory.includes("حساب يدوي")) {
    throw new Error("Missing sales items or legacy entries in sales history export");
  }
  console.log("✅ [PASS] Test 3: Sales History Excel export generated successfully with legacy support.");

  console.log("\n==================================================================");
  console.log("🎉 ALL EXCEL EXPORT VERIFICATIONS PASSED WITH 100% SUCCESS!");
  console.log("==================================================================");
}

verifyExcelExports().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
