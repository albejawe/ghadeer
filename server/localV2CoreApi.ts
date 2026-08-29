import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  countUsers,
  createUser,
  loginUser,
  logoutUser,
  resetUserPassword,
  setSessionCookie,
} from "./localDb.js";
import { getTursoClient } from "./turso.js";
import {
  audit,
  cleanText,
  currentUser,
  ensureV2Schema,
  requireAdmin,
  requireUser,
  validMoney,
} from "./localV2Utils.js";

const router = Router();

router.get("/auth/status", async (_req, res) => {
  try {
    await ensureV2Schema();
    return res.json({ ok: true, initialized: (await countUsers()) > 0 });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/auth/bootstrap", async (req, res) => {
  try {
    await ensureV2Schema();
    if ((await countUsers()) > 0) return res.status(409).json({ ok: false, error: "ALREADY_INITIALIZED" });
    const configuredKey = process.env.ADMIN_BOOTSTRAP_KEY;
    if (!configuredKey || req.get("x-bootstrap-key") !== configuredKey) return res.status(403).json({ ok: false, error: "BOOTSTRAP_LOCKED" });
    const password = String(req.body?.password || "");
    if (password.length < 8) return res.status(400).json({ ok: false, error: "PASSWORD_TOO_SHORT" });
    await createUser({ username: "ghadeer", displayName: cleanText(req.body?.displayName, 80) || "غدير", role: "admin", password });
    const session = await loginUser("ghadeer", password);
    if (!session) return res.status(500).json({ ok: false, error: "BOOTSTRAP_FAILED" });
    setSessionCookie(res, session.token);
    return res.status(201).json({ ok: true, user: await currentUser(req) || session.user });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    await ensureV2Schema();
    const username = cleanText(req.body?.username, 80).toLowerCase();
    const password = String(req.body?.password || "");
    const session = await loginUser(username, password);
    if (!session) return res.status(401).json({ ok: false, error: "INVALID_CREDENTIALS" });
    setSessionCookie(res, session.token);
    return res.json({ ok: true, user: session.user });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    return res.json({ ok: true, user: await currentUser(req) });
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
    const user = await requireUser(req, res);
    if (!user) return;
    const db = getTursoClient();
    const companyFilter = user.role === "admin" ? "" : ` AND c.id IN (${user.companyIds.map(() => "?").join(",") || "''"})`;
    const companyArgs = user.role === "admin" ? [] : user.companyIds;
    const representativeFilter = user.role === "admin" ? "" : " AND r.governorate_id = ?";
    const representativeArgs = user.role === "admin" ? [] : [user.governorateId || ""];
    const [governorates, companies, materials, representatives, repCompanies] = await db.batch([
      { sql: user.role === "admin" ? "SELECT id, name FROM governorates WHERE active = 1 ORDER BY name" : "SELECT id, name FROM governorates WHERE active = 1 AND id = ? ORDER BY name", args: user.role === "admin" ? [] : [user.governorateId || ""] },
      { sql: `SELECT c.id, c.name, c.active FROM companies c WHERE c.active = 1${companyFilter} ORDER BY c.name`, args: companyArgs },
      { sql: `SELECT m.id, m.name, m.unit_price AS unitPrice, m.active, c.id AS companyId, c.name AS company FROM materials m JOIN companies c ON c.id = m.company_id WHERE m.active = 1 AND c.active = 1${companyFilter} ORDER BY c.name, m.name`, args: companyArgs },
      { sql: `SELECT r.id, r.name, r.governorate_id AS governorateId, g.name AS governorate, r.active FROM representatives r JOIN governorates g ON g.id = r.governorate_id WHERE r.active = 1${representativeFilter} ORDER BY r.name`, args: representativeArgs },
      { sql: "SELECT representative_id AS representativeId, company_id AS companyId FROM representative_companies", args: [] },
    ], "read");
    return res.json({
      ok: true,
      user,
      governorates: governorates.rows,
      companies: companies.rows,
      materials: materials.rows,
      representatives: representatives.rows.map((row) => ({ ...row, companyIds: repCompanies.rows.filter((link) => String(link.representativeId) === String(row.id)).map((link) => String(link.companyId)) })),
    });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.get("/admin/users", async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const db = getTursoClient();
    const [users, links] = await db.batch([
      { sql: "SELECT u.id, u.username, u.display_name AS displayName, u.role, u.governorate_id AS governorateId, g.name AS governorate, u.active, u.can_enter_warehouse AS canEnterWarehouse, u.created_at AS createdAt FROM app_users u LEFT JOIN governorates g ON g.id = u.governorate_id ORDER BY u.role, u.display_name", args: [] },
      { sql: "SELECT user_id AS userId, company_id AS companyId FROM user_companies ORDER BY company_id", args: [] },
    ], "read");
    return res.json({ ok: true, users: users.rows.map((row) => ({ ...row, active: Boolean(row.active), canEnterWarehouse: Boolean(row.canEnterWarehouse), companyIds: links.rows.filter((link) => String(link.userId) === String(row.id)).map((link) => String(link.companyId)) })) });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/admin/users", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const displayName = cleanText(req.body?.displayName, 80);
    const username = cleanText(req.body?.username, 80).toLowerCase();
    const password = String(req.body?.password || "");
    const governorateId = cleanText(req.body?.governorateId, 80);
    const companyIds = Array.isArray(req.body?.companyIds) ? Array.from(new Set(req.body.companyIds.map((value: unknown) => cleanText(value, 80)).filter(Boolean))) as string[] : [];
    if (!displayName || !username || password.length < 6 || !governorateId || !companyIds.length) return res.status(400).json({ ok: false, error: "INVALID_USER" });
    const id = await createUser({ username, displayName, password, role: "supervisor", governorateId });
    const db = getTursoClient();
    await db.batch([
      { sql: "UPDATE app_users SET can_enter_warehouse = ? WHERE id = ?", args: [req.body?.canEnterWarehouse ? 1 : 0, id] },
      ...companyIds.map((companyId) => ({ sql: "INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)", args: [id, companyId] })),
    ], "write");
    await audit(admin.id, "create", "user", id, { username, governorateId, companyIds });
    return res.status(201).json({ ok: true, id });
  } catch {
    return res.status(400).json({ ok: false, error: "USER_CREATE_FAILED" });
  }
});

router.patch("/admin/users/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = cleanText(req.params.id, 80);
    const displayName = cleanText(req.body?.displayName, 80);
    const governorateId = cleanText(req.body?.governorateId, 80);
    const companyIds = Array.isArray(req.body?.companyIds) ? Array.from(new Set(req.body.companyIds.map((value: unknown) => cleanText(value, 80)).filter(Boolean))) as string[] : [];
    if (!id || !displayName || !governorateId || !companyIds.length) return res.status(400).json({ ok: false, error: "INVALID_USER" });
    const db = getTursoClient();
    await db.batch([
      { sql: "UPDATE app_users SET display_name = ?, governorate_id = ?, active = ?, can_enter_warehouse = ?, updated_at = ? WHERE id = ? AND role = 'supervisor'", args: [displayName, governorateId, req.body?.active === false ? 0 : 1, req.body?.canEnterWarehouse ? 1 : 0, new Date().toISOString(), id] },
      { sql: "DELETE FROM user_companies WHERE user_id = ?", args: [id] },
      ...companyIds.map((companyId) => ({ sql: "INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)", args: [id, companyId] })),
    ], "write");
    await audit(admin.id, "update", "user", id, { governorateId, companyIds });
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "USER_UPDATE_FAILED" });
  }
});

router.post("/admin/users/:id/password", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const password = String(req.body?.password || "");
    if (password.length < 6) return res.status(400).json({ ok: false, error: "PASSWORD_TOO_SHORT" });
    await resetUserPassword(cleanText(req.params.id, 80), password);
    await audit(admin.id, "password_reset", "user", cleanText(req.params.id, 80));
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "PASSWORD_UPDATE_FAILED" });
  }
});

router.get("/admin/catalog", async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const [companies, materials] = await getTursoClient().batch([
      { sql: "SELECT id, name, active, created_at AS createdAt FROM companies ORDER BY active DESC, name", args: [] },
      { sql: "SELECT m.id, m.name, m.unit_price AS unitPrice, m.company_id AS companyId, c.name AS company, m.active, m.updated_at AS updatedAt FROM materials m JOIN companies c ON c.id = m.company_id ORDER BY m.active DESC, c.name, m.name", args: [] },
    ], "read");
    return res.json({ ok: true, companies: companies.rows.map((row) => ({ ...row, active: Boolean(row.active) })), materials: materials.rows.map((row) => ({ ...row, active: Boolean(row.active) })) });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/admin/companies", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const name = cleanText(req.body?.name, 100);
    if (!name) return res.status(400).json({ ok: false, error: "INVALID_COMPANY" });
    const id = randomUUID();
    await getTursoClient().execute({ sql: "INSERT INTO companies (id, name, active, created_at) VALUES (?, ?, 1, ?)", args: [id, name, new Date().toISOString()] });
    await audit(admin.id, "create", "company", id, { name });
    return res.status(201).json({ ok: true, id });
  } catch {
    return res.status(400).json({ ok: false, error: "COMPANY_CREATE_FAILED" });
  }
});

router.patch("/admin/companies/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const name = cleanText(req.body?.name, 100);
    if (!name) return res.status(400).json({ ok: false, error: "INVALID_COMPANY" });
    await getTursoClient().execute({ sql: "UPDATE companies SET name = ?, active = ? WHERE id = ?", args: [name, req.body?.active === false ? 0 : 1, cleanText(req.params.id, 80)] });
    await audit(admin.id, "update", "company", cleanText(req.params.id, 80), { name });
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "COMPANY_UPDATE_FAILED" });
  }
});

router.post("/admin/materials", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const name = cleanText(req.body?.name, 180);
    const companyId = cleanText(req.body?.companyId, 80);
    const unitPrice = validMoney(req.body?.unitPrice);
    if (!name || !companyId || !Number.isFinite(unitPrice)) return res.status(400).json({ ok: false, error: "INVALID_MATERIAL" });
    const id = randomUUID();
    const now = new Date().toISOString();
    await getTursoClient().execute({ sql: "INSERT INTO materials (id, name, company_id, unit_price, active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)", args: [id, name, companyId, unitPrice, now, now] });
    await audit(admin.id, "create", "material", id, { name, companyId, unitPrice });
    return res.status(201).json({ ok: true, id });
  } catch {
    return res.status(400).json({ ok: false, error: "MATERIAL_CREATE_FAILED" });
  }
});

router.patch("/admin/materials/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const name = cleanText(req.body?.name, 180);
    const companyId = cleanText(req.body?.companyId, 80);
    const unitPrice = validMoney(req.body?.unitPrice);
    if (!name || !companyId || !Number.isFinite(unitPrice)) return res.status(400).json({ ok: false, error: "INVALID_MATERIAL" });
    await getTursoClient().execute({ sql: "UPDATE materials SET name = ?, company_id = ?, unit_price = ?, active = ?, updated_at = ? WHERE id = ?", args: [name, companyId, unitPrice, req.body?.active === false ? 0 : 1, new Date().toISOString(), cleanText(req.params.id, 80)] });
    await audit(admin.id, "update", "material", cleanText(req.params.id, 80), { name, companyId, unitPrice });
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "MATERIAL_UPDATE_FAILED" });
  }
});

router.get("/admin/representatives", async (req, res) => {
  try {
    if (!await requireAdmin(req, res)) return;
    const [representatives, links] = await getTursoClient().batch([
      { sql: "SELECT r.id, r.name, r.governorate_id AS governorateId, g.name AS governorate, r.active, r.created_at AS createdAt FROM representatives r JOIN governorates g ON g.id = r.governorate_id ORDER BY r.active DESC, r.name", args: [] },
      { sql: "SELECT representative_id AS representativeId, company_id AS companyId FROM representative_companies ORDER BY company_id", args: [] },
    ], "read");
    return res.json({ ok: true, representatives: representatives.rows.map((row) => ({ ...row, active: Boolean(row.active), companyIds: links.rows.filter((link) => String(link.representativeId) === String(row.id)).map((link) => String(link.companyId)) })) });
  } catch {
    return res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" });
  }
});

router.post("/admin/representatives", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const name = cleanText(req.body?.name, 100);
    const governorateId = cleanText(req.body?.governorateId, 80);
    const companyIds = Array.isArray(req.body?.companyIds) ? Array.from(new Set(req.body.companyIds.map((value: unknown) => cleanText(value, 80)).filter(Boolean))) as string[] : [];
    if (!name || !governorateId || !companyIds.length) return res.status(400).json({ ok: false, error: "INVALID_REPRESENTATIVE" });
    const id = randomUUID();
    const now = new Date().toISOString();
    await getTursoClient().batch([
      { sql: "INSERT INTO representatives (id, name, governorate_id, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)", args: [id, name, governorateId, now, now] },
      ...companyIds.map((companyId) => ({ sql: "INSERT INTO representative_companies (representative_id, company_id) VALUES (?, ?)", args: [id, companyId] })),
    ], "write");
    await audit(admin.id, "create", "representative", id, { name, governorateId, companyIds });
    return res.status(201).json({ ok: true, id });
  } catch {
    return res.status(400).json({ ok: false, error: "REPRESENTATIVE_CREATE_FAILED" });
  }
});

router.patch("/admin/representatives/:id", async (req, res) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const id = cleanText(req.params.id, 80);
    const name = cleanText(req.body?.name, 100);
    const governorateId = cleanText(req.body?.governorateId, 80);
    const companyIds = Array.isArray(req.body?.companyIds) ? Array.from(new Set(req.body.companyIds.map((value: unknown) => cleanText(value, 80)).filter(Boolean))) as string[] : [];
    if (!id || !name || !governorateId || !companyIds.length) return res.status(400).json({ ok: false, error: "INVALID_REPRESENTATIVE" });
    await getTursoClient().batch([
      { sql: "UPDATE representatives SET name = ?, governorate_id = ?, active = ?, updated_at = ? WHERE id = ?", args: [name, governorateId, req.body?.active === false ? 0 : 1, new Date().toISOString(), id] },
      { sql: "DELETE FROM representative_companies WHERE representative_id = ?", args: [id] },
      ...companyIds.map((companyId) => ({ sql: "INSERT INTO representative_companies (representative_id, company_id) VALUES (?, ?)", args: [id, companyId] })),
    ], "write");
    await audit(admin.id, "update", "representative", id, { name, governorateId, companyIds });
    return res.json({ ok: true });
  } catch {
    return res.status(400).json({ ok: false, error: "REPRESENTATIVE_UPDATE_FAILED" });
  }
});

export function registerLocalV2CoreApi(app: { use: (path: string, handler: typeof router) => void }) {
  app.use("/api/local/v2", router);
}


