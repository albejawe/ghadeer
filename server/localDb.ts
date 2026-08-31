import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { parse as parseCookie } from "cookie";
import { getTursoClient } from "./turso.js";

export type LocalRole = "admin" | "supervisor";
export type LocalUser = {
  id: string;
  username: string;
  displayName: string;
  role: LocalRole;
  governorateId: string | null;
  active: boolean;
};

export const LOCAL_SESSION_COOKIE = "ghadeer_session";
const SESSION_DAYS = 30;
let schemaPromise: Promise<void> | null = null;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":");
  if (!salt || !digest) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function ensureLocalSchema() {
  if (schemaPromise) return schemaPromise;
  schemaPromise = getTursoClient().batch([
    { sql: "CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(user_id) REFERENCES app_users(id) ON DELETE CASCADE)", args: [] },
    { sql: "CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)", args: [] },
    { sql: "CREATE INDEX IF NOT EXISTS idx_warehouse_sale_date ON warehouse_monthly_sales(sale_date)", args: [] },
    { sql: "CREATE INDEX IF NOT EXISTS idx_warehouse_gov_period ON warehouse_monthly_sales(governorate_id, year, month)", args: [] },
  ], "write").then(() => undefined);
  return schemaPromise;
}

function toUser(row: Record<string, unknown>): LocalUser {
  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    role: String(row.role) as LocalRole,
    governorateId: row.governorate_id ? String(row.governorate_id) : null,
    active: Boolean(row.active),
  };
}

export async function getUserBySessionToken(token: string | undefined) {
  if (!token) return null;
  await ensureLocalSchema();
  const result = await getTursoClient().execute({
    sql: "SELECT u.id, u.username, u.display_name, u.role, u.governorate_id, u.active FROM sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1 LIMIT 1",
    args: [sessionHash(token), new Date().toISOString()],
  });
  return result.rows[0] ? toUser(result.rows[0] as Record<string, unknown>) : null;
}

export async function getRequestUser(req: Request) {
  return getUserBySessionToken(parseCookie(req.headers.cookie || "")[LOCAL_SESSION_COOKIE]);
}

export async function loginUser(username: string, password: string) {
  await ensureLocalSchema();
  const result = await getTursoClient().execute({
    sql: "SELECT id, username, display_name, role, password_hash, governorate_id, active FROM app_users WHERE username = ? LIMIT 1",
    args: [username.trim().toLowerCase()],
  });
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row || !Boolean(row.active) || !verifyPassword(password, String(row.password_hash))) return null;
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await getTursoClient().execute({ sql: "INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)", args: [sessionHash(token), String(row.id), expires, new Date().toISOString()] });
  return { token, user: toUser(row) };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(LOCAL_SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: SESSION_DAYS * 86_400_000, path: "/" });
}

export async function logoutUser(req: Request, res: Response) {
  const token = parseCookie(req.headers.cookie || "")[LOCAL_SESSION_COOKIE];
  if (token) await getTursoClient().execute({ sql: "DELETE FROM sessions WHERE token_hash = ?", args: [sessionHash(token)] });
  res.clearCookie(LOCAL_SESSION_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
}

export async function createUser(input: { username: string; displayName: string; role: LocalRole; password: string; governorateId?: string | null }) {
  const id = randomUUID();
  const now = new Date().toISOString();
  await getTursoClient().execute({ sql: "INSERT INTO app_users (id, username, display_name, role, password_hash, governorate_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)", args: [id, input.username.trim().toLowerCase(), input.displayName.trim(), input.role, hashPassword(input.password), input.governorateId || null, now, now] });
  return id;
}

export async function resetUserPassword(id: string, password: string) {
  await getTursoClient().batch(
    [
      {
        sql: "UPDATE app_users SET password_hash = ?, updated_at = ? WHERE id = ?",
        args: [hashPassword(password), new Date().toISOString(), id],
      },
      {
        sql: "DELETE FROM sessions WHERE user_id = ?",
        args: [id],
      },
    ],
    "write"
  );
}

export async function listUsers() {
  const result = await getTursoClient().execute("SELECT id, username, display_name, role, governorate_id, active, created_at, updated_at FROM app_users ORDER BY display_name");
  return result.rows.map((row) => ({ ...toUser(row as Record<string, unknown>), createdAt: String(row.created_at), updatedAt: String(row.updated_at) }));
}

export async function countUsers() {
  const result = await getTursoClient().execute("SELECT COUNT(*) AS count FROM app_users");
  return Number(result.rows[0]?.count || 0);
}
