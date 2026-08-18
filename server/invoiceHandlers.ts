import { applyFullSnapshot } from "./turso.js";
import { confirmInvoiceDeleted, confirmInvoicePresent, deleteInvoiceFromSheet, pushInvoiceToSheet, runSync, type SheetInvoice } from "./sync.js";
import { deleteInvoice } from "./turso.js";

type SyncDeps = {
  push: typeof pushInvoiceToSheet;
  remove: typeof deleteInvoiceFromSheet;
  pull: typeof runSync;
  persist: typeof applyFullSnapshot;
  removeCached: typeof deleteInvoice;
};

const defaultDeps: SyncDeps = { push: pushInvoiceToSheet, remove: deleteInvoiceFromSheet, pull: runSync, persist: applyFullSnapshot, removeCached: deleteInvoice };

export async function createInvoiceWithSync(invoice: SheetInvoice, deps: SyncDeps = defaultDeps) {
  await deps.push(invoice);
  const synced = await deps.pull();
  await deps.persist(synced.invoices, synced.syncToken || `create-${invoice.id}`, "website-create");
  return confirmInvoicePresent(synced.invoices, invoice.id);
}

export async function updateInvoiceWithSync(invoice: SheetInvoice, deps: SyncDeps = defaultDeps) {
  await deps.push(invoice);
  const synced = await deps.pull();
  await deps.persist(synced.invoices, synced.syncToken || `update-${invoice.id}`, "website-update");
  return confirmInvoicePresent(synced.invoices, invoice.id);
}

export async function deleteInvoiceWithSync(id: string, deps: SyncDeps = defaultDeps) {
  await deps.remove(id);
  const synced = await deps.pull();
  confirmInvoiceDeleted(synced.invoices, id);
  await deps.persist(synced.invoices, synced.syncToken || `delete-${id}`, "website-delete");
  await deps.removeCached(id);
  return id;
}

export type { SyncDeps };
