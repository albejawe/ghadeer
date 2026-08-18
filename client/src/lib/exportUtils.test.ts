import { describe, expect, it } from "vitest";
import { buildExcelHtml, buildPrintTitle } from "./exportUtils";

describe("invoice exports", () => {
  const invoice = { company: "شركة &", governorate: "بغداد", warehouse: "المذخر", number: "INV-1", createdAt: "2026-08-15", dueAt: "2026-09-15", amount: 1000, paid: 250, remaining: 750, status: "جزئي", note: "ملاحظة" };

  it("builds an Excel-compatible RTL HTML workbook and escapes cell values", () => {
    const html = buildExcelHtml([invoice]);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("تقرير الفواتير - حساباتي");
    expect(html).toContain("شركة &amp;");
    expect(html).toContain("INV-1");
    expect(html).toContain("<table>");
  });

  it("provides a stable Arabic PDF print title", () => {
    expect(buildPrintTitle()).toBe("تقرير الفواتير - حساباتي");
  });
});
