import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/incomplete", () => ({
  findIncompleteProducts: vi.fn().mockResolvedValue([]),
  incompleteMessage: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => ({
    catalogue: {
      findUnique: vi.fn().mockResolvedValue({
        id: "c56a4180-65aa-42ec-a945-5fd21dec0538",
        slug: "test-catalogue",
        status: "draft",
      }),
      update: vi.fn().mockResolvedValue({
        id: "c56a4180-65aa-42ec-a945-5fd21dec0538",
        slug: "test-catalogue",
        name: "Test Catalogue",
        status: "published",
        description: "",
        category: null,
        notifyNumber: null,
        banners: [],
        expiresAt: null,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { listings: 0, enquiries: 0 },
        listings: [],
      }),
    },
  })),
}));

import { auth } from "@/auth";
import { PATCH } from "@/app/api/admin/catalogues/[id]/route";

describe("FINDING 3: Privilege Escalation - Staff Role Can Publish Catalogue via API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should forbid staff from publishing a catalogue via PATCH /api/admin/catalogues/[id]", async () => {
    // Simulate authenticated session for a STAFF user
    (auth as unknown as Mock).mockResolvedValue({
      user: {
        id: "staff-uuid",
        email: "staff@catalogue.test",
        role: "staff",
      },
      expires: "2026-12-31",
    });

    const body = {
      name: "Test Catalogue",
      slug: "test-catalogue",
      description: "Test description",
      category: "",
      notifyNumber: "",
      status: "published", // Attempting to publish
      validUntil: null,
      banners: [],
    };

    const request = new Request("http://localhost:3001/api/admin/catalogues/c56a4180-65aa-42ec-a945-5fd21dec0538", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "c56a4180-65aa-42ec-a945-5fd21dec0538" }),
    });

    // EXPECTED BEHAVIOR:
    // Publishing a catalogue exposes inventory pricing to the public internet.
    // The server must enforce role checks: only admin users can publish.
    // Staff requests with status === "published" must return 403 Forbidden.
    //
    // ACTUAL BUG:
    // PATCH /api/admin/catalogues/[id] only checks if (!session) and does NOT check
    // if session.user.role === 'admin'. Thus, staff users can publish any catalogue.
    expect(response.status, "Staff should be forbidden from publishing catalogues").toBe(403);
  });
});
