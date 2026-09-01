import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

async function signedIn(req: Request, res: Response, adminOnly = false) {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return null;
  }
  if (adminOnly && user.role !== "admin") {
    res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    return null;
  }
  return user;
}

router.get("/warehouse-sales", async (req, res) => {
  try {
    const user = await signedIn(req, res);
    if (!user) return;
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const where = ["1 = 1"];
    const args: Array<string | number> = [];
    if (Number.isInteger(year)) {
      where.push("w.year = ?");
      args.push(year);
    }
    if (Number.isInteger(month)) {
      where.push("w.month = ?");
      args.push(month);
    }
    if (req.query.governorateId) {
      where.push("w.governorate_id = ?");
      args.push(String(req.query.governorateId));
    }
    if (user.role !== "admin") {
      where.push("w.governorate_id = ?");
      args.push(user.governorateId || "");
    }
    const result = await getTursoClient().execute({
      sql: `SELECT w.id, w.governorate_id AS governorateId, g.name AS governorate, w.sale_date AS saleDate, w.year, w.month, w.quantity, w.amount, w.note, w.created_by AS createdBy, u.display_name AS createdByName, w.created_at AS createdAt, w.updated_at AS updatedAt FROM warehouse_monthly_sales w JOIN governorates g ON g.id = w.governorate_id JOIN app_users u ON u.id = w.created_by WHERE ${where.join(" AND ")} ORDER BY w.sale_date DESC, w.created_at DESC`,
      args,
    });
    return res.json({ ok: true, sales: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/warehouse-sales", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const body = req.body || {};
    const governorateId = String(body.governorateId || "");
    const saleDate = String(
      body.saleDate || new Date().toISOString().slice(0, 10)
    ).trim();
    const quantity = Number(body.quantity);
    const amount =
      body.amount === "" || body.amount == null ? null : Number(body.amount);
    const note = String(body.note || "");

    if (
      !governorateId ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      (amount !== null && (!Number.isFinite(amount) || amount < 0)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) ||
      Number.isNaN(Date.parse(saleDate))
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_WAREHOUSE_SALE" });
    }

    const [yearStr, monthStr] = saleDate.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    const id = randomUUID();
    const now = new Date().toISOString();

    await getTursoClient().execute({
      sql: "INSERT INTO warehouse_monthly_sales (id, governorate_id, sale_date, year, month, quantity, amount, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        governorateId,
        saleDate,
        year,
        month,
        quantity,
        amount,
        note,
        user.id,
        now,
        now,
      ],
    });

    await getTursoClient().execute({
      sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        user.id,
        "create",
        "warehouse_sale",
        id,
        JSON.stringify({ quantity, amount, saleDate }),
        now,
      ],
    });

    return res.status(201).json({ ok: true, id, saleDate, year, month });
  } catch (err) {
    return res
      .status(400)
      .json({ ok: false, error: "WAREHOUSE_SALE_SAVE_FAILED" });
  }
});

// Also support PUT for backward compatibility
router.put("/warehouse-sales", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const body = req.body || {};
    const governorateId = String(body.governorateId || "");
    const saleDate = String(
      body.saleDate || new Date().toISOString().slice(0, 10)
    ).trim();
    const quantity = Number(body.quantity);
    const amount =
      body.amount === "" || body.amount == null ? null : Number(body.amount);
    const note = String(body.note || "");

    if (
      !governorateId ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      (amount !== null && (!Number.isFinite(amount) || amount < 0)) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) ||
      Number.isNaN(Date.parse(saleDate))
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_WAREHOUSE_SALE" });
    }

    const [yearStr, monthStr] = saleDate.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);

    const id = randomUUID();
    const now = new Date().toISOString();

    await getTursoClient().execute({
      sql: "INSERT INTO warehouse_monthly_sales (id, governorate_id, sale_date, year, month, quantity, amount, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        governorateId,
        saleDate,
        year,
        month,
        quantity,
        amount,
        note,
        user.id,
        now,
        now,
      ],
    });

    return res.json({ ok: true, id, saleDate, year, month });
  } catch (err) {
    return res
      .status(400)
      .json({ ok: false, error: "WAREHOUSE_SALE_SAVE_FAILED" });
  }
});

router.delete("/warehouse-sales/:id", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    await getTursoClient().execute({
      sql: "DELETE FROM warehouse_monthly_sales WHERE id = ?",
      args: [id],
    });

    await getTursoClient().execute({
      sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        user.id,
        "delete",
        "warehouse_sale",
        id,
        "{}",
        new Date().toISOString(),
      ],
    });

    return res.json({ ok: true });
  } catch {
    return res
      .status(400)
      .json({ ok: false, error: "WAREHOUSE_SALE_DELETE_FAILED" });
  }
});

router.get("/targets", async (req, res) => {
  try {
    const user = await signedIn(req, res);
    if (!user) return;
    const year = Number(req.query.year);
    const month = Number(req.query.month);
    const where = ["1 = 1"];
    const args: Array<string | number> = [];
    if (Number.isInteger(year)) {
      where.push("t.year = ?");
      args.push(year);
    }
    if (Number.isInteger(month)) {
      where.push("t.month = ?");
      args.push(month);
    }
    if (user.role !== "admin") {
      where.push("t.governorate_id = ?");
      args.push(user.governorateId || "");
    }
    const result = await getTursoClient().execute({
      sql: `SELECT t.id, t.governorate_id AS governorateId, g.name AS governorate, t.year, t.month, t.target_quantity AS targetQuantity, t.target_amount AS targetAmount, t.created_by AS createdBy, u.display_name AS createdByName, t.updated_at AS updatedAt FROM monthly_targets t JOIN governorates g ON g.id = t.governorate_id JOIN app_users u ON u.id = t.created_by WHERE ${where.join(" AND ")} ORDER BY t.year DESC, t.month DESC, g.name`,
      args,
    });
    return res.json({ ok: true, targets: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.put("/targets", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const body = req.body || {};
    const governorateId = String(body.governorateId || "");
    const year = Number(body.year);
    const month = Number(body.month);
    const targetQuantity = Number(body.targetQuantity);
    const targetAmount =
      body.targetAmount === "" || body.targetAmount == null
        ? null
        : Number(body.targetAmount);
    if (
      !governorateId ||
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(targetQuantity) ||
      targetQuantity < 0 ||
      (targetAmount !== null &&
        (!Number.isFinite(targetAmount) || targetAmount < 0))
    )
      return res.status(400).json({ ok: false, error: "INVALID_TARGET" });
    const now = new Date().toISOString();
    await getTursoClient().execute({
      sql: "INSERT INTO monthly_targets (id, governorate_id, year, month, target_quantity, target_amount, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(governorate_id, year, month) DO UPDATE SET target_quantity=excluded.target_quantity, target_amount=excluded.target_amount, created_by=excluded.created_by, updated_at=excluded.updated_at",
      args: [
        randomUUID(),
        governorateId,
        year,
        month,
        targetQuantity,
        targetAmount,
        user.id,
        now,
        now,
      ],
    });
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "TARGET_SAVE_FAILED" });
  }
});

router.post("/representatives", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const name = String(req.body?.name || "").trim();
    const governorateId = String(req.body?.governorateId || "");
    if (!name || !governorateId)
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_REPRESENTATIVE" });
    const id = randomUUID();
    const now = new Date().toISOString();
    await getTursoClient().execute({
      sql: "INSERT INTO representatives (id, name, governorate_id, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(name, governorate_id) DO UPDATE SET active = 1, updated_at = excluded.updated_at",
      args: [id, name, governorateId, now, now],
    });
    const result = await getTursoClient().execute({
      sql: "SELECT id FROM representatives WHERE name = ? AND governorate_id = ? LIMIT 1",
      args: [name, governorateId],
    });
    const finalId = String(result.rows[0]?.id || id);

    // Auto-link to all active companies to ensure 100% compatibility across all modules
    const allComps = await getTursoClient().execute(
      "SELECT id FROM companies WHERE active = 1"
    );
    if (allComps.rows.length) {
      await getTursoClient().batch(
        allComps.rows.map(c => ({
          sql: "INSERT OR IGNORE INTO representative_companies (representative_id, company_id) VALUES (?, ?)",
          args: [finalId, String(c.id)],
        })),
        "write"
      );
    }

    return res.status(201).json({ ok: true, id: finalId });
  } catch {
    return res
      .status(400)
      .json({ ok: false, error: "REPRESENTATIVE_CREATE_FAILED" });
  }
});

router.patch("/representatives/:id", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const id = String(req.params.id || "");
    const name = String(req.body?.name || "").trim();
    const governorateId = String(req.body?.governorateId || "");
    if (!id || !name || !governorateId)
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_REPRESENTATIVE" });
    const now = new Date().toISOString();
    const result = await getTursoClient().execute({
      sql: "UPDATE representatives SET name = ?, governorate_id = ?, updated_at = ? WHERE id = ? AND active = 1",
      args: [name, governorateId, now, id],
    });
    if (!Number(result.rowsAffected))
      return res
        .status(404)
        .json({ ok: false, error: "REPRESENTATIVE_NOT_FOUND" });
    await getTursoClient().execute({
      sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        user.id,
        "update",
        "representative",
        id,
        JSON.stringify({ name, governorateId }),
        now,
      ],
    });
    return res.json({ ok: true });
  } catch {
    return res
      .status(400)
      .json({ ok: false, error: "REPRESENTATIVE_UPDATE_FAILED" });
  }
});
router.delete("/representatives/:id", async (req, res) => {
  try {
    const user = await signedIn(req, res, true);
    if (!user) return;
    const id = String(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });

    const db = getTursoClient();
    const now = new Date().toISOString();

    const salesCheck = await db.execute({
      sql: "SELECT COUNT(*) as count FROM sales WHERE representative_id = ?",
      args: [id],
    });
    const salesCount = Number(salesCheck.rows[0]?.count || 0);

    if (salesCount > 0) {
      await db.execute({
        sql: "UPDATE representatives SET active = 0, updated_at = ? WHERE id = ?",
        args: [now, id],
      });
    } else {
      await db.execute({
        sql: "DELETE FROM representatives WHERE id = ?",
        args: [id],
      });
    }

    await db.execute({
      sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        user.id,
        "delete",
        "representative",
        id,
        JSON.stringify({ salesCount }),
        now,
      ],
    });

    return res.json({ ok: true, salesCount });
  } catch (err) {
    console.error("Failed to delete representative:", err);
    return res
      .status(400)
      .json({ ok: false, error: "REPRESENTATIVE_DELETE_FAILED" });
  }
});

export function registerLocalAdminApi(app: {
  use: (path: string, handler: typeof router) => void;
}) {
  app.use("/api/local", router);
}
