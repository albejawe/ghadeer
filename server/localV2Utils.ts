import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { getRequestUser, type LocalUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

export type V2User = LocalUser & {
  canEnterWarehouse: boolean;
  companyIds: string[];
};

let schemaPromise: Promise<void> | null = null;

export async function ensureV2Schema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const db = getTursoClient();
    const columns = await db.execute("PRAGMA table_info(app_users)");
    if (!columns.rows.some((row) => String(row.name) === "can_enter_warehouse")) {
      await db.execute("ALTER TABLE app_users ADD COLUMN can_enter_warehouse INTEGER NOT NULL DEFAULT 0");
    }
    await db.batch([
      { sql: "CREATE TABLE IF NOT EXISTS representative_companies (representative_id TEXT NOT NULL, company_id TEXT NOT NULL, PRIMARY KEY(representative_id, company_id), FOREIGN KEY(representative_id) REFERENCES representatives(id) ON DELETE CASCADE, FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE)", args: [] },
      { sql: "CREATE INDEX IF NOT EXISTS idx_sales_period_governorate ON sales(sale_date, governorate_id)", args: [] },
      { sql: "CREATE INDEX IF NOT EXISTS idx_sales_material_period ON sales(material_id, sale_date)", args: [] },
      { sql: "CREATE INDEX IF NOT EXISTS idx_sales_representative_period ON sales(representative_id, sale_date)", args: [] },
      { sql: "CREATE INDEX IF NOT EXISTS idx_warehouse_period ON warehouse_monthly_sales(year, month, governorate_id)", args: [] },
      { sql: "CREATE INDEX IF NOT EXISTS idx_targets_period ON monthly_targets(year, month, governorate_id)", args: [] },
    ], "write");
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });
  return schemaPromise;
}

export async function currentUser(req: Request): Promise<V2User | null> {
  await ensureV2Schema();
  const base = await getRequestUser(req);
  if (!base) return null;
  const db = getTursoClient();
  const [permission, companies] = await db.batch([
    { sql: "SELECT can_enter_warehouse AS canEnterWarehouse FROM app_users WHERE id = ?", args: [base.id] },
    { sql: "SELECT company_id AS companyId FROM user_companies WHERE user_id = ? ORDER BY company_id", args: [base.id] },
  ], "read");
  return {
    ...base,
    canEnterWarehouse: base.role === "admin" || Boolean(permission.rows[0]?.canEnterWarehouse),
    companyIds: companies.rows.map((row) => String(row.companyId)),
  };
}

export async function requireUser(req: Request, res: Response) {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return null;
  }
  return user;
}

export async function requireAdmin(req: Request, res: Response) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    return null;
  }
  return user;
}

export function monthRange(yearValue: unknown, monthValue: unknown) {
  const now = new Date();
  const year = Number(yearValue || now.getFullYear());
  const month = Number(monthValue || now.getMonth() + 1);
  if (!Number.isInteger(year) || year < 2020 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return null;
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const to = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { year, month, from, to };
}

export async function audit(actorId: string, action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await getTursoClient().execute({
    sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    args: [randomUUID(), actorId, action, entityType, entityId, JSON.stringify(details), new Date().toISOString()],
  });
}

export function cleanText(value: unknown, max = 160) {
  return String(value || "").trim().slice(0, max);
}

export function validMoney(value: unknown, optional = false) {
  if (optional && (value === "" || value == null)) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : Number.NaN;
}


