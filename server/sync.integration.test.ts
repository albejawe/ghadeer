import { afterEach, describe, expect, it, vi } from "vitest";
import { confirmInvoiceDeleted, confirmInvoicePresent, deleteInvoiceFromSheet, pullSheetSnapshot, pushInvoiceToSheet } from "./sync";

const invoice = { id: "inv-1", company: "شركة", governorate: "بغداد", warehouse: "الرازي", number: "100", createdAt: "2026-08-15", dueAt: "2026-10-14", amount: 1000, paid: 200, remaining: 800, status: "جزئي", note: "" };

afterEach(() => { vi.unstubAllGlobals(); delete process.env.GOOGLE_APPS_SCRIPT_URL; delete process.env.GOOGLE_SYNC_TOKEN; });

describe("Google Apps Script HTTP contract", () => {
  it("sends upsert with token, action, invoice, and operation id", async () => {
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.example.test/exec";
    process.env.GOOGLE_SYNC_TOKEN = "secret";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, syncToken: "evt-ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await pushInvoiceToSheet(invoice);
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://script.example.test/exec");
    expect(init.method).toBe("POST");
    expect(body).toMatchObject({ token: "secret", action: "upsert", invoice });
    expect(body.syncToken).toEqual(expect.any(String));
  });

  it("rejects an Apps Script ok:false response", async () => {
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.example.test/exec";
    process.env.GOOGLE_SYNC_TOKEN = "secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 200 })));
    await expect(pushInvoiceToSheet(invoice)).rejects.toThrow("SYNC_PUSH_FAILED");
  });

  it("sends delete by stable invoice id", async () => {
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.example.test/exec";
    process.env.GOOGLE_SYNC_TOKEN = "secret";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, syncToken: "evt-ok" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await deleteInvoiceFromSheet("inv-1");
    const body = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
    expect(body).toMatchObject({ token: "secret", action: "delete", invoiceId: "inv-1" });
  });

  it("rejects unconfirmed CRUD results", () => {
    expect(() => confirmInvoicePresent([], "missing")).toThrow("SYNC_WRITE_NOT_CONFIRMED");
    expect(() => confirmInvoiceDeleted([invoice], invoice.id)).toThrow("SYNC_DELETE_NOT_CONFIRMED");
    expect(confirmInvoiceDeleted([], invoice.id)).toBe(true);
  });

  it("parses full sheet snapshots", async () => {
    process.env.GOOGLE_APPS_SCRIPT_URL = "https://script.example.test/exec";
    process.env.GOOGLE_SYNC_TOKEN = "secret";
    const rows = [
      ["company", "governorate", "warehouse", "number", "createdAt", "dueAt", "amount", "paid", "remaining", "status", "note", "id"],
      ["شركة", "بغداد", "الرازي", "100", "2026-08-15", "2026-10-14", 1000, 200, 800, "جزئي", "", "inv-1"],
    ];
    const payload = { rows, syncToken: "evt-1" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 })));
    const result = await pullSheetSnapshot();
    expect(result).toMatchObject({ syncToken: "evt-1" });
    expect(result.invoices[0]).toMatchObject({ id: "inv-1", amount: 1000, remaining: 800, status: "جزئي" });
  });
});
