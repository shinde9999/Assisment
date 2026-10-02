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
      update: vi.fn().mockResolvedValue({ id: "mock-id", slug: "test", name: "Test Catalogue" }),
    },
    enquiry: {
      update: vi.fn().mockResolvedValue({ id: "mock-id", reference: "ENQ-12345", status: "contacted" }),
    },
  })),
}));

import { auth } from "@/auth";
import { setCatalogueStatus } from "@/app/admin/actions";
import { updateLeadStatus } from "@/app/admin/leads/actions";

describe("API & Server Actions: Role-Based Access Control (Admin vs Staff)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setCatalogueStatus (Server Action)", () => {
    it("refuses permission when a staff user attempts to change catalogue status", async () => {
      (auth as unknown as Mock).mockResolvedValue({
        user: { id: "staff-id", email: "staff@catalogue.test", role: "staff" },
        expires: "2026-12-31",
      });

      const result = await setCatalogueStatus("c56a4180-65aa-42ec-a945-5fd21dec0538", "published");
      expect(result).toEqual({ error: "Only an admin can change what is published." });
    });

    it("allows an admin user to change catalogue status", async () => {
      (auth as unknown as Mock).mockResolvedValue({
        user: { id: "admin-id", email: "admin@catalogue.test", role: "admin" },
        expires: "2026-12-31",
      });

      const result = await setCatalogueStatus("c56a4180-65aa-42ec-a945-5fd21dec0538", "published");
      expect(result).toEqual({ ok: true, name: "Test Catalogue" });
    });
  });

  describe("updateLeadStatus (Server Action)", () => {
    it("allows staff users to work leads and change status to contacted", async () => {
      (auth as unknown as Mock).mockResolvedValue({
        user: { id: "staff-id", email: "staff@catalogue.test", role: "staff" },
        expires: "2026-12-31",
      });

      const result = await updateLeadStatus("ENQ-12345", "contacted");
      expect(result).toEqual({ ok: true });
    });

    it("allows admin users to update lead status as well", async () => {
      (auth as unknown as Mock).mockResolvedValue({
        user: { id: "admin-id", email: "admin@catalogue.test", role: "admin" },
        expires: "2026-12-31",
      });

      const result = await updateLeadStatus("ENQ-12345", "qualified");
      expect(result).toEqual({ ok: true });
    });
  });
});
