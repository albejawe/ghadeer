import { describe, expect, it } from "vitest";
import { createSharedLinkRequest, sharedIdFromPath, sharedLinkPath } from "./sharedLinkUtils";

describe("shared link contract", () => {
  const filters = { company: "test", governorate: "بغداد", warehouse: "مذخر الرافدين", status: "الكل", quick: "الكل", search: "3" };

  it("builds the exact POST request used by the dashboard", () => {
    const request = createSharedLinkRequest(filters, "تقرير اختبار");
    expect(request.method).toBe("POST");
    expect(request.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(request.body)).toEqual({ filters, name: "تقرير اختبار" });
  });

  it("builds and parses a read-only shared URL", () => {
    const url = sharedLinkPath("https://example.test/", "abc/123");
    expect(url).toBe("https://example.test/shared/abc%2F123");
    expect(sharedIdFromPath("/shared/abc%2F123")).toBe("abc%2F123");
    expect(sharedIdFromPath("/dashboard")).toBe("");
  });
});
