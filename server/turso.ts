import { createClient, type Client, type InStatement } from "@libsql/client";
import type { SheetInvoice } from "./sync.js";

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

export function getTursoClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) throw new Error("TURSO_NOT_CONFIGURED");
  client = createClient({ url, authToken });
  return client;
}

export async function ensureTursoSchema() {
  if (schemaReady) return schemaReady;
  const db = getTursoClient();
  schemaReady = db.batch([
    { sql: `CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, company TEXT NOT NULL, governorate TEXT NOT NULL DEFAULT '', warehouse TEXT NOT NULL DEFAULT '', invoice_number TEXT NOT NULL, created_at TEXT NOT NULL, due_at TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0, paid REAL NOT NULL DEFAULT 0, remaining REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'غير مسدد', note TEXT NOT NULL DEFAULT '', synced_at TEXT NOT NULL, origin TEXT NOT NULL DEFAULT 'sheet')` },
    { sql: `CREATE TABLE IF NOT EXISTS payment_state (invoice_id TEXT PRIMARY KEY, previous_paid REAL NOT NULL DEFAULT 0, current_paid REAL NOT NULL DEFAULT 0, last_paid_update_at TEXT NOT NULL, FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE)` },
    { sql: `CREATE TABLE IF NOT EXISTS shared_links (id TEXT PRIMARY KEY, name TEXT NOT NULL, filters_json TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)` },
    { sql: `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)` },
    { sql: `CREATE TABLE IF NOT EXISTS sync_metadata (event_id TEXT PRIMARY KEY, source TEXT NOT NULL, origin TEXT NOT NULL, created_at TEXT NOT NULL)` },
  ], "write").then(() => undefined);
  return schemaReady;
}

function invoiceArgs(invoice: SheetInvoice, syncedAt: string) {
  return [invoice.id, invoice.company, invoice.governorate, invoice.warehouse, invoice.number, invoice.createdAt, invoice.dueAt, invoice.amount, invoice.paid, invoice.remaining, invoice.status, invoice.note, syncedAt, "sheet"];
}

export async function upsertInvoice(invoice: SheetInvoice, origin: "sheet" | "website" = "sheet") {
  const db = getTursoClient();
  await ensureTursoSchema();
  const now = new Date().toISOString();
  await db.execute({ sql: `INSERT INTO invoices (id, company, governorate, warehouse, invoice_number, created_at, due_at, amount, paid, remaining, status, note, synced_at, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET company=excluded.company, governorate=excluded.governorate, warehouse=excluded.warehouse, invoice_number=excluded.invoice_number, created_at=excluded.created_at, due_at=excluded.due_at, amount=excluded.amount, paid=excluded.paid, remaining=excluded.remaining, status=excluded.status, note=excluded.note, synced_at=excluded.synced_at, origin=excluded.origin`, args: [...invoiceArgs(invoice, now).slice(0, 13), origin] });
  await db.execute({ sql: `INSERT INTO payment_state (invoice_id, previous_paid, current_paid, last_paid_update_at) VALUES (?, ?, ?, ?) ON CONFLICT(invoice_id) DO UPDATE SET previous_paid=CASE WHEN payment_state.current_paid <> excluded.current_paid THEN payment_state.current_paid ELSE payment_state.previous_paid END, current_paid=excluded.current_paid, last_paid_update_at=excluded.last_paid_update_at`, args: [invoice.id, invoice.paid, invoice.paid, now] });
}

export async function deleteInvoice(id: string) {
  const db = getTursoClient();
  await ensureTursoSchema();
  await db.batch([{ sql: "DELETE FROM payment_state WHERE invoice_id = ?", args: [id] }, { sql: "DELETE FROM invoices WHERE id = ?", args: [id] }], "write");
}

export async function applyFullSnapshot(invoices: SheetInvoice[], eventId: string, source = "google-sheets", fullSnapshot = true) {
  const db = getTursoClient();
  await ensureTursoSchema();
  const existing = await db.execute("SELECT id FROM invoices");
  const incoming = new Set(invoices.map((invoice) => invoice.id).filter(Boolean));
  const statements: InStatement[] = [];
  for (const invoice of invoices) {
    const now = new Date().toISOString();
    statements.push({ sql: `INSERT INTO invoices (id, company, governorate, warehouse, invoice_number, created_at, due_at, amount, paid, remaining, status, note, synced_at, origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET company=excluded.company, governorate=excluded.governorate, warehouse=excluded.warehouse, invoice_number=excluded.invoice_number, created_at=excluded.created_at, due_at=excluded.due_at, amount=excluded.amount, paid=excluded.paid, remaining=excluded.remaining, status=excluded.status, note=excluded.note, synced_at=excluded.synced_at, origin=excluded.origin`, args: [...invoiceArgs(invoice, now).slice(0, 13), "sheet"] });
    statements.push({ sql: `INSERT INTO payment_state (invoice_id, previous_paid, current_paid, last_paid_update_at) VALUES (?, ?, ?, ?) ON CONFLICT(invoice_id) DO UPDATE SET previous_paid=CASE WHEN payment_state.current_paid <> excluded.current_paid THEN payment_state.current_paid ELSE payment_state.previous_paid END, current_paid=excluded.current_paid, last_paid_update_at=excluded.last_paid_update_at`, args: [invoice.id, invoice.paid, invoice.paid, now] });
  }
  if (fullSnapshot) {
    for (const row of existing.rows) {
      const id = String(row.id);
      if (!incoming.has(id)) statements.push({ sql: "DELETE FROM payment_state WHERE invoice_id = ?", args: [id] }, { sql: "DELETE FROM invoices WHERE id = ?", args: [id] });
    }
  }
  statements.push({ sql: "INSERT OR IGNORE INTO sync_metadata (event_id, source, origin, created_at) VALUES (?, ?, ?, ?)", args: [eventId, source, "sheet", new Date().toISOString()] });
  await db.batch(statements, "write");
  return { count: invoices.length, deleted: fullSnapshot ? existing.rows.filter((row) => !incoming.has(String(row.id))).length : 0 };
}

export async function hasSyncEvent(eventId: string) {
  const db = getTursoClient();
  await ensureTursoSchema();
  const result = await db.execute({ sql: "SELECT event_id FROM sync_metadata WHERE event_id = ? LIMIT 1", args: [eventId] });
  return result.rows.length > 0;
}

export async function recordSyncEvent(eventId: string, source: string, origin: string) {
  const db = getTursoClient();
  await ensureTursoSchema();
  await db.execute({ sql: "INSERT OR IGNORE INTO sync_metadata (event_id, source, origin, created_at) VALUES (?, ?, ?, ?)", args: [eventId, source, origin, new Date().toISOString()] });
}

export async function listCachedInvoices() {
  const db = getTursoClient();
  await ensureTursoSchema();
  const result = await db.execute("SELECT id, company, governorate, warehouse, invoice_number AS number, created_at AS createdAt, due_at AS dueAt, amount, paid, remaining, status, note FROM invoices ORDER BY created_at DESC");
  return result.rows;
}

export async function createSharedLink(filters: Record<string, unknown>, name = "رابط تقرير") {
  const db = getTursoClient();
  await ensureTursoSchema();
  const id = crypto.randomUUID();
  await db.execute({ sql: "INSERT INTO shared_links (id, name, filters_json, active, created_at) VALUES (?, ?, ?, 1, ?)", args: [id, name, JSON.stringify(filters), new Date().toISOString()] });
  return { id, name, filters, active: true };
}

export async function listSharedLinks() {
  const db = getTursoClient();
  await ensureTursoSchema();
  const result = await db.execute("SELECT id, name, filters_json AS filtersJson, active, created_at AS createdAt FROM shared_links ORDER BY created_at DESC");
  return result.rows.map((row) => ({ ...row, filters: JSON.parse(String(row.filtersJson || "{}")), active: Boolean(row.active) }));
}

export async function getSharedLink(id: string) {
  const db = getTursoClient();
  await ensureTursoSchema();
  const result = await db.execute({ sql: "SELECT id, name, filters_json AS filtersJson, active, created_at AS createdAt FROM shared_links WHERE id = ? LIMIT 1", args: [id] });
  const row = result.rows[0];
  if (!row || !row.active) return null;
  return { ...row, filters: JSON.parse(String(row.filtersJson || "{}")), active: true };
}

export async function updateSharedLink(id: string, active: boolean) {
  const db = getTursoClient();
  await ensureTursoSchema();
  await db.execute({ sql: "UPDATE shared_links SET active = ? WHERE id = ?", args: [active ? 1 : 0, id] });
}

export async function removeSharedLink(id: string) {
  const db = getTursoClient();
  await ensureTursoSchema();
  await db.execute({ sql: "DELETE FROM shared_links WHERE id = ?", args: [id] });
}
