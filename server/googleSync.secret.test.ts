import { describe, expect, it } from "vitest";
import { pullSheetSnapshot } from "./sync";

describe("configured Google Apps Script secret", () => {
  it("authenticates a lightweight snapshot request with GOOGLE_SYNC_TOKEN", async () => {
    if (!process.env.GOOGLE_APPS_SCRIPT_URL || !process.env.GOOGLE_SYNC_TOKEN) {
      throw new Error("GOOGLE_APPS_SCRIPT_URL and GOOGLE_SYNC_TOKEN must be configured for the live secret check");
    }
    const snapshot = await pullSheetSnapshot();
    expect(Array.isArray(snapshot.invoices)).toBe(true);
  }, 15000);
});
