import { randomUUID } from "node:crypto";
import { Router, type Application } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

async function admin(req: Parameters<typeof getRequestUser>[0]) {
  const user = await getRequestUser(req);
  return user?.role === "admin" ? user : null;
}

async function ensureSchema() {
  const db = getTursoClient();
  await db.batch(
    [
      {
        sql: "CREATE TABLE IF NOT EXISTS warehouse_sale_batches (id TEXT PRIMARY KEY, governorate_id TEXT NOT NULL, sale_date TEXT NOT NULL, year INTEGER NOT NULL, month INTEGER NOT NULL, total_quantity INTEGER NOT NULL, total_amount REAL NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', created_by TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
      },
      {
        sql: "CREATE TABLE IF NOT EXISTS warehouse_sale_items (id TEXT PRIMARY KEY, batch_id TEXT NOT NULL, material_id TEXT NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL DEFAULT 0, total_amount REAL NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS warehouse_sale_batches_period_idx ON warehouse_sale_batches(governorate_id, sale_date)",
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS warehouse_sale_items_batch_idx ON warehouse_sale_items(batch_id)",
      },
      {
        sql: "CREATE INDEX IF NOT EXISTS warehouse_sale_items_material_idx ON warehouse_sale_items(material_id)",
      },
    ],
    "write"
  );
}

type Item = { materialId: string; quantity: number };

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

async function validateItems(raw: unknown): Promise<Item[] | null> {
  if (!Array.isArray(raw) || !raw.length) return null;
  const merged = new Map<string, number>();
  for (const item of raw) {
    const materialId = String(
      (item as { materialId?: unknown })?.materialId || ""
    );
    const quantity = Number((item as { quantity?: unknown })?.quantity);
    if (!materialId || !Number.isInteger(quantity) || quantity <= 0)
      return null;
    merged.set(materialId, (merged.get(materialId) || 0) + quantity);
  }
  const items = Array.from(merged.entries()).map(([materialId, quantity]) => ({
    materialId,
    quantity,
  }));
  const placeholders = items.map(() => "?").join(",");
  const result = await getTursoClient().execute({
    sql: `SELECT id FROM materials WHERE active = 1 AND id IN (${placeholders})`,
    args: items.map(item => item.materialId),
  });
  return result.rows.length === items.length ? items : null;
}

async function saveBatch(
  userId: string,
  body: Record<string, unknown>,
  id: string = randomUUID()
) {
  await ensureSchema();
  const governorateId = String(body.governorateId || "");
  const saleDate = String(body.saleDate || "").trim();
  const note = String(body.note || "")
    .trim()
    .slice(0, 500);
  const items = await validateItems(body.items);
  if (!governorateId || !validDate(saleDate) || !items) return null;
  const [year, month] = saleDate.split("-").map(Number);
  const ids = items.map(item => item.materialId);
  const materialRows = await getTursoClient().execute({
    sql: `SELECT id, unit_price AS unitPrice FROM materials WHERE id IN (${ids.map(() => "?").join(",")})`,
    args: ids,
  });
  const prices = new Map(
    materialRows.rows.map(row => [String(row.id), Number(row.unitPrice || 0)])
  );
  const detail = items.map(item => ({
    ...item,
    unitPrice: prices.get(item.materialId) || 0,
    totalAmount: item.quantity * (prices.get(item.materialId) || 0),
  }));
  const totalQuantity = detail.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = detail.reduce((sum, item) => sum + item.totalAmount, 0);
  const now = new Date().toISOString();
  const db = getTursoClient();
  const commands = [
    {
      sql: "INSERT INTO warehouse_sale_batches (id, governorate_id, sale_date, year, month, total_quantity, total_amount, note, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        governorateId,
        saleDate,
        year,
        month,
        totalQuantity,
        totalAmount,
        note,
        userId,
        now,
        now,
      ],
    },
    ...detail.map(item => ({
      sql: "INSERT INTO warehouse_sale_items (id, batch_id, material_id, quantity, unit_price, total_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        id,
        item.materialId,
        item.quantity,
        item.unitPrice,
        item.totalAmount,
        now,
      ],
    })),
    {
      sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        userId,
        "create",
        "warehouse_batch",
        id,
        JSON.stringify({ saleDate, totalQuantity, itemCount: detail.length }),
        now,
      ],
    },
  ];
  await db.batch(commands, "write");
  return { id, totalQuantity, totalAmount };
}

router.get("/warehouse-batches", async (req, res) => {
  try {
    const user = await admin(req);
    if (!user)
      return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    await ensureSchema();
    const rows = await getTursoClient().execute(
      "SELECT b.id, b.governorate_id AS governorateId, g.name AS governorate, b.sale_date AS saleDate, b.year, b.month, b.total_quantity AS totalQuantity, b.total_amount AS totalAmount, b.note, u.display_name AS createdByName, b.created_at AS createdAt, b.updated_at AS updatedAt, i.id AS itemId, i.material_id AS materialId, m.name AS material, c.name AS company, i.quantity, i.unit_price AS unitPrice, i.total_amount AS itemTotal FROM warehouse_sale_batches b JOIN governorates g ON g.id = b.governorate_id JOIN app_users u ON u.id = b.created_by JOIN warehouse_sale_items i ON i.batch_id = b.id JOIN materials m ON m.id = i.material_id JOIN companies c ON c.id = m.company_id ORDER BY b.sale_date DESC, b.created_at DESC"
    );
    const batches = new Map<string, Record<string, unknown>>();
    for (const row of rows.rows) {
      const id = String(row.id);
      if (!batches.has(id))
        batches.set(id, {
          id,
          governorateId: row.governorateId,
          governorate: row.governorate,
          saleDate: row.saleDate,
          year: row.year,
          month: row.month,
          totalQuantity: row.totalQuantity,
          totalAmount: row.totalAmount,
          note: row.note,
          createdByName: row.createdByName,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          items: [],
        });
      (batches.get(id)?.items as unknown[]).push({
        id: row.itemId,
        materialId: row.materialId,
        material: row.material,
        company: row.company,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        totalAmount: row.itemTotal,
      });
    }
    return res.json({ ok: true, batches: Array.from(batches.values()) });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/warehouse-batches", async (req, res) => {
  try {
    const user = await admin(req);
    if (!user)
      return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const saved = await saveBatch(user.id, req.body || {});
    if (!saved)
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_WAREHOUSE_BATCH" });
    return res.status(201).json({ ok: true, ...saved });
  } catch {
    return res
      .status(503)
      .json({ ok: false, error: "WAREHOUSE_BATCH_SAVE_FAILED" });
  }
});

router.patch("/warehouse-batches/:id", async (req, res) => {
  try {
    const user = await admin(req);
    if (!user)
      return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const id = String(req.params.id || "");
    if (!id) return res.status(400).json({ ok: false, error: "INVALID_ID" });
    await ensureSchema();
    const preflight = req.body || {};
    const items = await validateItems(preflight.items);
    if (
      !String(preflight.governorateId || "") ||
      !validDate(String(preflight.saleDate || "").trim()) ||
      !items
    )
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_WAREHOUSE_BATCH" });
    const db = getTursoClient();
    const found = await db.execute({
      sql: "SELECT id FROM warehouse_sale_batches WHERE id = ?",
      args: [id],
    });
    if (!found.rows.length)
      return res
        .status(404)
        .json({ ok: false, error: "WAREHOUSE_BATCH_NOT_FOUND" });
    const governorateId = String(preflight.governorateId);
    const saleDate = String(preflight.saleDate).trim();
    const note = String(preflight.note || "")
      .trim()
      .slice(0, 500);
    const [year, month] = saleDate.split("-").map(Number);
    const ids = items.map(item => item.materialId);
    const materialRows = await db.execute({
      sql: `SELECT id, unit_price AS unitPrice FROM materials WHERE id IN (${ids.map(() => "?").join(",")})`,
      args: ids,
    });
    const prices = new Map(
      materialRows.rows.map(row => [String(row.id), Number(row.unitPrice || 0)])
    );
    const detail = items.map(item => ({
      ...item,
      unitPrice: prices.get(item.materialId) || 0,
      totalAmount: item.quantity * (prices.get(item.materialId) || 0),
    }));
    const totalQuantity = detail.reduce((sum, item) => sum + item.quantity, 0);
    const totalAmount = detail.reduce((sum, item) => sum + item.totalAmount, 0);
    const now = new Date().toISOString();
    await db.batch(
      [
        {
          sql: "UPDATE warehouse_sale_batches SET governorate_id = ?, sale_date = ?, year = ?, month = ?, total_quantity = ?, total_amount = ?, note = ?, updated_at = ? WHERE id = ?",
          args: [
            governorateId,
            saleDate,
            year,
            month,
            totalQuantity,
            totalAmount,
            note,
            now,
            id,
          ],
        },
        {
          sql: "DELETE FROM warehouse_sale_items WHERE batch_id = ?",
          args: [id],
        },
        ...detail.map(item => ({
          sql: "INSERT INTO warehouse_sale_items (id, batch_id, material_id, quantity, unit_price, total_amount, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            randomUUID(),
            id,
            item.materialId,
            item.quantity,
            item.unitPrice,
            item.totalAmount,
            now,
          ],
        })),
        {
          sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            randomUUID(),
            user.id,
            "update",
            "warehouse_batch",
            id,
            JSON.stringify({
              saleDate,
              totalQuantity,
              itemCount: detail.length,
            }),
            now,
          ],
        },
      ],
      "write"
    );
    return res.json({ ok: true, id, totalQuantity, totalAmount });
  } catch {
    return res
      .status(503)
      .json({ ok: false, error: "WAREHOUSE_BATCH_UPDATE_FAILED" });
  }
});

router.delete("/warehouse-batches/:id", async (req, res) => {
  try {
    const user = await admin(req);
    if (!user)
      return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const id = String(req.params.id || "");
    await ensureSchema();
    await getTursoClient().batch(
      [
        {
          sql: "DELETE FROM warehouse_sale_items WHERE batch_id = ?",
          args: [id],
        },
        { sql: "DELETE FROM warehouse_sale_batches WHERE id = ?", args: [id] },
        {
          sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            randomUUID(),
            user.id,
            "delete",
            "warehouse_batch",
            id,
            "{}",
            new Date().toISOString(),
          ],
        },
      ],
      "write"
    );
    return res.json({ ok: true });
  } catch {
    return res
      .status(503)
      .json({ ok: false, error: "WAREHOUSE_BATCH_DELETE_FAILED" });
  }
});

router.get("/inventory", async (req, res) => {
  try {
    const user = await admin(req);
    if (!user)
      return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const db = getTursoClient();
    await db.execute(
      "CREATE TABLE IF NOT EXISTS inventory_stock (material_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL DEFAULT 0, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL)"
    );
    const result = await db.execute(
      "SELECT m.id AS materialId, m.name AS material, m.unit_price AS unitPrice, c.name AS company, COALESCE(s.quantity, 0) AS quantity, s.updated_at AS updatedAt FROM materials m JOIN companies c ON c.id = m.company_id LEFT JOIN inventory_stock s ON s.material_id = m.id WHERE m.active = 1 ORDER BY c.name, m.name"
    );
    return res.json({ ok: true, inventory: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.put("/inventory/:materialId", async (req, res) => {
  try {
    const user = await admin(req);
    if (!user)
      return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    const materialId = String(req.params.materialId || "");
    const quantity = Number(req.body?.quantity);
    if (!materialId || !Number.isInteger(quantity) || quantity < 0)
      return res
        .status(400)
        .json({ ok: false, error: "INVALID_STOCK_QUANTITY" });
    const db = getTursoClient();
    await db.execute(
      "CREATE TABLE IF NOT EXISTS inventory_stock (material_id TEXT PRIMARY KEY, quantity INTEGER NOT NULL DEFAULT 0, updated_by TEXT NOT NULL, updated_at TEXT NOT NULL)"
    );
    const now = new Date().toISOString();
    await db.batch(
      [
        {
          sql: "INSERT INTO inventory_stock (material_id, quantity, updated_by, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(material_id) DO UPDATE SET quantity = excluded.quantity, updated_by = excluded.updated_by, updated_at = excluded.updated_at",
          args: [materialId, quantity, user.id, now],
        },
        {
          sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          args: [
            randomUUID(),
            user.id,
            "update",
            "inventory_stock",
            materialId,
            JSON.stringify({ quantity }),
            now,
          ],
        },
      ],
      "write"
    );
    return res.json({ ok: true, quantity });
  } catch {
    return res.status(503).json({ ok: false, error: "INVENTORY_SAVE_FAILED" });
  }
});

export function registerLocalWarehouseBatchApi(app: Application) {
  app.use("/api/local", router);
}
