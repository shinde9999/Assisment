import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock next/server after() so Vitest doesn't error outside Next.js request context
vi.mock("next/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/server")>();
  return {
    ...original,
    after: vi.fn(),
  };
});

import { getPrisma } from "@/lib/prisma";
import { POST } from "@/app/api/enquiries/route";

describe("Enquiry Validation and Processing (Integration)", () => {
  const prisma = getPrisma();
  let liveCatalogueId: string;
  let validProductId: string;
  let validProductMoq: number;
  let validProductStock: number;
  let validOfferPrice: number | null;

  beforeAll(async () => {
    // Locate the live published catalogue ('premium-corporate-essentials')
    const catalogue = await prisma.catalogue.findUnique({
      where: { slug: "premium-corporate-essentials" },
      include: {
        listings: {
          where: { isVisible: true },
          include: { product: true },
        },
      },
    });

    if (!catalogue || !catalogue.listings.length) {
      throw new Error("Seeded live catalogue 'premium-corporate-essentials' not found.");
    }

    liveCatalogueId = catalogue.id;
    const item = catalogue.listings[0];
    validProductId = item.productId;
    validProductMoq = item.product.moq;
    validProductStock = item.product.quantity;
    validOfferPrice = item.product.offerPrice ? Number(item.product.offerPrice) : null;
  });

  it("successfully creates an enquiry when all details, MOQ and stock are respected", async () => {
    const payload = {
      catalogueId: liveCatalogueId,
      name: "Acme Corp Buyer",
      company: "Acme Corporation",
      phone: "9876543210",
      email: "buyer@acmecorp.com",
      countryCode: "+91",
      location: "Pune, India",
      message: "Interested in corporate gifting",
      items: [
        {
          productId: validProductId,
          quantity: validProductMoq, // exactly MOQ
        },
      ],
    };

    const request = new Request("http://localhost:3001/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.reference).toMatch(/^ENQ-\d+$/);

    // Verify snapshot in database
    const createdEnquiry = await prisma.enquiry.findUnique({
      where: { reference: body.reference },
      include: { items: true },
    });

    expect(createdEnquiry).not.toBeNull();
    expect(createdEnquiry?.buyerName).toBe("Acme Corp Buyer");
    expect(createdEnquiry?.company).toBe("Acme Corporation");
    expect(createdEnquiry?.items).toHaveLength(1);
    expect(createdEnquiry?.items[0].requestedQuantity).toBe(validProductMoq);

    // Verify price snapshot
    if (validOfferPrice !== null) {
      expect(Number(createdEnquiry?.items[0].unitPrice)).toBe(validOfferPrice);
    }
  });

  it("rejects enquiry when requested quantity is less than MOQ (HTTP 400)", async () => {
    if (validProductMoq <= 1) return; // Only applicable if MOQ > 1

    const payload = {
      catalogueId: liveCatalogueId,
      name: "Under MOQ Buyer",
      email: "undermoq@example.com",
      phone: "9876543210",
      items: [
        {
          productId: validProductId,
          quantity: validProductMoq - 1, // Below MOQ!
        },
      ],
    };

    const request = new Request("http://localhost:3001/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("A requested quantity is outside the allowed range.");
  });

  it("rejects enquiry when requested quantity exceeds available stock (HTTP 400)", async () => {
    const payload = {
      catalogueId: liveCatalogueId,
      name: "Excessive Qty Buyer",
      email: "excessive@example.com",
      phone: "9876543210",
      items: [
        {
          productId: validProductId,
          quantity: validProductStock + 1000, // Exceeds stock!
        },
      ],
    };

    const request = new Request("http://localhost:3001/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("A requested quantity is outside the allowed range.");
  });

  it("rejects enquiry when neither phone nor email is supplied (HTTP 400)", async () => {
    const payload = {
      catalogueId: liveCatalogueId,
      name: "Ghost Buyer",
      phone: "",
      email: "",
      items: [{ productId: validProductId, quantity: validProductMoq }],
    };

    const request = new Request("http://localhost:3001/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Please check the enquiry details.");
  });

  it("rejects enquiry when items array is empty (HTTP 400)", async () => {
    const payload = {
      catalogueId: liveCatalogueId,
      name: "Empty Cart Buyer",
      email: "empty@example.com",
      items: [],
    };

    const request = new Request("http://localhost:3001/api/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
