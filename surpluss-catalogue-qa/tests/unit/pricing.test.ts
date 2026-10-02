import { describe, it, expect } from "vitest";
import {
  discountPercent,
  priceLabel,
  needsPricesForSale,
  PRICE_ON_REQUEST_LABEL,
  NO_PRICE_LABEL,
} from "@/lib/pricing";

describe("Pricing Calculations (Unit)", () => {
  describe("discountPercent", () => {
    it("calculates percentage discount correctly for normal values", () => {
      // MRP = 1000, Offer = 750 -> 25% discount
      expect(discountPercent({ priceOnRequest: false, mrp: 1000, offerPrice: 750 })).toBe(25);

      // MRP = 5999, Offer = 2499 -> (1 - 2499/5999) = 58.34% -> 58%
      expect(discountPercent({ priceOnRequest: false, mrp: 5999, offerPrice: 2499 })).toBe(58);

      // MRP = 100, Offer = 100 -> 0%
      expect(discountPercent({ priceOnRequest: false, mrp: 100, offerPrice: 100 })).toBe(0);
    });

    it("returns 0 when priceOnRequest is true, regardless of mrp or offerPrice", () => {
      expect(discountPercent({ priceOnRequest: true, mrp: 1000, offerPrice: 500 })).toBe(0);
      expect(discountPercent({ priceOnRequest: true, mrp: null, offerPrice: null })).toBe(0);
    });

    it("returns 0 when either mrp or offerPrice is null", () => {
      expect(discountPercent({ priceOnRequest: false, mrp: null, offerPrice: 500 })).toBe(0);
      expect(discountPercent({ priceOnRequest: false, mrp: 1000, offerPrice: null })).toBe(0);
      expect(discountPercent({ priceOnRequest: false, mrp: null, offerPrice: null })).toBe(0);
    });

    it("returns 0 for non-finite values like NaN or Infinity", () => {
      expect(discountPercent({ priceOnRequest: false, mrp: Number.NaN, offerPrice: 500 })).toBe(0);
      expect(discountPercent({ priceOnRequest: false, mrp: 1000, offerPrice: Number.POSITIVE_INFINITY })).toBe(0);
    });
  });

  describe("priceLabel", () => {
    const dummyFormat = (val: number) => `₹${val.toLocaleString("en-IN")}`;

    it("returns Price on Request label when priceOnRequest is enabled", () => {
      const label = priceLabel({ priceOnRequest: true, offerPrice: 500 }, dummyFormat);
      expect(label).toBe(PRICE_ON_REQUEST_LABEL);
    });

    it("formats the offer price when priceOnRequest is false and offerPrice is present", () => {
      const label = priceLabel({ priceOnRequest: false, offerPrice: 1500 }, dummyFormat);
      expect(label).toBe("₹1,500");
    });

    it("returns NO_PRICE_LABEL when offerPrice is null and not priceOnRequest", () => {
      const label = priceLabel({ priceOnRequest: false, offerPrice: null }, dummyFormat);
      expect(label).toBe(NO_PRICE_LABEL);
    });
  });

  describe("needsPricesForSale", () => {
    it("returns false if priceOnRequest is true even if prices are missing", () => {
      expect(needsPricesForSale({ priceOnRequest: true, mrp: null, offerPrice: null })).toBe(false);
      expect(needsPricesForSale({ priceOnRequest: true, mrp: 1000, offerPrice: null })).toBe(false);
    });

    it("returns true if either mrp or offerPrice is null when priceOnRequest is false", () => {
      expect(needsPricesForSale({ priceOnRequest: false, mrp: null, offerPrice: 500 })).toBe(true);
      expect(needsPricesForSale({ priceOnRequest: false, mrp: 1000, offerPrice: null })).toBe(true);
      expect(needsPricesForSale({ priceOnRequest: false, mrp: null, offerPrice: null })).toBe(true);
    });

    it("returns false when both mrp and offerPrice are set", () => {
      expect(needsPricesForSale({ priceOnRequest: false, mrp: 1000, offerPrice: 500 })).toBe(false);
    });
  });
});
