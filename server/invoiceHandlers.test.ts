import { describe, expect, it, vi } from "vitest";
import { createInvoiceWithSync, deleteInvoiceWithSync, updateInvoiceWithSync, type SyncDeps } from "./invoiceHandlers";
import type { SheetInvoice } from "./sync";

const invoice: SheetInvoice = { id: "inv-1", company: "شركة", governorate: "بغداد", warehouse: "الرازي", number: "100", createdAt: "2026-08-15", dueAt: "", amount: 1000, paid: 0, remaining: 1000, status: "غير مسدد", note: "" };

function deps(invoices: SheetInvoice[]): SyncDeps {
  return { push: vi.fn().mockResolvedValue({ ok: true, syncToken: "write-1" }), remove: vi.fn().mockResolvedValue({ ok: true, syncToken: "delete-1" }), pull: vi.fn().mockResolvedValue({ invoices, syncToken: "snapshot-1", options: {}, syncedAt: new Date().toISOString() }), persist: vi.fn().mockResolvedValue({ count: invoices.length, deleted: 0 }), removeCached: vi.fn().mockResolvedValue(undefined) };
}

describe("invoice CRUD confirmation handlers", () => {
  it("rejects create when the written invoice is absent from the confirmed snapshot", async () => {
    await expect(createInvoiceWithSync(invoice, deps([]))).rejects.toThrow("SYNC_WRITE_NOT_CONFIRMED");
  });

  it("rejects update when the written invoice is absent from the confirmed snapshot", async () => {
    await expect(updateInvoiceWithSync(invoice, deps([]))).rejects.toThrow("SYNC_WRITE_NOT_CONFIRMED");
  });

  it("confirms create from the post-write snapshot and persists it", async () => {
    const dependencies = deps([invoice]);
    await expect(createInvoiceWithSync(invoice, dependencies)).resolves.toEqual(invoice);
    expect(dependencies.push).toHaveBeenCalledWith(invoice);
    expect(dependencies.persist).toHaveBeenCalledWith([invoice], "snapshot-1", "website-create");
  });

  it("confirms update from the post-write snapshot and persists it", async () => {
    const dependencies = deps([invoice]);
    await expect(updateInvoiceWithSync(invoice, dependencies)).resolves.toEqual(invoice);
    expect(dependencies.push).toHaveBeenCalledWith(invoice);
    expect(dependencies.persist).toHaveBeenCalledWith([invoice], "snapshot-1", "website-update");
  });

  it("confirms delete from the post-delete snapshot before removing the cache", async () => {
    const dependencies = deps([]);
    await expect(deleteInvoiceWithSync(invoice.id, dependencies)).resolves.toBe(invoice.id);
    expect(dependencies.remove).toHaveBeenCalledWith(invoice.id);
    expect(dependencies.persist).toHaveBeenCalledWith([], "snapshot-1", "website-delete");
    expect(dependencies.removeCached).toHaveBeenCalledWith(invoice.id);
  });

  it("rejects delete when the invoice remains in the confirmed snapshot", async () => {
    await expect(deleteInvoiceWithSync(invoice.id, deps([invoice]))).rejects.toThrow("SYNC_DELETE_NOT_CONFIRMED");
  });
});
