import type { IncomingMessage, ServerResponse } from "http";
import { buildApp } from "./_core/app.js";
import { serveStatic } from "./_core/static.js";

const app = buildApp();
serveStatic(app);

// Vercel serverless entry — explicit (req, res) handler (CJS-safe)
export default function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  app(req as never, res as never);
}