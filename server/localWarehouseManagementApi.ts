import { randomUUID } from "node:crypto";
import { Router, type Application } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

export function registerLocalWarehouseManagementApi(app: Application) {
  router.patch("/warehouse-sales/:id", async (req, res) => {
    const user = await getRequestUser(req);
    if (!user || user.role !== "admin") return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const id = String(req.params.id || "");
    const saleDate = String(req.body?.saleDate || "").trim();
    const quantity = Number(req.body?.quantity);
    const amount = req.body?.amount === "" || req.body?.amount == null ? null : Number(req.body.amount);
    const note = String(req.body?.note || "");
    if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(Date.parse(saleDate)) || !Number.isInteger(quantity) || quantity <= 0 || (amount !== null && (!Number.isFinite(amount) || amount < 0))) return res.status(400).json({ ok: false, error: "INVALID_WAREHOUSE_SALE" });
    try {
      const current = await getTursoClient().execute({ sql: "SELECT id FROM warehouse_monthly_sales WHERE id = ? LIMIT 1", args: [id] });
      if (!current.rows.length) return res.status(404).json({ ok: false, error: "WAREHOUSE_SALE_NOT_FOUND" });
      const [year, month] = saleDate.split("-").map(Number);
      const now = new Date().toISOString();
      await getTursoClient().batch([
        { sql: "UPDATE warehouse_monthly_sales SET sale_date = ?, year = ?, month = ?, quantity = ?, amount = ?, note = ?, updated_at = ? WHERE id = ?", args: [saleDate, year, month, quantity, amount, note, now, id] },
        { sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [randomUUID(), user.id, "update", "warehouse_sale", id, JSON.stringify({ saleDate, quantity, amount }), now] },
      ], "write");
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "WAREHOUSE_SALE_UPDATE_FAILED" }); }
  });
  app.use("/api/local", router);
}
