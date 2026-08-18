import { describe, expect, it } from "vitest";
import { applyInvoiceFilters, calculateInvoiceStats, deriveSheetFields, isNewSyncEvent, normalizeSelectOptions, type InvoiceRecord } from "./invoiceLogic";

const today = new Date("2026-08-15T00:00:00.000Z");
const records: InvoiceRecord[] = [
  { id: "a", company: "شركة ألف", governorate: "بغداد", warehouse: "الرازي", number: "100", createdAt: "2026-05-01", dueAt: "2026-06-30", amount: 1000, paid: 0, remaining: 1000, status: "غير مسدد" },
  { id: "b", company: "شركة ألف", governorate: "بغداد", warehouse: "الرازي", number: "101", createdAt: "2026-08-01", dueAt: "2026-09-30", amount: 500, paid: 200, remaining: 300, status: "جزئي" },
  { id: "c", company: "شركة باء", governorate: "البصرة", warehouse: "الشفاء", number: "102", createdAt: "2026-01-01", dueAt: "2026-03-01", amount: 700, paid: 700, remaining: 0, status: "مسدد" },
];

describe("invoice logic", () => {
  it("normalizes blank and duplicate select options safely", () => {
    expect(normalizeSelectOptions([" بغداد ", "", null, "بغداد", undefined, "البصرة"])).toEqual(["البصرة", "بغداد"]);
  });
  it("combines filters and quick overdue filter", () => {
    expect(applyInvoiceFilters(records, { company: "شركة ألف", governorate: "بغداد", quick: "المستحق الآن" }, today).map((i) => i.id)).toEqual(["a"]);
    expect(applyInvoiceFilters(records, { number: "101" }, today).map((i) => i.id)).toEqual(["b"]);
  });

  it("filters by due-date range inclusive of both bounds", () => {
    expect(applyInvoiceFilters(records, { dueFrom: "2026-09-01", dueTo: "2026-09-30" }, today).map((i) => i.id)).toEqual(["b"]);
    expect(applyInvoiceFilters(records, { dueFrom: "2026-06-30", dueTo: "2026-06-30" }, today).map((i) => i.id)).toEqual(["a"]);
    expect(applyInvoiceFilters(records, { dueFrom: "2027-01-01" }, today).map((i) => i.id)).toEqual([]);
  });

  it("filters by amount range", () => {
    expect(applyInvoiceFilters(records, { amountMin: 600, amountMax: 1000 }, today).map((i) => i.id)).toEqual(["a", "c"]);
    expect(applyInvoiceFilters(records, { amountMin: 700 }, today).map((i) => i.id)).toEqual(["a", "c"]);
    expect(applyInvoiceFilters(records, { amountMax: 500 }, today).map((i) => i.id)).toEqual(["b"]);
    expect(applyInvoiceFilters(records, { amountMin: 1, amountMax: 0 }, today)).toEqual([]);
  });

  it("combines date and amount ranges with quick filters", () => {
    expect(
      applyInvoiceFilters(records, { quick: "جزئي", dueFrom: "2026-09-01", amountMax: 500 }, today).map((i) => i.id)
    ).toEqual(["b"]);
  });

  it("calculates filtered financial statistics", () => {
    expect(calculateInvoiceStats(records, today)).toMatchObject({ totalAmount: 2200, totalPaid: 900, totalRemaining: 1300, overdueDebt: 1000, notYetDue: 300, paidCount: 1, partialCount: 1, unpaidCount: 1 });
  });

  it("derives Google Sheets computed fields", () => {
    expect(deriveSheetFields(1000, 250, "2026-08-15")).toMatchObject({ dueAt: "2026-10-14", remaining: 750, status: "جزئي" });
  });

  it("rejects duplicate sync event ids", () => {
    const seen = new Set<string>();
    expect(isNewSyncEvent("evt-1", seen)).toBe(true);
    expect(isNewSyncEvent("evt-1", seen)).toBe(false);
  });
});
