import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/catalogues/[slug]/search/route";

describe("FINDING 1: Data Leak in Draft Catalogue Search", () => {
  it("should NOT return products or pricing for draft/confidential catalogues", async () => {
    // festive-overstock-2026 is seeded as status: 'draft' (confidential internal catalogue)
    const request = new Request("http://localhost:3001/api/catalogues/festive-overstock-2026/search?q=Atlas");
    const response = await GET(request, {
      params: Promise.resolve({ slug: "festive-overstock-2026" }),
    });

    const data = await response.json();

    // EXPECTED BEHAVIOR:
    // Draft catalogues must not be searchable by unauthenticated public users.
    // The endpoint should reject access (404 Not Found or 403 Forbidden).
    //
    // ACTUAL BUG:
    // The endpoint returns 200 OK with product names, SKUs, and negotiated offer prices,
    // leaking confidential pricing to the public internet.
    expect(response.status, "Draft catalogue search must return 404 or 403").toBe(404);
    expect(data.matches, "Draft catalogue products must not be returned").toBeUndefined();
  });
});
