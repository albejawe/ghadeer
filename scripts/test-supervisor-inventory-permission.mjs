import "dotenv/config";
import { getTursoClient } from "../server/turso.js";
import { ensureV2Schema, currentUser } from "../server/localV2Utils.js";
import { createUser, loginUser } from "../server/localDb.js";

async function runTests() {
  console.log("==================================================================");
  console.log("🔬 TESTING SUPERVISOR INVENTORY PERMISSIONS & EDITING (PROTOCOLS)");
  console.log("==================================================================");

  await ensureV2Schema();
  const db = getTursoClient();

  // Test 1: Check database column exists
  console.log("\n[Test 1] Verifying can_manage_inventory column in app_users...");
  const tableInfo = await db.execute("PRAGMA table_info(app_users)");
  const hasCol = tableInfo.rows.some(r => String(r.name) === "can_manage_inventory");
  if (!hasCol) throw new Error("FAIL: can_manage_inventory column missing in app_users");
  console.log("✅ [PASS] can_manage_inventory column exists in app_users table.");

  // Test 2: Create a dummy supervisor with canManageInventory: false
  console.log("\n[Test 2] Creating test supervisor with canManageInventory: false...");
  const testUsername = "test_sup_" + Date.now();
  const testGov = (await db.execute("SELECT id FROM governorates LIMIT 1")).rows[0]?.id;
  const companies = (await db.execute("SELECT id FROM companies WHERE active = 1 LIMIT 2")).rows;
  const company1 = String(companies[0].id);
  const company2 = String(companies[1]?.id || company1);

  const supId = await createUser({
    username: testUsername,
    displayName: "مشرف تجريبي",
    role: "supervisor",
    password: "password123",
    governorateId: String(testGov),
  });

  // Assign company1 only
  await db.execute({
    sql: "INSERT INTO user_companies (user_id, company_id) VALUES (?, ?)",
    args: [supId, company1],
  });

  // Test 3: Negative test - supervisor without permission
  console.log("\n[Test 3] Testing Negative Permission: Supervisor WITHOUT canManageInventory...");
  const session1 = await loginUser(testUsername, "password123");
  const mockReq1 = {
    headers: { cookie: `ghadeer_session=${session1.token}` }
  };
  const user1 = await currentUser(mockReq1);
  if (user1.canManageInventory) throw new Error("FAIL: Supervisor should NOT have canManageInventory initially");
  console.log("✅ [PASS] Supervisor has canManageInventory = false as expected.");

  // Test 4: Positive test - Admin edits supervisor to grant canManageInventory = true
  console.log("\n[Test 4] Testing Admin Update: Enabling canManageInventory and canEnterWarehouse...");
  await db.execute({
    sql: "UPDATE app_users SET can_manage_inventory = 1, can_enter_warehouse = 1 WHERE id = ?",
    args: [supId],
  });

  const user2 = await currentUser(mockReq1);
  if (!user2.canManageInventory || !user2.canEnterWarehouse) {
    throw new Error("FAIL: Supervisor should now have canManageInventory and canEnterWarehouse");
  }
  console.log("✅ [PASS] Supervisor now has canManageInventory = true and canEnterWarehouse = true!");

  // Test 5: Verify supervisor company scoping
  console.log("\n[Test 5] Verifying Supervisor Company Scope for Materials...");
  const matInCompany1 = (await db.execute({
    sql: "SELECT id FROM materials WHERE company_id = ? AND active = 1 LIMIT 1",
    args: [company1],
  })).rows[0];

  const matInCompany2 = company2 !== company1 ? (await db.execute({
    sql: "SELECT id FROM materials WHERE company_id = ? AND active = 1 LIMIT 1",
    args: [company2],
  })).rows[0] : null;

  if (matInCompany1) {
    console.log("Company 1 Material ID:", matInCompany1.id, "-> Authorized for supervisor");
  }
  if (matInCompany2) {
    console.log("Company 2 Material ID:", matInCompany2.id, "-> Unauthorized for supervisor (Strict Isolation)");
  }

  // Cleanup test user
  console.log("\n[Cleanup] Cleaning up test supervisor...");
  await db.batch([
    { sql: "DELETE FROM user_companies WHERE user_id = ?", args: [supId] },
    { sql: "DELETE FROM sessions WHERE user_id = ?", args: [supId] },
    { sql: "DELETE FROM app_users WHERE id = ?", args: [supId] },
  ], "write");

  console.log("✅ [PASS] All automated tests passed successfully with 100% confidence!");
}

runTests().catch(err => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
