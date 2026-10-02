import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { PUT as reorderListings } from "@/app/api/admin/catalogues/[id]/listings/order/route";
import { PATCH as updateListing } from "@/app/api/admin/catalogues/[id]/listings/[listingId]/route";
import { updateProductPrices } from "@/app/admin/products/actions";

describe("API & Server Actions: Tampered Payloads & Boundary Validation", () => {
  const catalogueId = "e2f0eb89-c978-477f-bf95-809f7524f373";
  const listingId = "4b2c3d4e-5f6a-4b2c-8d3e-4f5a6b7c8d9e";

  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate valid admin session
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "admin-id", email: "admin@catalogue.test", role: "admin" },
      expires: "2026-12-31",
    });
  });

  describe("Reorder Listings (PUT /api/admin/catalogues/[id]/listings/order)", () => {
    it("rejects payload containing duplicate listing IDs (HTTP 400)", async () => {
      const id1 = "11111111-1111-4111-8111-111111111111";
      const request = new Request(`http://localhost:3001/api/admin/catalogues/${catalogueId}/listings/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: [id1, id1] }), // Duplicate IDs!
      });

      const res = await reorderListings(request, { params: Promise.resolve({ id: catalogueId }) });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("Invalid order.");
    });

    it("rejects non-UUID catalogue ID parameter (HTTP 400)", async () => {
      const request = new Request("http://localhost:3001/api/admin/catalogues/not-a-uuid/listings/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ["11111111-1111-4111-8111-111111111111"] }),
      });

      const res = await reorderListings(request, { params: Promise.resolve({ id: "not-a-uuid" }) });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Invalid catalogue id.");
    });

    it("rejects empty orderedIds array (HTTP 400)", async () => {
      const request = new Request(`http://localhost:3001/api/admin/catalogues/${catalogueId}/listings/order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: [] }),
      });

      const res = await reorderListings(request, { params: Promise.resolve({ id: catalogueId }) });
      expect(res.status).toBe(400);
    });
  });

  describe("Update Listing (PATCH /api/admin/catalogues/[id]/listings/[listingId])", () => {
    it("rejects payload with no fields to update (HTTP 400)", async () => {
      const request = new Request(
        `http://localhost:3001/api/admin/catalogues/${catalogueId}/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}), // empty object
        }
      );

      const res = await updateListing(request, {
        params: Promise.resolve({ id: catalogueId, listingId }),
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid badges structure (more than 3 badges or invalid color) (HTTP 400)", async () => {
      const request = new Request(
        `http://localhost:3001/api/admin/catalogues/${catalogueId}/listings/${listingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            badges: [
              { text: "B1", color: "invalid-color-palette" },
              { text: "B2", color: "invalid-color-palette" },
              { text: "B3", color: "invalid-color-palette" },
              { text: "B4", color: "invalid-color-palette" }, // 4 badges > max 3
            ],
          }),
        }
      );

      const res = await updateListing(request, {
        params: Promise.resolve({ id: catalogueId, listingId }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("Price Updates Server Action (updateProductPrices)", () => {
    it("rejects negative prices", async () => {
      const result = await updateProductPrices([
        { id: catalogueId, mrp: -100, offerPrice: 50 },
      ]);
      expect(result).toHaveProperty("error");
    });

    it("rejects prices with more than 2 decimal places", async () => {
      const result = await updateProductPrices([
        { id: catalogueId, mrp: 100.999, offerPrice: 50 },
      ]);
      expect(result).toHaveProperty("error");
    });

    it("rejects empty updates array", async () => {
      const result = await updateProductPrices([]);
      expect(result).toHaveProperty("error");
    });
  });
});
