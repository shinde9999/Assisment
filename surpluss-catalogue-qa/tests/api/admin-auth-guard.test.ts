import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock @/auth so auth() returns null (anonymous/unauthenticated user)
vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import { GET as getCatalogue, PATCH as patchCatalogue } from "@/app/api/admin/catalogues/[id]/route";
import { POST as postListings } from "@/app/api/admin/catalogues/[id]/listings/route";
import { GET as getBadgePresets } from "@/app/api/admin/badge-presets/route";
import { GET as globalSearch } from "@/app/api/admin/search/route";
import { GET as productSearch } from "@/app/api/admin/products/search/route";
import { POST as presignUpload } from "@/app/api/uploads/presign/route";
import { setCatalogueStatus, deleteCatalogue } from "@/app/admin/actions";
import { updateLeadStatus } from "@/app/admin/leads/actions";
import { updateProductPrices, archiveProducts } from "@/app/admin/products/actions";

describe("API & Server Actions: Anonymous / Signed-Out Access Control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate signed-out / anonymous session
    (auth as unknown as Mock).mockResolvedValue(null);
  });

  describe("Admin Route Handlers reject signed-out callers with HTTP 401", () => {
    const dummyId = "e2f0eb89-c978-477f-bf95-809f7524f373";

    it("GET /api/admin/catalogues/[id] -> 401 Unauthorized", async () => {
      const res = await getCatalogue(new Request("http://localhost:3001/api/admin/catalogues/" + dummyId), {
        params: Promise.resolve({ id: dummyId }),
      });
      expect(res.status).toBe(401);
    });

    it("PATCH /api/admin/catalogues/[id] -> 401 Unauthorized", async () => {
      const res = await patchCatalogue(
        new Request("http://localhost:3001/api/admin/catalogues/" + dummyId, {
          method: "PATCH",
          body: JSON.stringify({ name: "Tampered" }),
        }),
        { params: Promise.resolve({ id: dummyId }) }
      );
      expect(res.status).toBe(401);
    });

    it("POST /api/admin/catalogues/[id]/listings -> 401 Unauthorized", async () => {
      const res = await postListings(
        new Request("http://localhost:3001/api/admin/catalogues/" + dummyId + "/listings", {
          method: "POST",
          body: JSON.stringify({ productIds: [dummyId] }),
        }),
        { params: Promise.resolve({ id: dummyId }) }
      );
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/badge-presets -> 401 Unauthorized", async () => {
      const res = await getBadgePresets();
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/search -> 401 Unauthorized", async () => {
      const res = await globalSearch(new Request("http://localhost:3001/api/admin/search?q=test"));
      expect(res.status).toBe(401);
    });

    it("GET /api/admin/products/search -> 401 Unauthorized", async () => {
      const res = await productSearch(new Request("http://localhost:3001/api/admin/products/search?query=test"));
      expect(res.status).toBe(401);
    });

    it("POST /api/uploads/presign -> 401 Unauthorized", async () => {
      const res = await presignUpload(
        new Request("http://localhost:3001/api/uploads/presign", {
          method: "POST",
          body: JSON.stringify({ fileName: "photo.jpg", contentType: "image/jpeg" }),
        })
      );
      expect(res.status).toBe(401);
    });
  });

  describe("Admin Server Actions reject signed-out callers with auth error", () => {
    const dummyId = "e2f0eb89-c978-477f-bf95-809f7524f373";

    it("setCatalogueStatus returns sign-in error", async () => {
      const res = await setCatalogueStatus(dummyId, "published");
      expect(res).toEqual({ error: "You need to sign in again." });
    });

    it("deleteCatalogue returns sign-in error", async () => {
      const res = await deleteCatalogue(dummyId);
      expect(res).toEqual({ error: "You need to sign in again." });
    });

    it("updateLeadStatus returns sign-in error", async () => {
      const res = await updateLeadStatus("ENQ-12345", "contacted");
      expect(res).toEqual({ error: "You need to sign in again." });
    });

    it("updateProductPrices returns sign-in error", async () => {
      const res = await updateProductPrices([{ id: dummyId, mrp: 100, offerPrice: 80 }]);
      expect(res).toEqual({ error: "You need to sign in again." });
    });

    it("archiveProducts returns sign-in error", async () => {
      const res = await archiveProducts([dummyId]);
      expect(res).toEqual({ error: "You need to sign in again." });
    });
  });
});
