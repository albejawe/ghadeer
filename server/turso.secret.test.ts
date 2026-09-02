import { describe, expect, it } from "vitest";
import { listCachedInvoices } from "./turso";

describe.runIf(process.env.RUN_LIVE_SECRET_TESTS === "1")("configured Turso secrets", () => {
  it("reads the invoices cache through the live Turso connection", async () => {
    if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
      throw new Error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured for the live secret check");
    }
    const invoices = await listCachedInvoices();
    expect(Array.isArray(invoices)).toBe(true);
  }, 15000);
});
