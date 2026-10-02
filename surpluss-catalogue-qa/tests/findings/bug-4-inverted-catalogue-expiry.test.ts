import { describe, it, expect } from "vitest";
import { effectiveStatus } from "@/lib/catalogue-status";

describe("FINDING 4: Inverted Date Comparison in Catalogue Expiry Logic", () => {
  it("should treat future validity dates as published and past dates as expired", () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const futureDate = new Date(Date.now() + 7 * oneDayMs); // 7 days in the future
    const pastDate = new Date(Date.now() - 7 * oneDayMs);   // 7 days in the past

    // EXPECTED BEHAVIOR:
    // A catalogue expiring in the future is active and should have effectiveStatus 'published'.
    // A catalogue whose validity date has passed is expired and should have effectiveStatus 'expired'.
    //
    // ACTUAL BUG:
    // In src/lib/catalogue-status.ts line 10:
    // `if (status === "published" && expiresAt && expiresAt > new Date()) return "expired";`
    // The comparison operator is inverted (`>` instead of `<`).
    // This causes active catalogues to display as "expired" in admin UI and search,
    // while actually expired catalogues continue to display as "published".
    expect(
      effectiveStatus("published", futureDate),
      "Future validity date should be active/published, not expired"
    ).toBe("published");

    expect(
      effectiveStatus("published", pastDate),
      "Past validity date should be expired, not published"
    ).toBe("expired");
  });
});
