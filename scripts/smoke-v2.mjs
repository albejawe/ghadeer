import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@libsql/client";

const baseUrl = process.env.GHADEER_TEST_URL || "http://localhost:3000";
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });
const createdHashes = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, token, init) {
  const response = await fetch(`${baseUrl}/api/local/v2${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { cookie: `ghadeer_session=${token}` } : {}), ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  return { response, body };
}

async function temporarySession(userId) {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  createdHashes.push(hash);
  await db.execute({ sql: "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", args: [hash, userId, new Date(Date.now() + 300_000).toISOString(), new Date().toISOString()] });
  return token;
}

try {
  const status = await request("/auth/status");
  assert(status.response.status === 200 && status.body.initialized === true, "Auth status must be initialized");

  const blockedBootstrap = await request("/auth/bootstrap", null, { method: "POST", body: JSON.stringify({ password: "should-not-work" }) });
  assert(blockedBootstrap.response.status === 409, "Second visitor must never bootstrap another admin");

  const users = await db.execute("SELECT id, role, governorate_id AS governorateId FROM app_users WHERE active = 1 ORDER BY role");
  const admin = users.rows.find((row) => String(row.role) === "admin");
  const supervisor = users.rows.find((row) => String(row.role) === "supervisor");
  assert(admin && supervisor, "Admin and supervisor must exist");

  const adminToken = await temporarySession(String(admin.id));
  const [reference, team, catalog, representatives, dashboard] = await Promise.all([
    request("/reference", adminToken), request("/admin/users", adminToken), request("/admin/catalog", adminToken),
    request("/admin/representatives", adminToken), request(`/dashboard?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}`, adminToken),
  ]);
  assert(reference.response.status === 200 && reference.body.governorates.length >= 4, "Admin reference failed");
  assert(team.response.status === 200 && team.body.users.some((user) => user.role === "supervisor"), "Supervisors must be visible");
  assert(catalog.response.status === 200 && catalog.body.companies.length >= 2 && catalog.body.materials.length >= 26, "Catalog must include imported materials");
  assert(representatives.response.status === 200, "Representatives endpoint failed");
  assert(dashboard.response.status === 200 && Array.isArray(dashboard.body.governorates), "Dashboard endpoint failed");

  const latestTarget = await db.execute("SELECT year, month FROM monthly_targets ORDER BY updated_at DESC LIMIT 1");
  if (latestTarget.rows[0]) {
    const targetResult = await request(`/targets?year=${latestTarget.rows[0].year}&month=${latestTarget.rows[0].month}`, adminToken);
    assert(targetResult.response.status === 200 && targetResult.body.targets.length >= 1, "Saved target must be returned for its period");
  }

  const supervisorToken = await temporarySession(String(supervisor.id));
  const supervisorReference = await request("/reference", supervisorToken);
  const forbiddenAdmin = await request("/admin/users", supervisorToken);
  assert(supervisorReference.response.status === 200 && supervisorReference.body.governorates.length === 1, "Supervisor must see only one governorate");
  assert(forbiddenAdmin.response.status === 403, "Supervisor must not access admin endpoints");

  console.log(JSON.stringify({ ok: true, checks: 10, supervisors: team.body.users.filter((user) => user.role === "supervisor").length, companies: catalog.body.companies.length, materials: catalog.body.materials.length }));
} finally {
  for (const hash of createdHashes) await db.execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [hash] });
  db.close();
}

