import { describe, expect, it } from "vitest";
import { parseRows, runSync } from "./sync";

describe("sheet synchronization contract", () => {
  it("rejects rows without a stable ID or with a short malformed shape", () => {
    const rows = parseRows([["headers"], ["شركة", "بغداد", "مذخر", "INV-0", "2026-08-15", "", "100", "0", "100", "غير مسدد", ""], ["شركة", "بغداد", "مذخر", "INV-1", "2026-08-15", "", "100", "0", "100", "غير مسدد", "", ""]]);
    expect(rows).toEqual([]);
  });

  it("rejects malformed rows without required business fields", () => {
    const rows = parseRows([["headers"], ["", "بغداد", "مذخر", "", "2026-08-15", "", "100", "0", "100", "غير مسدد", "", "bad-row"], ["شركة صحيحة", "بغداد", "مذخر", "INV-1", "2026-08-15", "", "100", "0", "100", "غير مسدد", "", "good-row"]]);
    expect(rows.map((row) => row.id)).toEqual(["good-row"]);
  });

  it("ignores blank rows while preserving valid rows with empty optional fields", () => {
    const rows = parseRows([["الشركة", "المحافظة", "المذخر", "رقم الفاتورة", "تاريخ الإنشاء", "تاريخ الاستحقاق", "المبلغ", "المدفوع", "المتبقي", "الحالة", "الملاحظة", "ID"], ["شركة صحيحة", "", "", "INV-2", "2026-08-15", "", "100", "0", "100", "غير مسدد", "", "stable-id"], ["", "", "", "", "", "", "", "", "", "", ""]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "stable-id", amount: 100, paid: 0, remaining: 100 });
  });
  it("fails closed when the Apps Script endpoint is not configured", async () => {
    const previousUrl = process.env.GOOGLE_APPS_SCRIPT_URL;
    const previousToken = process.env.GOOGLE_SYNC_TOKEN;
    delete process.env.GOOGLE_APPS_SCRIPT_URL;
    delete process.env.GOOGLE_SYNC_TOKEN;
    await expect(runSync()).rejects.toThrow("SYNC_NOT_CONFIGURED");
    if (previousUrl) process.env.GOOGLE_APPS_SCRIPT_URL = previousUrl;
    if (previousToken) process.env.GOOGLE_SYNC_TOKEN = previousToken;
  });
});
