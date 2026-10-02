import { describe, it, expect, vi } from "vitest";

// Mock next/server's after() to prevent Next.js request context error in Vitest
vi.mock("next/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/server")>();
  return {
    ...original,
    after: vi.fn(() => {
      // Do not run background notification in unit test
    }),
  };
});

import { getPrisma } from "@/lib/prisma";
import { POST } from "@/app/api/enquiries/route";

describe("FINDING 6: Enquiries Allowed Against Draft or Expired Catalogues", () => {
  it("should reject enquiry submissions against draft/confidential catalogues", async () => {
    const prisma = getPrisma();

    // Find the seeded draft catalogue ('festive-overstock-2026')
    const draftCatalogue = await prisma.catalogue.findUnique({
      where: { slug: "festive-overstock-2026" },
      include: {
        listings: {
          where: { isVisible: true },
          take: 1,
          include: { product: true },
        },
      },
    });

    expect(draftCatalogue, "Draft catalogue must exist").not.toBeNull();
    const listing = draftCatalogue!.listings[0];
    expect(listing, "Draft catalogue must have at least one listing").toBeDefined();

    const payload = {
      catalogueId: draftCatalogue!.id,
      name: "Test Buyer",
      email: "buyer@example.com",
      phone: "9876543210",
      countryCode: "+91",
      items: [{ productId: listing.productId, quantity: listing.product.moq }],
    };

    const request = new Request("http://localhost:3001/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    const data = await response.json();

    // EXPECTED BEHAVIOR:
    // Draft catalogues are confidential and not open for public orders.
    // Submitting enquiries against draft catalogues should be rejected with 400 Bad Request or 403 Forbidden.
    //
    // ACTUAL BUG:
    // POST /api/enquiries only checks if listings exist. It does NOT check `catalogueRecord.status === 'published'`.
    // It accepts the lead with 201 Created and saves it to the database against unapproved draft pricing!
    expect(response.status, "Enquiry against draft catalogue should be rejected").toBe(400);
    expect(data.ok, "Should not return ok: true for draft catalogue enquiry").toBeUndefined();
  });
});
