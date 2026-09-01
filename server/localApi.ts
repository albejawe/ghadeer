import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import {
  createUser,
  deactivateSupervisor,
  getRequestUser,
  listUsers,
  loginUser,
  logoutUser,
  resetUserPassword,
  setSessionCookie,
  countUsers,
  ensureLocalSchema,
} from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();
async function actor(req: Request, res: Response) {
  const user = await getRequestUser(req);
  if (!user) {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return null;
  }
  return user;
}

async function admin(req: Request, res: Response) {
  const user = await actor(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    return null;
  }
  return user;
}

router.post("/auth/bootstrap", async (req, res) => {
  try {
    await ensureLocalSchema();
    if ((await countUsers()) > 0)
      return res.status(409).json({ ok: false, error: "ALREADY_INITIALIZED" });
    const username = String(req.body?.username || "ghadeer").trim();
    const password = String(req.body?.password || "");
    const displayName = String(req.body?.displayName || "غدير").trim();
    if (!username || password.length < 6)
      return res.status(400).json({ ok: false, error: "PASSWORD_TOO_SHORT" });
    await createUser({ username, displayName, role: "admin", password });
    const session = await loginUser(username, password);
    if (!session)
      return res.status(500).json({ ok: false, error: "BOOTSTRAP_FAILED" });
    setSessionCookie(res, session.token);
    return res.status(201).json({ ok: true, user: session.user });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const session = await loginUser(
      String(req.body?.username || ""),
      String(req.body?.password || "")
    );
    if (!session)
      return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    setSessionCookie(res, session.token);
    return res.json({ ok: true, user: session.user });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    return res.json({ ok: true, user: await getRequestUser(req) });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/auth/logout", async (req, res) => {
  try {
    await logoutUser(req, res);
    return res.json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.get("/reference", async (req, res) => {
  try {
    const user = await actor(req, res);
    if (!user) return;
    const db = getTursoClient();
    const [governorates, companies, materials, representatives] =
      await db.batch(
        [
          {
            sql: "SELECT id, name FROM governorates WHERE active = 1 ORDER BY name",
            args: [],
          },
          {
            sql: "SELECT id, name FROM companies WHERE active = 1 ORDER BY name",
            args: [],
          },
          {
            sql: "SELECT m.id, m.name, m.unit_price AS unitPrice, c.id AS companyId, c.name AS company FROM materials m JOIN companies c ON c.id = m.company_id WHERE m.active = 1 ORDER BY m.name",
            args: [],
          },
          {
            sql: "SELECT id, name, governorate_id AS governorateId FROM representatives WHERE active = 1 ORDER BY name",
            args: [],
          },
        ],
        "read"
      );
    return res.json({
      ok: true,
      user,
      governorates: governorates.rows,
      companies: companies.rows,
      materials: materials.rows,
      representatives: representatives.rows,
    });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.get("/sales", async (req, res) => {
  try {
    const user = await actor(req, res);
    if (!user) return;
    const args: Array<string | number> = [];
    const where = ["1 = 1"];
    if (user.role !== "admin") {
      where.push("s.supervisor_id = ?");
      args.push(user.id);
    }
    for (const [key, column] of [
      ["governorateId", "s.governorate_id"],
      ["representativeId", "s.representative_id"],
      ["companyId", "s.company_id"],
      ["materialId", "s.material_id"],
    ] as const) {
      const value = String(req.query[key] || "");
      if (value) {
        where.push(`${column} = ?`);
        args.push(value);
      }
    }
    const from = String(req.query.from || "");
    const to = String(req.query.to || "");
    if (from) {
      where.push("s.sale_date >= ?");
      args.push(from);
    }
    if (to) {
      where.push("s.sale_date <= ?");
      args.push(to);
    }
    const result = await getTursoClient().execute({
      sql: `SELECT s.id, s.sale_date AS saleDate, s.quantity, s.unit_price AS unitPrice, s.total_amount AS totalAmount, s.supervisor_id AS supervisorId, u.display_name AS supervisor, s.representative_id AS representativeId, r.name AS representative, s.governorate_id AS governorateId, g.name AS governorate, s.company_id AS companyId, c.name AS company, s.material_id AS materialId, m.name AS material FROM sales s JOIN app_users u ON u.id = s.supervisor_id JOIN representatives r ON r.id = s.representative_id JOIN governorates g ON g.id = s.governorate_id JOIN companies c ON c.id = s.company_id JOIN materials m ON m.id = s.material_id WHERE ${where.join(" AND ")} ORDER BY s.sale_date DESC, s.created_at DESC`,
      args,
    });
    return res.json({ ok: true, sales: result.rows });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/sales", async (req, res) => {
  try {
    const user = await actor(req, res);
    if (!user) return;
    const input = req.body || {};
    const governorateId =
      user.role === "supervisor"
        ? user.governorateId
        : String(input.governorateId || "");
    const quantity = Number(input.quantity);
    const saleDate = String(input.saleDate || "").trim();

    if (
      !governorateId ||
      !input.representativeId ||
      !input.companyId ||
      !input.materialId ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      !saleDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) ||
      Number.isNaN(Date.parse(saleDate))
    ) {
      return res.status(400).json({ ok: false, error: "INVALID_SALE" });
    }

    const db = getTursoClient();
    const checks = await db.batch(
      [
        {
          sql: "SELECT governorate_id AS governorateId FROM representatives WHERE id = ? AND active = 1",
          args: [String(input.representativeId)],
        },
        {
          sql: "SELECT company_id AS companyId, unit_price AS unitPrice FROM materials WHERE id = ? AND active = 1",
          args: [String(input.materialId)],
        },
        {
          sql: "SELECT id FROM governorates WHERE id = ? AND active = 1",
          args: [governorateId],
        },
        {
          sql: "SELECT id FROM companies WHERE id = ? AND active = 1",
          args: [String(input.companyId)],
        },
        {
          sql: "SELECT company_id AS companyId FROM user_companies WHERE user_id = ? AND company_id = ?",
          args: [user.id, String(input.companyId)],
        },
      ],
      "read"
    );

    const rep = checks[0].rows[0] as { governorateId?: string } | undefined;
    const material = checks[1].rows[0] as
      | { companyId?: string; unitPrice?: number }
      | undefined;

    if (
      !rep ||
      rep.governorateId !== governorateId ||
      !material ||
      material.companyId !== String(input.companyId) ||
      !checks[2].rows.length ||
      !checks[3].rows.length ||
      (user.role !== "admin" && !checks[4].rows.length)
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "SALE_REFERENCE_NOT_ALLOWED" });
    }

    // Strictly enforce official material unit price from DB
    const unitPrice = Number(material.unitPrice || 0);
    const totalAmount = quantity * unitPrice;

    const id = randomUUID();
    const now = new Date().toISOString();

    await db.execute({
      sql: "INSERT INTO sales (id, supervisor_id, representative_id, governorate_id, company_id, material_id, quantity, unit_price, total_amount, sale_date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      args: [
        id,
        user.id,
        String(input.representativeId),
        governorateId,
        String(input.companyId),
        String(input.materialId),
        quantity,
        unitPrice,
        totalAmount,
        saleDate,
        String(input.note || ""),
        now,
        now,
      ],
    });

    await db.execute({
      sql: "INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        randomUUID(),
        user.id,
        "create",
        "sale",
        id,
        JSON.stringify({ quantity, unitPrice, totalAmount }),
        now,
      ],
    });

    return res.status(201).json({ ok: true, id, unitPrice, totalAmount });
  } catch {
    return res.status(400).json({ ok: false, error: "SALE_CREATE_FAILED" });
  }
});

// Atomic Batch Sales endpoint
router.post("/sales/batch", async (req, res) => {
  try {
    const user = await actor(req, res);
    if (!user) return;
    const input = req.body || {};
    const governorateId =
      user.role === "supervisor"
        ? user.governorateId
        : String(input.governorateId || "");
    const representativeId = String(input.representativeId || "");
    const companyId = String(input.companyId || "");
    const saleDate = String(input.saleDate || "").trim();
    const items = Array.isArray(input.items) ? input.items : [];

    if (
      !governorateId ||
      !representativeId ||
      !companyId ||
      !saleDate ||
      !/^\d{4}-\d{2}-\d{2}$/.test(saleDate) ||
      Number.isNaN(Date.parse(saleDate)) ||
      !items.length
    ) {
      return res.status(400).json({ ok: false, error: "INVALID_BATCH_INPUT" });
    }

    const db = getTursoClient();

    // Verify Rep, Gov, Company, and User permission
    const checks = await db.batch(
      [
        {
          sql: "SELECT governorate_id AS governorateId FROM representatives WHERE id = ? AND active = 1",
          args: [representativeId],
        },
        {
          sql: "SELECT id FROM governorates WHERE id = ? AND active = 1",
          args: [governorateId],
        },
        {
          sql: "SELECT id FROM companies WHERE id = ? AND active = 1",
          args: [companyId],
        },
        {
          sql: "SELECT company_id AS companyId FROM user_companies WHERE user_id = ? AND company_id = ?",
          args: [user.id, companyId],
        },
      ],
      "read"
    );

    const rep = checks[0].rows[0] as { governorateId?: string } | undefined;
    if (
      !rep ||
      rep.governorateId !== governorateId ||
      !checks[1].rows.length ||
      !checks[2].rows.length ||
      (user.role !== "admin" && !checks[3].rows.length)
    ) {
      return res
        .status(400)
        .json({ ok: false, error: "BATCH_REFERENCE_NOT_ALLOWED" });
    }

    // Fetch all materials belonging to this company to verify & lock prices
    const materialsResult = await db.execute({
      sql: "SELECT id, name, unit_price AS unitPrice FROM materials WHERE company_id = ? AND active = 1",
      args: [companyId],
    });
    const materialMap = new Map(
      materialsResult.rows.map(m => [String(m.id), Number(m.unitPrice)])
    );

    const now = new Date().toISOString();
    const statements = [];
    const createdIds: string[] = [];

    for (const item of items) {
      const matId = String(item.materialId || "");
      const qty = Number(item.quantity);
      if (
        !matId ||
        !materialMap.has(matId) ||
        !Number.isInteger(qty) ||
        qty <= 0
      ) {
        return res.status(400).json({ ok: false, error: "INVALID_BATCH_ITEM" });
      }
      const unitPrice = materialMap.get(matId) || 0;
      const totalAmount = qty * unitPrice;
      const saleId = randomUUID();
      createdIds.push(saleId);

      statements.push({
        sql: "INSERT INTO sales (id, supervisor_id, representative_id, governorate_id, company_id, material_id, quantity, unit_price, total_amount, sale_date, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          saleId,
          user.id,
          representativeId,
          governorateId,
          companyId,
          matId,
          qty,
          unitPrice,
          totalAmount,
          saleDate,
          String(item.note || "إدخال متعدد"),
          now,
          now,
        ],
      });
    }

    // Execute all batch sales atomically in a single LibSQL transaction
    await db.batch(statements, "write");

    return res
      .status(201)
      .json({ ok: true, count: createdIds.length, ids: createdIds });
  } catch (err) {
    return res.status(400).json({ ok: false, error: "BATCH_CREATE_FAILED" });
  }
});

router.get("/users", async (req, res) => {
  try {
    if (!(await admin(req, res))) return;
    return res.json({ ok: true, users: await listUsers() });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/users", async (req, res) => {
  try {
    if (!(await admin(req, res))) return;
    const body = req.body || {};
    if (
      !body.username ||
      !body.displayName ||
      !body.password ||
      body.password.length < 6 ||
      !["admin", "supervisor"].includes(body.role) ||
      (body.role === "supervisor" && !body.governorateId)
    ) {
      return res.status(400).json({ ok: false, error: "INVALID_USER" });
    }

    const id = await createUser({
      username: body.username,
      displayName: body.displayName,
      password: body.password,
      role: body.role,
      governorateId: body.governorateId,
    });

    if (body.role === "supervisor") {
      let companyIds = Array.isArray(body.companyIds)
        ? body.companyIds.map((val: unknown) => String(val)).filter(Boolean)
        : [];
      // If none selected, auto-assign all active companies to avoid supervisor lockout deadlock
      if (!companyIds.length) {
        const allComps = await getTursoClient().execute(
          "SELECT id FROM companies WHERE active = 1"
        );
        companyIds = allComps.rows.map(r => String(r.id));
      }
      if (companyIds.length) {
        await getTursoClient().batch(
          companyIds.map((cId: string) => ({
            sql: "INSERT OR IGNORE INTO user_companies (user_id, company_id) VALUES (?, ?)",
            args: [id, cId],
          })),
          "write"
        );
      }
    }

    return res.status(201).json({ ok: true, id });
  } catch {
    return res.status(400).json({ ok: false, error: "USER_CREATE_FAILED" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const current = await admin(req, res);
    if (!current) return;
    const id = String(req.params.id || "");
    if (!id || id === current.id)
      return res
        .status(400)
        .json({ ok: false, error: "CANNOT_DELETE_CURRENT_ADMIN" });
    const result = await getTursoClient().execute({
      sql: "SELECT role FROM app_users WHERE id = ? AND active = 1 LIMIT 1",
      args: [id],
    });
    if (!result.rows.length || String(result.rows[0]?.role) !== "supervisor")
      return res.status(400).json({ ok: false, error: "SUPERVISOR_ONLY" });
    await deactivateSupervisor(id);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "USER_DELETE_FAILED" });
  }
});
router.post("/users/:id/password", async (req, res) => {
  try {
    if (!(await admin(req, res))) return;
    const password = String(req.body?.password || "");
    if (password.length < 6)
      return res.status(400).json({ ok: false, error: "PASSWORD_TOO_SHORT" });
    await resetUserPassword(req.params.id, password);
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "PASSWORD_UPDATE_FAILED" });
  }
});

export function registerLocalApi(app: {
  use: (path: string, handler: typeof router) => void;
}) {
  app.use("/api/local", router);
}
