import { describe, it, expect } from "vitest";
import { effectiveStatus } from "@/lib/catalogue-status";

describe("Catalogue Status Lifecycle (Unit)", () => {
  it("keeps draft status as draft regardless of expiration date", () => {
    expect(effectiveStatus("draft", null)).toBe("draft");
    expect(effectiveStatus("draft", new Date("2026-12-31"))).toBe("draft");
  });

  it("maps legacy inactive status to draft", () => {
    expect(effectiveStatus("inactive", null)).toBe("draft");
    expect(effectiveStatus("inactive", new Date("2026-01-01"))).toBe("draft");
  });

  it("maps legacy expired status to draft if status column was 'expired'", () => {
    expect(effectiveStatus("expired", null)).toBe("draft");
  });

  it("keeps published catalogue with null expiresAt as published", () => {
    expect(effectiveStatus("published", null)).toBe("published");
  });
});
