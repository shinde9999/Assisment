import { describe, it, expect, vi, beforeEach } from "vitest";

// README guidance: "mocking @/auth"
vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth-guards", () => ({
  currentActor: vi.fn(),
  isAdmin: (actor: { role?: string } | null) => actor?.role === "admin",
}));

vi.mock("@/lib/prisma", () => ({
  getPrisma: vi.fn(() => ({
    catalogue: {
      delete: vi.fn().mockResolvedValue({ id: "mock-id", slug: "test-slug", name: "Test" }),
    },
  })),
}));

import { currentActor } from "@/auth-guards";
import { deleteCatalogue } from "@/app/admin/actions";

describe("FINDING 2: Privilege Escalation - Staff Role Can Delete Catalogue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should forbid staff members from deleting a catalogue", async () => {
    // Simulate actor with role: 'staff'
    vi.mocked(currentActor).mockResolvedValue({
      id: "staff-uuid",
      email: "staff@catalogue.test",
      role: "staff",
    });

    const result = await deleteCatalogue("c56a4180-65aa-42ec-a945-5fd21dec0538");

    // EXPECTED BEHAVIOR:
    // Only administrators are allowed to delete catalogues.
    // Staff members should receive an authorization error.
    //
    // ACTUAL BUG:
    // deleteCatalogue in src/app/admin/actions.ts lacks the `if (!isAdmin(actor))` check,
    // allowing any staff member to execute deletion and destroy catalogue data.
    expect(result.error, "Staff should be refused permission to delete catalogues").toBe(
      "Only an admin can delete a catalogue."
    );
  });
});
