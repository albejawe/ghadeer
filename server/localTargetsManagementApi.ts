import { randomUUID } from "node:crypto";
import { Router, type Application } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

export function registerLocalTargetsManagementApi(app: Application) {
  router.delete("/targets/:id", async (req, res) => {
    const user = await getRequestUser(req);
    if (!user || user.role !== "admin") return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const id = String(req.params.id || "");
    try {
      const existing = await getTursoClient().execute({ sql: "SELECT id, governorate_id, year, month FROM monthly_targets WHERE id = ? LIMIT 1", args: [id] });
      if (!existing.rows.length) return res.status(404).json({ ok: false, error: "TARGET_NOT_FOUND" });
      const row = existing.rows[0];
      const now = new Date().toISOString();
      await getTursoClient().batch([
        { sql: "DELETE FROM monthly_targets WHERE id = ?", args: [id] },
        { sql: "DELETE FROM monthly_material_targets WHERE governorate_id = ? AND year = ? AND month = ?", args: [String(row.governorate_id), Number(row.year), Number(row.month)] },
        { sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", args: [randomUUID(), user.id, "delete", "monthly_target", id, "{}", now] },
      ], "write");
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "TARGET_DELETE_FAILED" }); }
  });
  app.use("/api/local", router);
}
