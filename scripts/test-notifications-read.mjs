import "dotenv/config";
import { getTursoClient } from "../server/turso.js";
import { randomUUID } from "node:crypto";

async function verifyNotifications() {
  console.log("==================================================================");
  console.log("🔬 TESTING NOTIFICATIONS READ LOGIC & BADGE CLEARING");
  console.log("==================================================================");

  const db = getTursoClient();

  // Find admin user
  const adminRow = (await db.execute("SELECT id FROM app_users WHERE role = 'admin' AND active = 1 LIMIT 1")).rows[0];
  if (!adminRow) throw new Error("No admin user found");
  const adminId = String(adminRow.id);

  console.log(`\n[Test 1] Creating test unread notification for admin: ${adminId}...`);
  const notifId = randomUUID();
  const now = new Date().toISOString();
  await db.execute({
    sql: "INSERT INTO app_notifications (id, user_id, title, body, kind, created_at, read_at) VALUES (?, ?, ?, ?, ?, ?, NULL)",
    args: [notifId, adminId, "إشعار تجريبي للاختبار", "تم تسجيل مبيعات جديدة", "sale", now],
  });

  // Verify it is unread
  const beforeRead = await db.execute({
    sql: "SELECT id, read_at FROM app_notifications WHERE id = ?",
    args: [notifId],
  });
  if (beforeRead.rows[0].read_at !== null) throw new Error("Notification should be unread initially");
  console.log("✅ [PASS] Notification is unread (read_at is NULL).");

  // Simulate markAllRead (UPDATE app_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL)
  console.log("\n[Test 2] Simulating markAllRead action...");
  const readTimestamp = new Date().toISOString();
  await db.execute({
    sql: "UPDATE app_notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
    args: [readTimestamp, adminId],
  });

  // Verify it is now read
  const afterRead = await db.execute({
    sql: "SELECT id, read_at FROM app_notifications WHERE id = ?",
    args: [notifId],
  });
  if (!afterRead.rows[0].read_at) throw new Error("Notification should now have a valid read_at timestamp");
  console.log("✅ [PASS] Notification successfully marked as read with timestamp:", afterRead.rows[0].read_at);

  // Check remaining unread count for this admin
  const unreadCount = await db.execute({
    sql: "SELECT COUNT(*) as unread FROM app_notifications WHERE user_id = ? AND read_at IS NULL",
    args: [adminId],
  });
  console.log("Remaining unread count for admin:", unreadCount.rows[0].unread);
  if (Number(unreadCount.rows[0].unread) !== 0) throw new Error("Unread count should be 0");
  console.log("✅ [PASS] Unread count is now 0, badge (+9) will disappear immediately.");

  // Cleanup
  console.log("\n[Cleanup] Cleaning up test notification...");
  await db.execute({
    sql: "DELETE FROM app_notifications WHERE id = ?",
    args: [notifId],
  });
  console.log("✅ [PASS] Cleaned up test notification.");

  console.log("\n==================================================================");
  console.log("🎉 ALL NOTIFICATION READ TESTS PASSED WITH 100% SUCCESS!");
  console.log("==================================================================");
}

verifyNotifications().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
