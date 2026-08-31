import { randomUUID } from "node:crypto";
import { Router, type Application, type Request, type Response } from "express";
import { getRequestUser } from "./localDb.js";
import { getTursoClient } from "./turso.js";
import { isPushConfigured, pushPublicKey, sendPush, type StoredPushSubscription } from "./webPush.js";

const router = Router();

type PushSubscriptionInput = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

async function ensureNotifications() {
  await getTursoClient().batch([
    { sql: "CREATE TABLE IF NOT EXISTS app_notifications (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, kind TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT, FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE)", args: [] },
    { sql: "CREATE INDEX IF NOT EXISTS idx_app_notifications_user_created ON app_notifications(user_id, created_at DESC)", args: [] },
    { sql: "CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE)", args: [] },
    { sql: "CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)", args: [] },
  ], "write");
}

function parseSubscription(value: PushSubscriptionInput | undefined) {
  const endpoint = String(value?.endpoint || "").trim();
  const p256dh = String(value?.keys?.p256dh || "").trim();
  const auth = String(value?.keys?.auth || "").trim();
  if (!endpoint.startsWith("https://") || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

async function subscriptionsFor(userIds: string[]) {
  if (!userIds.length) return [] as StoredPushSubscription[];
  const db = getTursoClient();
  const groups = await Promise.all(userIds.map((userId) => db.execute({
    sql: "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    args: [userId],
  })));
  return groups.flatMap((group) => group.rows.map((row) => ({
    id: String(row.id), endpoint: String(row.endpoint), p256dh: String(row.p256dh), auth: String(row.auth),
  })));
}

async function dispatchPush(userIds: string[], payload: Record<string, unknown>) {
  if (!isPushConfigured()) return;
  const subscriptions = await subscriptionsFor(userIds);
  const results = await Promise.allSettled(subscriptions.map((subscription) => sendPush(subscription, payload)));
  const expired = results.flatMap((result, index) => {
    const statusCode = result.status === "rejected" ? Number((result.reason as { statusCode?: number })?.statusCode) : 0;
    return statusCode === 404 || statusCode === 410 ? [subscriptions[index].id] : [];
  });
  if (expired.length) await getTursoClient().batch(expired.map((id) => ({ sql: "DELETE FROM push_subscriptions WHERE id = ?", args: [id] })), "write");
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
  const adminIds = admins.rows.map((admin) => String(admin.id));
  if (adminIds.length) {
    await db.batch(adminIds.map((userId) => ({
      sql: "INSERT INTO app_notifications (id, user_id, title, body, kind, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      args: [randomUUID(), userId, title, body, "sale", now],
    })), "write");
    await dispatchPush(adminIds, { title, body, url: "/delegates", tag: `sale-${now}`, badge: 1 });
  }
}

async function requireAdmin(req: Request, res: Response) {
  const user = await getRequestUser(req);
  if (!user) { res.status(401).json({ ok: false, error: "UNAUTHORIZED" }); return null; }
  if (user.role !== "admin") { res.status(403).json({ ok: false, error: "ADMIN_REQUIRED" }); return null; }
  return user;
}

export function registerLocalNotificationsApi(app: Application) {
  app.use("/api/local/sales", ((req: Request, res: Response, next: () => void) => {
    const originalJson = res.json.bind(res);
    res.json = ((payload: unknown) => {
      const createsSales = req.method === "POST" && res.statusCode >= 200 && res.statusCode < 300;
      if (!createsSales) return originalJson(payload);
      void announceSupervisorSale(req).catch(() => undefined).finally(() => originalJson(payload));
      return res;
    }) as typeof res.json;
    next();
  }));

  router.get("/push/public-key", async (req, res) => {
    if (!(await requireAdmin(req, res))) return;
    const publicKey = pushPublicKey();
    if (!publicKey) return res.status(503).json({ ok: false, error: "PUSH_NOT_CONFIGURED" });
    return res.json({ ok: true, publicKey });
  });

  router.post("/push/subscribe", async (req, res) => {
    const user = await requireAdmin(req, res); if (!user) return;
    const subscription = parseSubscription(req.body?.subscription);
    if (!subscription) return res.status(400).json({ ok: false, error: "INVALID_PUSH_SUBSCRIPTION" });
    try {
      await ensureNotifications();
      const now = new Date().toISOString();
      await getTursoClient().execute({
        sql: "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, updated_at = excluded.updated_at",
        args: [randomUUID(), user.id, subscription.endpoint, subscription.p256dh, subscription.auth, now, now],
      });
      return res.status(201).json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "PUSH_SUBSCRIBE_FAILED" }); }
  });

  router.post("/push/test", async (req, res) => {
    const user = await requireAdmin(req, res); if (!user) return;
    try {
      await ensureNotifications();
      if (!isPushConfigured()) return res.status(503).json({ ok: false, error: "PUSH_NOT_CONFIGURED" });
      await dispatchPush([user.id], { title: "إشعارات غدير مفعّلة", body: "سيصلك تنبيه هنا حتى عند إغلاق التطبيق.", url: "/delegates", tag: "ghadeer-push-test" });
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "PUSH_TEST_FAILED" }); }
  });

  router.get("/notifications", async (req, res) => {
    const user = await requireAdmin(req, res); if (!user) return;
    try {
      await ensureNotifications();
      const result = await getTursoClient().execute({ sql: "SELECT id, title, body, kind, created_at AS createdAt, read_at AS readAt FROM app_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30", args: [user.id] });
      return res.json({ ok: true, notifications: result.rows });
    } catch { return res.status(503).json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }); }
  });

  router.post("/notifications/read", async (req, res) => {
    const user = await requireAdmin(req, res); if (!user) return;
    try {
      await ensureNotifications();
      await getTursoClient().execute({ sql: "UPDATE app_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", args: [new Date().toISOString(), user.id] });
      return res.json({ ok: true });
    } catch { return res.status(503).json({ ok: false, error: "NOTIFICATIONS_UNAVAILABLE" }); }
  });
  app.use("/api/local", router);
}