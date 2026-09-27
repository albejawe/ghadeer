import { describe, expect, it } from "vitest";
import {
  buildExcelHtml,
  buildPrintTitle,
  buildStatisticsExcelHtml,
  buildSalesHistoryExcelHtml,
  StatisticsExportData,
  SalesHistoryExportData,
} from "./exportUtils";

describe("invoice exports", () => {
  const invoice = {
    company: "شركة &",
    governorate: "بغداد",
    warehouse: "المذخر",
    number: "INV-1",
    createdAt: "2026-08-15",
    dueAt: "2026-09-15",
    amount: 1000,
    paid: 250,
    remaining: 750,
    status: "جزئي",
    note: "ملاحظة",
  };

  it("builds an Excel-compatible RTL HTML workbook and escapes cell values", () => {
    const html = buildExcelHtml([invoice]);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("تقرير الفواتير - نظام غدير المحاسبي");
    expect(html).toContain("شركة &amp;");
    expect(html).toContain("INV-1");
    expect(html).toContain("<table>");
  });

  it("provides a stable Arabic PDF print title", () => {
    expect(buildPrintTitle()).toBe("تقرير الفواتير - نظام غدير المحاسبي");
  });
});

describe("statistics corporate Excel export", () => {
  const sampleStats: StatisticsExportData = {
    periodLabel: "هذا الشهر",
    activeFilters: {
      governorate: "بغداد",
      company: "شركة الأدوية المتحدة",
      representative: "علي أحمد",
      material: "باراسيتامول 500 ملغ",
    },
    kpis: {
      warehouseUnits: 1500,
      warehouseAmount: 3750000,
      repUnits: 1200,
      repAmount: 3000000,
      directUnits: 300,
      salesCount: 45,
    },
    targetRows: [
      {
        governorate: "بغداد",
        targetQuantity: 1000,
        sold: 1200,
        percent: 120,
      },
      {
        governorate: "البصرة",
        targetQuantity: 500,
        sold: 300,
        percent: 60,
      },
    ],
    repRanking: [
      { name: "علي أحمد", quantity: 700, amount: 1750000, percent: 58.3 },
      { name: "محمد حسن", quantity: 500, amount: 1250000, percent: 41.7 },
    ],
    govRanking: [
      { name: "بغداد", quantity: 1200, amount: 3000000, percent: 80 },
      { name: "البصرة", quantity: 300, amount: 750000, percent: 20 },
    ],
    materialRanking: [
      { name: "باراسيتامول 500 ملغ", quantity: 1000, amount: 2500000, percent: 66.7 },
      { name: "أموكسيسيلين", quantity: 500, amount: 1250000, percent: 33.3 },
    ],
    sales: [
      {
        saleDate: "2026-09-10",
        governorate: "بغداد",
        representative: "علي أحمد",
        company: "شركة الأدوية المتحدة",
        material: "باراسيتامول 500 ملغ",
        quantity: 100,
        unitPrice: 2500,
        totalAmount: 250000,
        supervisor: "مشرف بغداد",
      },
    ],
    batches: [
      {
        saleDate: "2026-09-08",
        governorate: "بغداد",
        company: "شركة الأدوية المتحدة",
        material: "باراسيتامول 500 ملغ",
        quantity: 500,
        unitPrice: 2500,
        totalAmount: 1250000,
        createdByName: "أحمد المذخر",
        note: "دفعة مستودع رئيسي",
      },
    ],
  };

  it("generates professional RTL Excel document with XML tags, corporate styling, KPIs, targets, rankings and sales", () => {
    const html = buildStatisticsExcelHtml(sampleStats);

    // Verify XML Excel tags & RTL
    expect(html).toContain('xmlns:x="urn:schemas-microsoft-com:office:excel"');
    expect(html).toContain("<x:DisplayRightToLeft/>");
    expect(html).toContain('dir="rtl"');

    // Verify Brand title & metadata
    expect(html).toContain("نظام غدير المحاسبي - تقرير إحصائيات المبيعات والأداء");
    expect(html).toContain("الفترة الزمنية:");
    expect(html).toContain("هذا الشهر");
    expect(html).toContain("بغداد");
    expect(html).toContain("شركة الأدوية المتحدة");
    expect(html).toContain("علي أحمد");
    expect(html).toContain("باراسيتامول 500 ملغ");

    // Verify KPIs
    expect(html).toContain("1,500 قطعة");
    expect(html).toContain("3,750,000 د.ع");
    expect(html).toContain("1,200 قطعة");
    expect(html).toContain("3,000,000 د.ع");
    expect(html).toContain("300 قطعة");
    expect(html).toContain("45 عملية");

    // Verify Targets
    expect(html).toContain("تحقيق أهداف المحافظات");
    expect(html).toContain("120%");
    expect(html).toContain("مكتمل بنجاح 🎯");
    expect(html).toContain("60%");
    expect(html).toContain("قيد الإنجاز ⏳");

    // Verify Rankings
    expect(html).toContain("تصنيف وأداء المندوبين");
    expect(html).toContain("توزيع وخروج المبيعات حسب المحافظات");
    expect(html).toContain("المواد والمنتجات الأكثر حركة");

    // Verify Detailed Transactions
    expect(html).toContain("السجل التفصيلي لعمليات مبيعات المندوبين");
    expect(html).toContain("السجل التفصيلي لمبيعات وخروج المذاخر");
    expect(html).toContain("دفعة مستودع رئيسي");
  });

  it("handles empty / minimal stats without errors", () => {
    const minimal: StatisticsExportData = {
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
    const html = buildStatisticsExcelHtml(minimal);
    expect(html).toContain("نظام غدير المحاسبي");
    expect(html).toContain("0 قطعة");
    expect(html).not.toContain("تحقيق أهداف المحافظات");
  });
});

describe("sales history corporate Excel export", () => {
  const sampleHistory: SalesHistoryExportData = {
    periodLabel: "2026-09",
    activeFilters: {
      governorate: "بغداد",
      representative: "علي أحمد",
    },
    kpis: {
      warehouseUnits: 100,
      warehouseAmount: 250000,
      repUnits: 80,
      repAmount: 200000,
      directUnits: 20,
      salesCount: 2,
    },
    sales: [
      {
        saleDate: "2026-09-01",
        governorate: "بغداد",
        representative: "علي أحمد",
        company: "شركة الأدوية المتحدة",
        material: "فيتامين سي",
        quantity: 80,
        unitPrice: 2500,
        totalAmount: 200000,
        supervisor: "مشرف 1",
      },
    ],
    batches: [
      {
        saleDate: "2026-09-02",
        governorate: "بغداد",
        company: "شركة الأدوية المتحدة",
        material: "فيتامين سي",
        quantity: 100,
        unitPrice: 2500,
        totalAmount: 250000,
        createdByName: "أمين المستودع",
      },
    ],
    legacy: [
      {
        saleDate: "2026-08-01",
        governorate: "بغداد",
        quantity: 50,
        amount: 100000,
        createdByName: "إدخال يدوي قديم",
      },
    ],
  };

  it("generates rich sales history Excel with sales, warehouse batches, and legacy records", () => {
    const html = buildSalesHistoryExcelHtml(sampleHistory);
    expect(html).toContain("سجل المبيعات وحركات المذاخر");
    expect(html).toContain("مبيعات المندوبين (1 عملية)");
    expect(html).toContain("مبيعات وخروج المذاخر (1 بند)");
    expect(html).toContain("الإدخالات القديمة للمذاخر");
    expect(html).toContain("فيتامين سي");
    expect(html).toContain("إدخال يدوي قديم");
  });
});
