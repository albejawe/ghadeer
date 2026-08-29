import { describe, expect, it } from "vitest";
import { cleanNumber, normalizeDate } from "./data";
import {
  EMPTY_FILTERS,
  applyFilters,
  computeExecutive,
  computeGovernorates,
} from "./analytics";
import type { DelegatesDataset, SaleRecord } from "./types";

function sale(overrides: Partial<SaleRecord>): SaleRecord {
  return {
    id: "sale",
    representative: "مندوب 1",
    governorate: "الكوت",
    company: "شركة",
    product: "مادة",
    quantity: 10,
    savedUnitPrice: 100,
    totalAmount: 1000,
    date: "2026-08-15",
    monthlyTargetSnapshot: 5000,
    targetContribution: 0.2,
    notes: "",
    sourceSheet: "سجلات الكوت",
    sourceRow: 5,
    issues: [],
    isAnalytical: true,
    ...overrides,
  };
}

const dataset: DelegatesDataset = {
  sales: [
    sale({ id: "a", totalAmount: 1000, quantity: 10, savedUnitPrice: 100 }),
    sale({ id: "b", governorate: "البصرة", representative: "مندوب 2", totalAmount: 3000, quantity: 20, savedUnitPrice: 150 }),
    sale({ id: "c", date: null, totalAmount: 9000, isAnalytical: false, issues: [{ code: "missing-date", label: "تاريخ ناقص", severity: "error" }] }),
  ],
  representatives: [],
  products: [],
  targets: [
    { year: 2026, month: 8, governorate: "الكوت", amount: 5000, notes: "" },
    { year: 2026, month: 8, governorate: "البصرة", amount: 5000, notes: "" },
    { year: 2026, month: 9, governorate: "الكوت", amount: 8000, notes: "" },
  ],
  sheets: [],
  fetchedAt: "2026-08-29T00:00:00.000Z",
  sourceUrl: "source",
};

describe("delegates data normalization", () => {
  it("parses Arabic thousands and decimal separators", () => {
    expect(cleanNumber("90٬369٬858")).toBe(90369858);
    expect(cleanNumber("88٫6%")).toBe(88.6);
    expect(cleanNumber("١٤٬٨٦٦")).toBe(14866);
  });

  it("normalizes Iraqi day/month/year dates", () => {
    expect(normalizeDate("15/08/2026")).toBe("2026-08-15");
  });
});

describe("delegates analytics", () => {
  it("uses saved transaction totals and excludes incomplete rows", () => {
    const filters = { ...EMPTY_FILTERS, period: "2026-8" };
    const filtered = applyFilters(dataset.sales, filters);
    const result = computeExecutive(dataset, filtered, filters);
    expect(result.totalSales).toBe(4000);
    expect(result.totalQuantity).toBe(30);
    expect(result.totalTarget).toBe(10000);
    expect(result.achievement).toBe(40);
    expect(result.remaining).toBe(6000);
  });

  it("matches targets by year, month and governorate", () => {
    const filters = { ...EMPTY_FILTERS, period: "2026-8", governorate: "الكوت" };
    const filtered = applyFilters(dataset.sales, filters);
    const result = computeExecutive(dataset, filtered, filters);
    expect(result.totalSales).toBe(1000);
    expect(result.totalTarget).toBe(5000);
  });

  it("keeps target-only governorates visible with zero sales", () => {
    const filters = { ...EMPTY_FILTERS, period: "2026-9" };
    const filtered = applyFilters(dataset.sales, filters);
    const governorates = computeGovernorates(dataset, filtered, filters);
    expect(governorates).toEqual([
      expect.objectContaining({ governorate: "الكوت", sales: 0, target: 8000, achievement: 0, remaining: 8000 }),
    ]);
  });

  it("supports combined filters from one dataset", () => {
    const filters = { ...EMPTY_FILTERS, period: "2026-8", governorate: "البصرة", representative: "مندوب 2", company: "شركة", product: "مادة" };
    expect(applyFilters(dataset.sales, filters).map((record) => record.id)).toEqual(["b"]);
  });
});
