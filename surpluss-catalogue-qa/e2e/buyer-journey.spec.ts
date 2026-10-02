import { test, expect } from "@playwright/test";

test.describe("Complete Buyer Journey End-to-End", () => {
  test("Open published catalogue -> Browse product -> Submit enquiry -> Verify in Admin Leads Inbox", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const uniqueBuyerName = `QA Tester ${timestamp}`;
    const uniquePhone = "9876543210";
    const testReferral = `Campaign Test ${timestamp}`;

    // -------------------------------------------------------------------------
    // Step 1: Open the published catalogue
    // -------------------------------------------------------------------------
    await page.goto("/catalogue/premium-corporate-essentials");

    // Wait for the catalogue client to render and check heading
    const catalogueHeader = page.locator("header");
    await expect(catalogueHeader).toBeVisible();

    // -------------------------------------------------------------------------
    // Step 2: Browse products and select the first product
    // -------------------------------------------------------------------------
    const productLinks = page.locator("article a[href*='/product/']");
    await expect(productLinks.first()).toBeVisible({ timeout: 15_000 });

    // Click on the first product card to view product details
    await productLinks.first().click();
    await page.waitForURL("**/product/**");

    // Verify product detail page loaded
    const productHeading = page.locator("h1");
    await expect(productHeading).toBeVisible();
    const productName = await productHeading.textContent();
    expect(productName).toBeTruthy();

    // -------------------------------------------------------------------------
    // Step 3: Open the Contact Supplier / Enquiry Dialog
    // -------------------------------------------------------------------------
    // Click the Contact Us CTA button (desktop or mobile)
    const contactCta = page.getByRole("button", {
      name: /Contact Us|Contact Supplier|Get Offer Price/i,
    });
    await expect(contactCta.first()).toBeVisible();
    await contactCta.first().click();

    // -------------------------------------------------------------------------
    // Step 4: Fill enquiry details and submit
    // -------------------------------------------------------------------------
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Fill buyer details
    const nameInput = page.locator("#contact-name");
    const phoneInput = page.locator("#contact-phone");
    const referralInput = page.locator("#referral-person");

    await expect(nameInput).toBeVisible();
    await nameInput.fill(uniqueBuyerName);
    await phoneInput.fill(uniquePhone);
    await referralInput.fill(testReferral);

    // Submit the enquiry
    const sendButton = dialog.getByRole("button", { name: "Send enquiry" });
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // -------------------------------------------------------------------------
    // Step 5: Verify confirmation screen & capture Enquiry Reference
    // -------------------------------------------------------------------------
    await expect(page.getByText("Enquiry sent")).toBeVisible({ timeout: 10_000 });

    const refElement = page.getByText(/ENQ-\d+/);
    await expect(refElement).toBeVisible();
    const generatedReference = (await refElement.textContent())?.trim();
    expect(generatedReference).toMatch(/^ENQ-\d+$/);

    // Close the dialog
    await page.keyboard.press("Escape");

    // -------------------------------------------------------------------------
    // Step 6: Sign in as Admin to verify the lead in the Admin Leads Inbox
    // -------------------------------------------------------------------------
    await page.goto("/login");

    await page.locator("#email").fill("admin@catalogue.test");
    await page.locator("#password").fill("Admin#2026");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Wait for successful admin authentication and redirection
    await page.waitForURL("**/admin**");

    // -------------------------------------------------------------------------
    // Step 7: Navigate to Admin Leads Inbox and verify enquiry presence
    // -------------------------------------------------------------------------
    await page.goto("/admin/leads");

    // Confirm Leads Inbox header is rendered
    await expect(page.getByRole("heading", { name: "Leads" })).toBeVisible();

    // Filter leads table by unique buyer name
    const searchInput = page.locator("input[placeholder*='Search buyer']");
    await expect(searchInput).toBeVisible();
    await searchInput.fill(uniqueBuyerName);

    // Confirm that the submitted enquiry appears in the table with correct details
    const leadsTable = page.locator("table");
    await expect(leadsTable).toContainText(uniqueBuyerName);

    if (generatedReference) {
      await expect(leadsTable).toContainText(generatedReference);
    }

    // Confirm lead status is "New"
    await expect(leadsTable).toContainText("New");
  });
});
