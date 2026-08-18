import { randomUUID } from "node:crypto";

export type SheetInvoice = {
  id: string; company: string; governorate: string; warehouse: string; number: string;
  createdAt: string; dueAt: string; amount: number; paid: number; remaining: number;
  status: string; note: string;
};

const headers = ["company", "governorate", "warehouse", "number", "createdAt", "dueAt", "amount", "paid", "remaining", "status", "note", "id"] as const;

function config() {
  const url = process.env.GOOGLE_APPS_SCRIPT_URL;
  const token = process.env.GOOGLE_SYNC_TOKEN;
  if (!url || !token) throw new Error("SYNC_NOT_CONFIGURED");
  return { url, token };
}

export function parseRows(rows: unknown[][]): SheetInvoice[] {
  return rows.slice(1).filter((row) => Array.isArray(row) && row.some((value) => value !== "" && value != null)).map((row) => {
    const item = Object.fromEntries(headers.map((key, index) => [key, row[index] ?? ""])) as Record<string, unknown>;
    const id = String(item.id || "").trim();
    const company = String(item.company || "").trim();
    const number = String(item.number || "").trim();
    if (!id || !company || !number) return null;
    return { id, company, governorate: String(item.governorate || "").trim(), warehouse: String(item.warehouse || "").trim(), number, createdAt: String(item.createdAt || "").trim(), dueAt: String(item.dueAt || "").trim(), amount: Number(item.amount || 0), paid: Number(item.paid || 0), remaining: Number(item.remaining || 0), status: String(item.status || "غير مسدد").trim(), note: String(item.note || "").trim() };
  }).filter((invoice): invoice is SheetInvoice => invoice !== null);
}

export async function pullSheetSnapshot() {
  const { url, token } = config();
  const response = await fetch(`${url}?token=${encodeURIComponent(token)}`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("SYNC_PULL_FAILED");
  const payload = await response.json() as { ok?: boolean; error?: string; rows?: unknown[][]; syncToken?: string };
  if (payload.ok === false) throw new Error(payload.error || "SYNC_PULL_FAILED");
  return { invoices: parseRows(payload.rows || []), syncToken: payload.syncToken || null };
}

async function parseMutationResponse(response: Response, failure: string) {
  if (!response.ok) throw new Error(failure);
  const payload = await response.json() as { ok?: boolean; ignored?: boolean; syncToken?: string };
  if (payload.ok !== true || typeof payload.syncToken !== "string") throw new Error(failure);
  return payload;
}

export async function pushInvoiceToSheet(invoice: SheetInvoice) {
  const { url, token } = config();
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action: "upsert", syncToken: randomUUID(), invoice }) });
  return parseMutationResponse(response, "SYNC_PUSH_FAILED");
}

export async function deleteInvoiceFromSheet(id: string) {
  const { url, token } = config();
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, action: "delete", syncToken: randomUUID(), invoiceId: id }) });
  return parseMutationResponse(response, "SYNC_DELETE_FAILED");
}

export function confirmInvoicePresent(invoices: SheetInvoice[], id: string) {
  const invoice = invoices.find((item) => item.id === id);
  if (!invoice) throw new Error("SYNC_WRITE_NOT_CONFIRMED");
  return invoice;
}

export function confirmInvoiceDeleted(invoices: SheetInvoice[], id: string) {
  if (invoices.some((item) => item.id === id)) throw new Error("SYNC_DELETE_NOT_CONFIRMED");
  return true;
}

export async function runSync() {
  const snapshot = await pullSheetSnapshot();
  const companies = Array.from(new Set(snapshot.invoices.map((item) => item.company).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
  const governorates = Array.from(new Set(snapshot.invoices.map((item) => item.governorate).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
  const warehouses = Array.from(new Set(snapshot.invoices.map((item) => item.warehouse).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
  return { ...snapshot, options: { companies, governorates, warehouses }, syncedAt: new Date().toISOString() };
}
