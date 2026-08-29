import { randomUUID } from "node:crypto";
import { Router } from "express";
import { getTursoClient } from "./turso.js";
import {
  audit,
  cleanText,
  monthRange,
  requireAdmin,
  requireUser,
  validMoney,
} from "./localV2Utils.js";

const router = Router();

async function validateSaleReferences(input: Record<string, unknown>, user: Awaited<ReturnType<typeof requireUser>>) {
  if (!user) return null;
  const governorateId = user.role === "admin" ? cleanText(input.governorateId, 80) : user.governorateId || "";
  const representativeId = cleanText(input.representativeId, 80);
  const companyId = cleanText(input.companyId, 80);
  const materialId = cleanText(input.materialId, 80);
  const db = getTursoClient();
  const [representative, material, representativeCompany, userCompany] = await db.batch([
    { sql: "SELECT governorate_id AS governorateId FROM representatives WHERE id = ? AND active = 1", args: [representativeId] },
    { sql: "SELECT company_id AS companyId, unit_price AS unitPrice FROM materials WHERE id = ? AND active = 1", args: [materialId] },
    { sql: "SELECT 1 AS allowed FROM representative_companies WHERE representative_id = ? AND company_id = ?", args: [representativeId, companyId] },
    { sql: "SELECT 1 AS allowed FROM user_companies WHERE user_id = ? AND company_id = ?", args: [user.id, companyId] },
  ], "read");
  const repRow = representative.rows[0];
  const materialRow = material.rows[0];
  if (!governorateId || !repRow || String(repRow.governorateId) !== governorateId || !materialRow || String(materialRow.companyId) !== companyId || !representativeCompany.rows.length || (user.role !== "admin" && !userCompany.rows.length)) return null;
  return { governorateId, representativeId, companyId, materialId, unitPrice: Number(materialRow.unitPrice || 0) };
}

router.get("/sales", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const period = monthRange(req.query.year, req.query.month);
    if (!period) return res.status(400).json({ ok: false, error: "INVALID_PERIOD" });
    const where = ["s.sale_date >= ?", "s.sale_date < ?"];
    const args: Array<string | number> = [period.from, period.to];
    if (user.role !== "admin") {
      where.push("s.supervisor_id = ?");
      args.push(user.id);
    }
    const governorateId = cleanText(req.query.governorateId, 80);
    if (governorateId && user.role === "admin") {
      where.push("s.governorate_id = ?");
      args.push(governorateId);
    }
    const result = await getTursoClient().execute({
      sql: `SELECT s.id, s.sale_date AS saleDate, s.quantity, s.unit_price AS unitPrice, s.total_amount AS totalAmount, s.note, s.created_at AS createdAt, s.supervisor_id AS supervisorId, u.display_name AS supervisor, s.representative_id AS representativeId, r.name AS representative, s.governorate_id AS governorateId, g.name AS governorate, s.company_id AS companyId, c.name AS company, s.material_id AS materialId, m.name AS material FROM sales s JOIN app_users u ON u.id = s.supervisor_id JOIN representatives r ON r.id = s.representative_id JOIN governorates g ON g.id = s.governorate_id JOIN companies c ON c.id = s.company_id JOIN materials m ON m.id = s.material_id WHERE ${where.join(" AND ")} ORDER BY s.sale_date DESC, s.created_at DESC LIMIT 500`,
      args,
    });
    return res.json({ ok: true, period, sales: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/sales", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const input = req.body || {};
    const refs = await validateSaleReferences(input, user);
    const quantity = Number(input.quantity);
    const saleDate = cleanText(input.saleDate, 10);
    if (!refs || !Number.isInteger(quantity) || quantity <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return res.status(400).json({ ok: false, error: "INVALID_SALE" });
    const id = randomUUID();
    const now = new Date().toISOString();
    const totalAmount = refs.unitPrice * quantity;
    await getTursoClient().execute({
      sql: "INSERT INTO sales (id, supervisor_id, representative_id, governorate_id, company_id, material_id, quantity, unit_price, total_amount, sale_date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [id, user.id, refs.representativeId, refs.governorateId, refs.companyId, refs.materialId, quantity, refs.unitPrice, totalAmount, saleDate, cleanText(input.note, 300), now, now],
    });
    await audit(user.id, "create", "sale", id, { quantity, totalAmount });
    return res.status(201).json({ ok: true, id, totalAmount, unitPrice: refs.unitPrice });
  } catch {
    return res.status(400).json({ ok: false, error: "SALE_CREATE_FAILED" });
  }
});

router.patch("/sales/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = cleanText(req.params.id, 80);
    const existing = await getTursoClient().execute({ sql: "SELECT supervisor_id AS supervisorId FROM sales WHERE id = ?", args: [id] });
    if (!existing.rows[0]) return res.status(404).json({ ok: false, error: "SALE_NOT_FOUND" });
    if (user.role !== "admin" && String(existing.rows[0].supervisorId) !== user.id) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const input = req.body || {};
    const refs = await validateSaleReferences(input, user);
    const quantity = Number(input.quantity);
    const saleDate = cleanText(input.saleDate, 10);
    if (!refs || !Number.isInteger(quantity) || quantity <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate)) return res.status(400).json({ ok: false, error: "INVALID_SALE" });
    const totalAmount = refs.unitPrice * quantity;
    await getTursoClient().execute({ sql: "UPDATE sales SET representative_id = ?, governorate_id = ?, company_id = ?, material_id = ?, quantity = ?, unit_price = ?, total_amount = ?, sale_date = ?, note = ?, updated_at = ? WHERE id = ?", args: [refs.representativeId, refs.governorateId, refs.companyId, refs.materialId, quantity, refs.unitPrice, totalAmount, saleDate, cleanText(input.note, 300), new Date().toISOString(), id] });
    await audit(user.id, "update", "sale", id, { quantity, totalAmount });
    return res.json({ ok: true, totalAmount, unitPrice: refs.unitPrice });
  } catch {
    return res.status(400).json({ ok: false, error: "SALE_UPDATE_FAILED" });
  }
});

router.delete("/sales/:id", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const id = cleanText(req.params.id, 80);
    const existing = await getTursoClient().execute({ sql: "SELECT supervisor_id AS supervisorId FROM sales WHERE id = ?", args: [id] });
    if (!existing.rows[0]) return res.status(404).json({ ok: false, error: "SALE_NOT_FOUND" });
    if (user.role !== "admin" && String(existing.rows[0].supervisorId) !== user.id) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    await getTursoClient().execute({ sql: "DELETE FROM sales WHERE id = ?", args: [id] });
    await audit(user.id, "delete", "sale", id);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "SALE_DELETE_FAILED" });
  }
});

router.get("/warehouse", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const period = monthRange(req.query.year, req.query.month);
    if (!period) return res.status(400).json({ ok: false, error: "INVALID_PERIOD" });
    const where = ["w.year = ?", "w.month = ?"];
    const args: Array<string | number> = [period.year, period.month];
    if (user.role !== "admin") {
      where.push("w.governorate_id = ?");
      args.push(user.governorateId || "");
    }
    const result = await getTursoClient().execute({ sql: `SELECT w.id, w.governorate_id AS governorateId, g.name AS governorate, w.year, w.month, w.quantity, w.amount, w.created_by AS createdBy, u.display_name AS createdByName, w.updated_at AS updatedAt FROM warehouse_monthly_sales w JOIN governorates g ON g.id = w.governorate_id JOIN app_users u ON u.id = w.created_by WHERE ${where.join(" AND ")} ORDER BY g.name`, args });
    return res.json({ ok: true, period, records: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.put("/warehouse", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    if (user.role !== "admin" && !user.canEnterWarehouse) return res.status(403).json({ ok: false, error: "WAREHOUSE_PERMISSION_REQUIRED" });
    const period = monthRange(req.body?.year, req.body?.month);
    const governorateId = user.role === "admin" ? cleanText(req.body?.governorateId, 80) : user.governorateId || "";
    const quantity = Number(req.body?.quantity);
    const amount = validMoney(req.body?.amount, true);
    if (!period || !governorateId || !Number.isInteger(quantity) || quantity < 0 || (amount !== null && !Number.isFinite(amount))) return res.status(400).json({ ok: false, error: "INVALID_WAREHOUSE_SALE" });
    const id = randomUUID();
    const now = new Date().toISOString();
    await getTursoClient().execute({ sql: "INSERT INTO warehouse_monthly_sales (id, governorate_id, year, month, quantity, amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(governorate_id, year, month) DO UPDATE SET quantity = excluded.quantity, amount = excluded.amount, created_by = excluded.created_by, updated_at = excluded.updated_at", args: [id, governorateId, period.year, period.month, quantity, amount, user.id, now, now] });
    await audit(user.id, "upsert", "warehouse_sale", `${governorateId}:${period.year}-${period.month}`, { quantity, amount });
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "WAREHOUSE_SAVE_FAILED" });
  }
});

router.get("/targets", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const period = monthRange(req.query.year, req.query.month);
    if (!period) return res.status(400).json({ ok: false, error: "INVALID_PERIOD" });
    const where = ["t.year = ?", "t.month = ?"];
    const args: Array<string | number> = [period.year, period.month];
    if (user.role !== "admin") {
      where.push("t.governorate_id = ?");
      args.push(user.governorateId || "");
    }
    const result = await getTursoClient().execute({ sql: `SELECT t.id, t.governorate_id AS governorateId, g.name AS governorate, t.year, t.month, t.target_quantity AS targetQuantity, t.target_amount AS targetAmount, t.created_by AS createdBy, u.display_name AS createdByName, t.updated_at AS updatedAt FROM monthly_targets t JOIN governorates g ON g.id = t.governorate_id JOIN app_users u ON u.id = t.created_by WHERE ${where.join(" AND ")} ORDER BY g.name`, args });
    return res.json({ ok: true, period, targets: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.put("/targets", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const period = monthRange(req.body?.year, req.body?.month);
    const rows = Array.isArray(req.body?.targets) ? req.body.targets : [];
    if (!period || !rows.length) return res.status(400).json({ ok: false, error: "INVALID_TARGETS" });
    const now = new Date().toISOString();
    const statements = rows.map((row: Record<string, unknown>) => {
      const governorateId = cleanText(row.governorateId, 80);
      const targetQuantity = Number(row.targetQuantity);
      const targetAmount = validMoney(row.targetAmount, true);
      if (!governorateId || !Number.isInteger(targetQuantity) || targetQuantity < 0 || (targetAmount !== null && !Number.isFinite(targetAmount))) throw new Error("INVALID_TARGET");
      return { sql: "INSERT INTO monthly_targets (id, governorate_id, year, month, target_quantity, target_amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(governorate_id, year, month) DO UPDATE SET target_quantity = excluded.target_quantity, target_amount = excluded.target_amount, created_by = excluded.created_by, updated_at = excluded.updated_at", args: [randomUUID(), governorateId, period.year, period.month, targetQuantity, targetAmount, admin.id, now, now] };
    });
    await getTursoClient().batch(statements, "write");
    await audit(admin.id, "bulk_upsert", "monthly_targets", `${period.year}-${period.month}`, { count: statements.length });
    return res.json({ ok: true, saved: statements.length });
  } catch {
    return res.status(400).json({ ok: false, error: "TARGETS_SAVE_FAILED" });
  }
});

router.get("/dashboard", async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const period = monthRange(req.query.year, req.query.month);
    if (!period) return res.status(400).json({ ok: false, error: "INVALID_PERIOD" });
    const scope = user.role === "admin" ? "" : " AND s.governorate_id = ?";
    const salesArgs = user.role === "admin" ? [period.from, period.to] : [period.from, period.to, user.governorateId || ""];
    const govScope = user.role === "admin" ? "" : " WHERE g.id = ?";
    const govArgs = user.role === "admin" ? [] : [user.governorateId || ""];
    const db = getTursoClient();
    const [governorates, salesByGov, warehouseByGov, targetsByGov, materials, representatives, companies, trend, recent] = await db.batch([
      { sql: `SELECT g.id, g.name FROM governorates g${govScope} ORDER BY g.name`, args: govArgs },
      { sql: `SELECT s.governorate_id AS governorateId, SUM(s.quantity) AS quantity, SUM(s.total_amount) AS amount, COUNT(*) AS operations FROM sales s WHERE s.sale_date >= ? AND s.sale_date < ?${scope} GROUP BY s.governorate_id`, args: salesArgs },
      { sql: `SELECT w.governorate_id AS governorateId, w.quantity, w.amount FROM warehouse_monthly_sales w WHERE w.year = ? AND w.month = ?${user.role === "admin" ? "" : " AND w.governorate_id = ?"}`, args: user.role === "admin" ? [period.year, period.month] : [period.year, period.month, user.governorateId || ""] },
      { sql: `SELECT t.governorate_id AS governorateId, t.target_quantity AS targetQuantity, t.target_amount AS targetAmount FROM monthly_targets t WHERE t.year = ? AND t.month = ?${user.role === "admin" ? "" : " AND t.governorate_id = ?"}`, args: user.role === "admin" ? [period.year, period.month] : [period.year, period.month, user.governorateId || ""] },
      { sql: `SELECT m.id, m.name, c.name AS company, SUM(s.quantity) AS quantity, SUM(s.total_amount) AS amount FROM sales s JOIN materials m ON m.id = s.material_id JOIN companies c ON c.id = s.company_id WHERE s.sale_date >= ? AND s.sale_date < ?${scope} GROUP BY m.id, m.name, c.name ORDER BY quantity DESC LIMIT 7`, args: salesArgs },
      { sql: `SELECT r.id, r.name, g.name AS governorate, SUM(s.quantity) AS quantity, SUM(s.total_amount) AS amount FROM sales s JOIN representatives r ON r.id = s.representative_id JOIN governorates g ON g.id = s.governorate_id WHERE s.sale_date >= ? AND s.sale_date < ?${scope} GROUP BY r.id, r.name, g.name ORDER BY quantity DESC LIMIT 7`, args: salesArgs },
      { sql: `SELECT c.id, c.name, SUM(s.quantity) AS quantity, SUM(s.total_amount) AS amount FROM sales s JOIN companies c ON c.id = s.company_id WHERE s.sale_date >= ? AND s.sale_date < ?${scope} GROUP BY c.id, c.name ORDER BY quantity DESC`, args: salesArgs },
      { sql: `SELECT s.sale_date AS date, SUM(s.quantity) AS quantity FROM sales s WHERE s.sale_date >= ? AND s.sale_date < ?${scope} GROUP BY s.sale_date ORDER BY s.sale_date`, args: salesArgs },
      { sql: `SELECT s.id, s.sale_date AS saleDate, s.quantity, s.total_amount AS totalAmount, r.name AS representative, m.name AS material, g.name AS governorate, u.display_name AS supervisor FROM sales s JOIN representatives r ON r.id = s.representative_id JOIN materials m ON m.id = s.material_id JOIN governorates g ON g.id = s.governorate_id JOIN app_users u ON u.id = s.supervisor_id WHERE s.sale_date >= ? AND s.sale_date < ?${scope} ORDER BY s.created_at DESC LIMIT 6`, args: salesArgs },
    ], "read");
    const governorateRows = governorates.rows.map((gov) => {
      const sales = salesByGov.rows.find((row) => String(row.governorateId) === String(gov.id));
      const warehouse = warehouseByGov.rows.find((row) => String(row.governorateId) === String(gov.id));
      const target = targetsByGov.rows.find((row) => String(row.governorateId) === String(gov.id));
      const representativeQuantity = Number(sales?.quantity || 0);
      const warehouseQuantity = Number(warehouse?.quantity || 0);
      const targetQuantity = Number(target?.targetQuantity || 0);
      return {
        id: String(gov.id), name: String(gov.name), warehouseQuantity, representativeQuantity,
        directQuantity: Math.max(0, warehouseQuantity - representativeQuantity),
        representativeAmount: Number(sales?.amount || 0), warehouseAmount: warehouse?.amount == null ? null : Number(warehouse.amount),
        targetQuantity, targetAmount: target?.targetAmount == null ? null : Number(target.targetAmount),
        achievement: targetQuantity > 0 ? Math.round((warehouseQuantity / targetQuantity) * 1000) / 10 : 0,
        representativeShare: warehouseQuantity > 0 ? Math.round((representativeQuantity / warehouseQuantity) * 1000) / 10 : 0,
        operations: Number(sales?.operations || 0),
      };
    });
    const summary = governorateRows.reduce((acc, row) => ({
      warehouseQuantity: acc.warehouseQuantity + row.warehouseQuantity,
      representativeQuantity: acc.representativeQuantity + row.representativeQuantity,
      directQuantity: acc.directQuantity + row.directQuantity,
      representativeAmount: acc.representativeAmount + row.representativeAmount,
      targetQuantity: acc.targetQuantity + row.targetQuantity,
      operations: acc.operations + row.operations,
    }), { warehouseQuantity: 0, representativeQuantity: 0, directQuantity: 0, representativeAmount: 0, targetQuantity: 0, operations: 0 });
    return res.json({ ok: true, period, summary: { ...summary, achievement: summary.targetQuantity > 0 ? Math.round((summary.warehouseQuantity / summary.targetQuantity) * 1000) / 10 : 0 }, governorates: governorateRows, topMaterials: materials.rows, topRepresentatives: representatives.rows, companies: companies.rows, trend: trend.rows, recent: recent.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

export function registerLocalV2OperationsApi(app: { use: (path: string, handler: typeof router) => void }) {
  app.use("/api/local/v2", router);
}

