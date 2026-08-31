import { randomUUID } from "node:crypto";
import { Router, type Application, type Request, type Response } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";

const router = Router();

async function ensureNotifications() {
  await getTursoClient().batch([
    { sql: "CREATE TABLE IF NOT EXISTS app_notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT, FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE)", args: [] },
    { sql: "CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created ON app_notifications(user_id, created_at DESC)", args: [] },
  ], "write");
}

async function announceSupervisorSale(req: Request) {
  const actor = await getRequestUser(req);
  if (!actor || actor.role !== "supervisor") return;
  const governorateId = String(req.body?.governorateId || actor.governorateId || "");
  if (!governorateId) return;
  const db = getTursoClient();
  await ensureNotifications();
  const [governorates, admins] = await db.batch([
    { sql: "SELECT name FROM governorates WHERE id = ? LIMIT 1", args: [governorateId] },
    { sql: "SELECT id FROM app_users WHERE role = 'admin' AND active = 1", args: [] },
  ], "read");
  const governorate = String(governorates.rows[0]?.name || "المحافظة المحددة");
  const itemCount = Array.isArray(req.body?.items) ? req.body.items.length : 1;
  const title = "تمت إضافة مبيعات جديدة";
  const body = `تمت إضافة ${itemCount > 1 ? `${itemCount} مواد` : "مبيعات"} إلى ${governorate} بواسطة ${actor.displayName}.`;
  const now = new Date().toISOString();
  if (admins.rows.length) {
    await db.batch(admins.rows.map((admin) => ({
      sql: "INSERT INTO app_notifications (id, user_id, title, body, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [randomUUID(), String(admin.id), title, body, "sale", now],
    })), "write");
  }
}

export function registerLocalNotificationsApi(app: Application) {
  app.use("/api/local/sales", ((req: Request, res: Response, next: () => void) => {
    const originalJson = res.json.bind(res);
    res.json = ((payload: unknown) => {
      const methodCreatesSales = req.method === "POST" && res.statusCode >= 200 && res.statusCode < 300;
      if (!methodCreatesSales) return originalJson(payload);
      void announceSupervisorSale(req).catch(() => undefined).finally(() => originalJson(payload));
      return res;
    }) as typeof res.json;
    next();
  }));

  router.get("/notifications", async (req, res) => {
    const user = await getRequestUser(req);
    if (!user || user.role !== "admin") return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    try {
      await ensureNotifications();
      const result = await getTursoClient().execute({
        sql: "SELECT id, title, body, kind, created_at AS createdAt, read_at AS readAt FROM app_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30",
        args: [user.id],
      });
      return res.json({ ok: true, notifications: result.rows });
    } catch { return res.status(503).json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }); }
  });

  router.post("/notifications/read", async (req, res) => {
    const user = await getRequestUser(req);
    if (!user || user.role !== "admin") return res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" });
    try {
      await ensureNotifications();
      await getTursoClient().execute({ sql: "UPDATE app_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", args: [new Date().toISOString(), user.id] });
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }); }
  });
  app.use("/api/local", router);
}
