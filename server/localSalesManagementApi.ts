import { randomUUID } from "node:crypto";
import { Router, type Application } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

async function allowedSale(id: string, userId: string, role: string) {
  const result = await getTursoClient().execute({
    sql: role === "admin"
      ? "SELECT id, quantity, unit_price AS unitPrice, sale_date AS saleDate FROM sales WHERE id = ? LIMIT 1"
      : "SELECT id, quantity, unit_price AS unitPrice, sale_date AS saleDate FROM sales WHERE id = ? AND supervisor_id = ? LIMIT 1",
    args: role === "admin" ? [id] : [id, userId],
  });
  return result.rows[0] as unknown as { id: string; quantity: number; unitPrice: number; saleDate: string } | undefined;
}

export function registerLocalSalesManagementApi(app: Application) {
  router.patch("/sales/:id", async (req, res) => {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params.id || "");
    const quantity = Number(req.body?.quantity);
    const saleDate = String(req.body?.saleDate || "").trim();
    if (!id || !Number.isInteger(quantity) || quantity <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) || Number.isNaN(Date.parse(saleDate))) return res.status(400).json({ ok: false, error: "INVALID_SALE" });
    try {
      const sale = await allowedSale(id, user.id, user.role);
      if (!sale) return res.status(404).json({ ok: false, error: "SALE_NOT_FOUND" });
      const totalAmount = quantity * Number(sale.unitPrice);
      const now = new Date().toISOString();
      await getTursoClient().batch([
        { sql: "UPDATE sales SET quantity = ?, total_amount = ?, sale_date = ?, updated_at = ? WHERE id = ?", args: [quantity, totalAmount, saleDate, now, id] },
        { sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [randomUUID(), user.id, "update", "sale", id, JSON.stringify({ quantity, saleDate }), now] },
      ], "write");
      return res.json({ ok: true, totalAmount });
    } catch { return res.status(503).json({ ok: false, error: "SALE_UPDATE_FAILED" }); }
  });

  router.delete("/sales/:id", async (req, res) => {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params.id || "");
    try {
      const sale = await allowedSale(id, user.id, user.role);
      if (!sale) return res.status(404).json({ ok: false, error: "SALE_NOT_FOUND" });
      const now = new Date().toISOString();
      await getTursoClient().batch([
        { sql: "DELETE FROM sales WHERE id = ?", args: [id] },
        { sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [randomUUID(), user.id, "delete", "sale", id, "{}", now] },
      ], "write");
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "SALE_DELETE_FAILED" }); }
  });
  app.use("/api/local", router);
}
