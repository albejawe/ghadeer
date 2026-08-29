import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth.js";
import { registerStorageProxy } from "./storageProxy.js";
import { appRouter } from "../routers.js";
import { createContext } from "./context.js";
import { parseRows } from "../sync.js";
import {
  applyFullSnapshot,
  createSharedLink,
  getSharedLink,
  hasSyncEvent,
  listCachedInvoices,
  listSharedLinks,
  removeSharedLink,
  updateSharedLink,
} from "../turso.js";
import {
  createInvoiceWithSync,
  updateInvoiceWithSync,
  deleteInvoiceWithSync,
} from "../invoiceHandlers.js";
import { applyInvoiceFilters } from "../../shared/invoiceLogic.js";
import { registerLocalApi } from "../localApi.js";
import { registerLocalAdminApi } from "../localAdminApi.js";

export function buildApp() {
  const app = express();
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerLocalApi(app);
  registerLocalAdminApi(app);
  app.get("/api/sync/run", async (_req, res) => {
    try {
      const result = await (await import("../sync.js")).runSync();
      const eventId = result.syncToken || `pull-${result.syncedAt}`;
      const summary = await applyFullSnapshot(result.invoices, eventId, "manual-full-sync");
      res.json({ ok: true, ...result, persisted: summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = message === "SYNC_NOT_CONFIGURED" || message === "TURSO_NOT_CONFIGURED" ? 503 : 502;
      res.status(code).json({ ok: false, error: "SYNC_FAILED" });
    }
  });
  app.post("/api/sync/sheets", async (req, res) => {
    try {
      const token = process.env.GOOGLE_SYNC_TOKEN;
      if (!token || req.body?.token !== token) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      if (!req.body || !Array.isArray(req.body.rows) || !req.body.syncToken) return res.status(400).json({ ok: false, error: "INVALID_SNAPSHOT" });
      if (await hasSyncEvent(String(req.body.syncToken))) return res.json({ ok: true, accepted: true, ignored: true, syncToken: req.body.syncToken });
      const invoices = parseRows(req.body.rows as unknown[][]);
      const fullSnapshot = req.body.fullSnapshot === true;
      const persisted = await applyFullSnapshot(invoices, String(req.body.syncToken), String(req.body.source || "google-sheets"), fullSnapshot);
      res.json({ ok: true, accepted: true, persisted, syncToken: req.body.syncToken });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const code = message === "TURSO_NOT_CONFIGURED" ? 503 : 502;
      res.status(code).json({ ok: false, error: "SYNC_FAILED" });
    }
  });
  app.get("/api/shared-links/public/:id", async (req, res) => {
    try { const link = await getSharedLink(req.params.id); if (!link) return res.status(404).json({ ok: false, error: "LINK_NOT_FOUND" }); const invoices = await listCachedInvoices(); const filters = link.filters as Record<string, string>; res.json({ ok: true, link, invoices: applyInvoiceFilters(invoices as never[], filters) }); }
    catch { res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" }); }
  });
  app.get("/api/shared-links", async (_req, res) => {
    try { res.json({ ok: true, links: await listSharedLinks() }); }
    catch { res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" }); }
  });
  app.post("/api/shared-links", async (req, res) => {
    try { const link = await createSharedLink(req.body?.filters || {}, String(req.body?.name || "رابط تقرير")); res.status(201).json({ ok: true, link }); }
    catch { res.status(503).json({ ok: false, error: "LINK_CREATE_FAILED" }); }
  });
  app.patch("/api/shared-links/:id", async (req, res) => {
    try { await updateSharedLink(req.params.id, Boolean(req.body?.active)); res.json({ ok: true }); }
    catch { res.status(503).json({ ok: false, error: "LINK_UPDATE_FAILED" }); }
  });
  app.delete("/api/shared-links/:id", async (req, res) => {
    try { await removeSharedLink(req.params.id); res.json({ ok: true }); }
    catch { res.status(503).json({ ok: false, error: "LINK_DELETE_FAILED" }); }
  });
  app.get("/api/invoices", async (_req, res) => {
    try { res.json({ ok: true, invoices: await listCachedInvoices() }); }
    catch { res.status(503).json({ ok: false, error: "DATABASE_UNAVAILABLE" }); }
  });
  app.post("/api/invoices", async (req, res) => {
    try { const invoice = req.body as import("../sync.js").SheetInvoice; if (!invoice?.id || !invoice.company || !invoice.number) return res.status(400).json({ ok: false, error: "INVALID_INVOICE" }); const saved = await createInvoiceWithSync(invoice); res.status(201).json({ ok: true, invoice: saved }); }
    catch { res.status(502).json({ ok: false, error: "INVOICE_CREATE_FAILED" }); }
  });
  app.patch("/api/invoices/:id", async (req, res) => {
    try { const invoice = { ...(req.body as import("../sync.js").SheetInvoice), id: req.params.id }; if (!invoice.company || !invoice.number) return res.status(400).json({ ok: false, error: "INVALID_INVOICE" }); const saved = await updateInvoiceWithSync(invoice); res.json({ ok: true, invoice: saved }); }
    catch { res.status(502).json({ ok: false, error: "INVOICE_UPDATE_FAILED" }); }
  });
  app.delete("/api/invoices/:id", async (req, res) => {
    try { await deleteInvoiceWithSync(req.params.id); res.json({ ok: true, id: req.params.id }); }
    catch { res.status(502).json({ ok: false, error: "INVOICE_DELETE_FAILED" }); }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}
