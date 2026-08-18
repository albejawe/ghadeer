import { describe, expect, it } from "vitest";
import { SIDEBAR_DEFAULT_OPEN, sidebarAriaLabel, toggleSidebar } from "./sidebarState";

describe("sidebar state", () => {
  it("starts closed and toggles open then closed", () => {
    expect(SIDEBAR_DEFAULT_OPEN).toBe(false);
    expect(toggleSidebar(SIDEBAR_DEFAULT_OPEN)).toBe(true);
    expect(toggleSidebar(true)).toBe(false);
  });

  it("exposes Arabic labels that match the current state", () => {
    expect(sidebarAriaLabel(false)).toBe("فتح القائمة الجانبية");
    expect(sidebarAriaLabel(true)).toBe("إغلاق القائمة الجانبية");
  });
});
