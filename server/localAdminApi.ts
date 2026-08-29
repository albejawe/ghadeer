import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

async function signedIn(req: Request, res: Response, adminOnly = false) {
  const user = await getRequestUser(req);
  if (!user) { res.status(401).json({ ok: false, error: "UNAUTHORIZED" }); return null; }
  if (adminOnly && user.role !== "admin") { res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" }); return null; }
  return user;
}

router.get("/warehouse-sales", async (req, res) => {
  try {
    const user = await signedIn(req, res); if (!user) return;
    const year = Number(req.query.year); const month = Number(req.query.month); const where = ["1 = 1"]; const args: Array<string | number> = [];
    if (Number.isInteger(year)) { where.push("w.year = ?"); args.push(year); }
    if (Number.isInteger(month)) { where.push("w.month = ?"); args.push(month); }
    if (user.role !== "admin") { where.push("w.governorate_id = ?"); args.push(user.governorateId || ""); }
    const result = await getTursoClient().execute({ sql: `SELECT w.id, w.governorate_id AS governorateId, g.name AS governorate, w.year, w.month, w.quantity, w.amount, w.created_by AS createdBy, u.display_name AS createdByName, w.created_at AS createdAt, w.updated_at AS updatedAt FROM warehouse_monthly_sales w JOIN governorates g ON g.id = w.governorate_id JOIN app_users u ON u.id = w.created_by WHERE ${where.join(" AND ")} ORDER BY w.year DESC, w.month DESC, g.name`, args });
    return res.json({ ok: true, sales: result.rows });
  } catch { return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" }); }
});

router.put("/warehouse-sales", async (req, res) => {
  try {
    const user = await signedIn(req, res); if (!user) return;
    const body = req.body || {}; const governorateId = user.role === "admin" ? String(body.governorateId || "") : user.governorateId;
    const year = Number(body.year); const month = Number(body.month); const quantity = Number(body.quantity); const amount = body.amount === "" || body.amount == null ? null : Number(body.amount);
    if (!governorateId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(quantity) || quantity < 0 || (amount !== null && (!Number.isFinite(amount) || amount < 0))) return res.status(400).json({ ok: false, error: "INVALID_WAREHOUSE_SALE" });
    const now = new Date().toISOString(); await getTursoClient().execute({ sql: "INSERT INTO warehouse_monthly_sales (id, governorate_id, year, month, quantity, amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(governorate_id, year, month) DO UPDATE SET quantity=excluded.quantity, amount=excluded.amount, created_by=excluded.created_by, updated_at=excluded.updated_at", args: [randomUUID(), governorateId, year, month, quantity, amount, user.id, now, now] });
    return res.json({ ok: true });
  } catch { return res.status(400).json({ ok: false, error: "WAREHOUSE_SALE_SAVE_FAILED" }); }
});

router.get("/targets", async (req, res) => {
  try {
    const user = await signedIn(req, res); if (!user) return;
    const year = Number(req.query.year); const month = Number(req.query.month); const where = ["1 = 1"]; const args: Array<string | number> = [];
    if (Number.isInteger(year)) { where.push("t.year = ?"); args.push(year); }
    if (Number.isInteger(month)) { where.push("t.month = ?"); args.push(month); }
    if (user.role !== "admin") { where.push("t.governorate_id = ?"); args.push(user.governorateId || ""); }
    const result = await getTursoClient().execute({ sql: `SELECT t.id, t.governorate_id AS governorateId, g.name AS governorate, t.year, t.month, t.target_quantity AS targetQuantity, t.target_amount AS targetAmount, t.created_by AS createdBy, u.display_name AS createdByName, t.updated_at AS updatedAt FROM monthly_targets t JOIN governorates g ON g.id = t.governorate_id JOIN app_users u ON u.id = t.created_by WHERE ${where.join(" AND ")} ORDER BY t.year DESC, t.month DESC, g.name`, args });
    return res.json({ ok: true, targets: result.rows });
  } catch { return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" }); }
});

router.put("/targets", async (req, res) => {
  try {
    const user = await signedIn(req, res, true); if (!user) return;
    const body = req.body || {}; const governorateId = String(body.governorateId || ""); const year = Number(body.year); const month = Number(body.month); const targetQuantity = Number(body.targetQuantity); const targetAmount = body.targetAmount === "" || body.targetAmount == null ? null : Number(body.targetAmount);
    if (!governorateId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(targetQuantity) || targetQuantity < 0 || (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount < 0))) return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
    const now = new Date().toISOString(); await getTursoClient().execute({ sql: "INSERT INTO monthly_targets (id, governorate_id, year, month, target_quantity, target_amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(governorate_id, year, month) DO UPDATE SET target_quantity=excluded.target_quantity, target_amount=excluded.target_amount, created_by=excluded.created_by, updated_at=excluded.updated_at", args: [randomUUID(), governorateId, year, month, targetQuantity, targetAmount, user.id, now, now] });
    return res.json({ ok: true });
  } catch { return res.status(400).json({ ok: false, error: "TARGET_SAVE_FAILED" }); }
});

router.post("/representatives", async (req, res) => {
  try {
    const user = await signedIn(req, res, true); if (!user) return;
    const name = String(req.body?.name || "").trim(); const governorateId = String(req.body?.governorateId || ""); if (!name || !governorateId) return res.status(400).json({ ok: false, error: "INVALID_REPRESENTATIVE" });
    const id = randomUUID(); const now = new Date().toISOString(); await getTursoClient().execute({ sql: "INSERT INTO representatives (id, name, governorate_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)", args: [id, name, governorateId, now, now] }); return res.status(201).json({ ok: true, id });
  } catch { return res.status(400).json({ ok: false, error: "REPRESENTATIVE_CREATE_FAILED" }); }
});

export function registerLocalAdminApi(app: { use: (path: string, handler: typeof router) => void }) {
  app.use("/api/local", router);
}
