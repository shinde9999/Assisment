import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// Mock revalidateCatalogue helper
vi.mock("@/app/api/admin/catalogues/[id]/listings/helpers", () => ({
  revalidateCatalogue: vi.fn(),
}));

const mockUpdateMany = vi.fn();
const mockDeleteMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => ({
    catalogue: {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        // Catalogue A exists
        if (where.id === "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d") {
          return Promise.resolve({ id: where.id, slug: "catalogue-a" });
        }
        return Promise.resolve(null);
      }),
    },
    catalogueListing: {
      updateMany: mockUpdateMany,
      deleteMany: mockDeleteMany,
    },
  })),
}));

import { auth } from "@/auth";
import { PATCH } from "@/app/api/admin/catalogues/[id]/listings/[listingId]/route";

describe("FINDING 5: IDOR / Cross-Catalogue Listing Manipulation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as unknown as Mock).mockResolvedValue({
      user: { id: "user-1", email: "admin@catalogue.test", role: "admin" },
      expires: "2026-12-31",
    });
  });

  it("should reject modifying a listing that belongs to a different catalogue", async () => {
    const catalogueA_Id = "a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d";
    const listingInCatalogueB_Id = "b2c3d4e5-f6a1-4b2c-9d3e-4f5a6b7c8d9e";

    // Simulate listing belonging to Catalogue B being updated
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const request = new Request(
      `http://localhost:3001/api/admin/catalogues/${catalogueA_Id}/listings/${listingInCatalogueB_Id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisible: false }),
      }
    );

    const response = await PATCH(request, {
      params: Promise.resolve({ id: catalogueA_Id, listingId: listingInCatalogueB_Id }),
    });
    expect(response).toBeDefined();

    // EXPECTED BEHAVIOR:
    // When an ID in a URL is swapped or a listing belongs to a different catalogue,
    // the server must scope the query to `where: { id: listingId, catalogueId: id }`.
    // It should NOT update a listing belonging to another catalogue.
    //
    // ACTUAL BUG:
    // In src/app/api/admin/catalogues/[id]/listings/[listingId]/route.ts line 45:
    // prisma.catalogueListing.updateMany({ where: { id: ids.listingId } })
    // and line 74: deleteMany({ where: { id: ids.listingId } })
    // The query completely omits `catalogueId: ids.id`.
    expect(
      mockUpdateMany,
      "Update must scope the listing to the specific catalogue ID in the URL"
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: listingInCatalogueB_Id,
          catalogueId: catalogueA_Id,
        }),
      })
    );
  });
});
