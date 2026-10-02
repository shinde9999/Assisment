import { describe, it, expect } from "vitest";
import { discountPercent } from "@/lib/pricing";

describe("FINDING 8: Discount Calculation Edge Cases (0-Price Falsiness & Negative Discount)", () => {
  it("should calculate 100% discount when offerPrice is 0 (free promotional product)", () => {
    // A free sample or promotional item with MRP 500 and Offer Price 0
    const result = discountPercent({
      priceOnRequest: false,
      mrp: 500,
      offerPrice: 0,
    });

    // EXPECTED BEHAVIOR:
    // If an item is given away for free (offerPrice = 0), the discount is 100%.
    //
    // ACTUAL BUG:
    // In src/lib/pricing.ts line 20:
    // `if (!mrp || !offerPrice) return 0;`
    // JavaScript treats `0` as falsy, so `!offerPrice` is true when offerPrice === 0.
    // It returns 0% discount instead of 100%!
    expect(result, "0 offer price on non-zero MRP should be 100% discount").toBe(100);
  });

  it("should NOT return a negative discount percent if offerPrice exceeds MRP", () => {
    // Accidental price inversion or clearance markup
    const result = discountPercent({
      priceOnRequest: false,
      mrp: 100,
      offerPrice: 125,
    });

    // EXPECTED BEHAVIOR:
    // Discounts should not be negative (displaying '-25% OFF' in user UI is misleading and nonsensical).
    // It should clamp to 0 or throw/flag an issue.
    //
    // ACTUAL BUG:
    // Math.round((1 - 125/100) * 100) evaluates to -25, returning negative discount numbers.
    expect(result, "Discount should never be negative").toBe(0);
  });
});
