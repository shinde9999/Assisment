# Findings

---

## 1. Confidential Draft Catalogue Search Data Leak (Security - Critical)

**What happens**  
Unauthenticated public visitors can search and view internal product names, SKUs, and negotiated offer prices from confidential draft catalogues via the public search API endpoint.

**Steps to reproduce**  
1. Send a `GET` request without any authentication or cookies to `/api/catalogues/festive-overstock-2026/search?q=a` (where `festive-overstock-2026` is an internal draft catalogue).
2. Inspect the HTTP response body.
3. Notice that the server returns HTTP `200 OK` with all matching products, their SKUs, and internal negotiated offer prices (`"matches": [{ "name": "Atlas cabin trolley", "sku": "TRV-1024", "offerPrice": "2499" }, ...]`).

**What should happen instead**  
The endpoint must verify `catalogue.status === "published"` and ensure the catalogue is not expired. If the catalogue is in `draft` status (or expired), it should return HTTP `404 Not Found` (or `403 Forbidden`) without disclosing any product or pricing data.

**Impact — how bad is this, and why?**  
**Critical.** This directly leaks confidential pre-release inventory and negotiated custom buyer pricing ("Northstar pricing") to competitors and unauthorized buyers on the public internet. Leaking pricing compromises sales negotiations and causes direct financial damage.

**Failing test**  
`tests/findings/bug-1-draft-catalogue-data-leak.test.ts` — `FINDING 1: Data Leak in Draft Catalogue Search > should NOT return products or pricing for draft/confidential catalogues`

---

## 2. Staff Role Can Delete Any Catalogue (Security / Authorization - Critical)

**What happens**  
Sales team members with the `staff` role can invoke the `deleteCatalogue` server action to permanently delete any catalogue, despite catalogue deletion being strictly restricted to the `admin` role.

**Steps to reproduce**  
1. Authenticate as a sales user with role `staff` (`staff@catalogue.test`).
2. Invoke the `deleteCatalogue(catalogueId)` server action in `src/app/admin/actions.ts`.
3. The server action executes successfully and deletes the catalogue and all its listings from PostgreSQL.

**What should happen instead**  
The server action must enforce role-based access control using `isAdmin(actor)`. If `!isAdmin(actor)`, the action must reject the call immediately with an authorization error (e.g. `{ error: "Only an admin can delete a catalogue." }`).

**Impact — how bad is this, and why?**  
**Critical.** Deleting a catalogue permanently destroys shareable buyer links, promo badge configurations, and product associations. While the UI hides the delete button for non-admins, permissions were not enforced on the server. Any staff member can delete catalogues either maliciously or accidentally via automated calls or console scripts.

**Failing test**  
`tests/findings/bug-2-staff-can-delete-catalogue.test.ts` — `FINDING 2: Privilege Escalation - Staff Role Can Delete Catalogue > should forbid staff members from deleting a catalogue`

---

## 3. Staff Role Can Publish Catalogues via API and Creation Action (Security / Authorization - High)

**What happens**  
Users with the `staff` role can publish draft catalogues to the public internet by sending a `PATCH` request to `/api/admin/catalogues/[id]` or by invoking `createCatalogueWithProducts` with `publish: true`.

**Steps to reproduce**  
1. Sign in as `staff@catalogue.test`.
2. Send `PATCH /api/admin/catalogues/[id]` with payload `{"status": "published", ...}` or invoke `createCatalogueWithProducts({ ..., publish: true })`.
3. The catalogue status is changed to `published` in the database without checking if the user is an admin.

**What should happen instead**  
Publishing is explicitly documented as an admin-only privilege ("staff is the sales team... admin can additionally publish a catalogue"). The server must enforce that `status === "published"` or `publish: true` is rejected with `403 Forbidden` unless `actor.role === "admin"`.

**Impact — how bad is this, and why?**  
**High.** Bypasses commercial governance. Staff can expose unapproved surplus pricing directly to the public internet without managerial review or approval.

**Failing test**  
`tests/findings/bug-3-staff-can-publish-catalogue.test.ts` — `FINDING 3: Privilege Escalation - Staff Role Can Publish Catalogue via API > should forbid staff from publishing a catalogue via PATCH /api/admin/catalogues/[id]`

---

## 4. Inverted Date Comparison in Catalogue Expiry Logic (Logic - High)

**What happens**  
Active catalogues with a validity date set in the future are incorrectly marked as `"expired"` in the admin portal and search, while catalogues whose validity date has already passed continue to display as active (`"published"`).

**Steps to reproduce**  
1. Create or edit a catalogue and set `validUntil` to a future date (e.g., 7 days from now).
2. Open `/admin/catalogues` or call `effectiveStatus("published", futureDate)`.
3. Observe that the status displays as `"expired"`.
4. Now check an expired catalogue (`monsoon-clearance-2026`, validity date in the past); observe that `effectiveStatus("published", pastDate)` returns `"published"`.

**What should happen instead**  
In `src/lib/catalogue-status.ts` line 10, the condition should check if the validity date has passed (`expiresAt < new Date()`), NOT if it is in the future (`expiresAt > new Date()`).

**Impact — how bad is this, and why?**  
**High.** Sales reps see active, live catalogues flagged as "Expired", preventing them from managing them properly. Simultaneously, truly expired clearances with obsolete inventory prices appear as "Live", misleading internal staff.

**Failing test**  
`tests/findings/bug-4-inverted-catalogue-expiry.test.ts` — `FINDING 4: Inverted Date Comparison in Catalogue Expiry Logic > should treat future validity dates as published and past dates as expired`

---

## 5. Insecure Direct Object Reference (IDOR) on Listing Mutation and Deletion (Security - High)

**What happens**  
An authenticated user can update or delete product listings belonging to Catalogue B by targeting the URL of Catalogue A: `/api/admin/catalogues/[catalogueA_Id]/listings/[listingId_From_CatalogueB]`.

**Steps to reproduce**  
1. Take two catalogues: Catalogue A (`id_A`) and Catalogue B (`id_B`).
2. Identify a listing ID (`listing_B`) that exists inside Catalogue B.
3. Send a `PATCH` or `DELETE` request to `/api/admin/catalogues/{id_A}/listings/{listing_B}`.
4. The server verifies that `id_A` exists, but executes `prisma.catalogueListing.updateMany({ where: { id: ids.listingId } })` and deletes/updates `listing_B` without scoping to `catalogueId: ids.id`.

**What should happen instead**  
The database query must scope mutations to both listing ID and catalogue ID: `where: { id: ids.listingId, catalogueId: ids.id }`. If the listing does not belong to the catalogue specified in the route, it must return `404 Not Found`.

**Impact — how bad is this, and why?**  
**High.** Breaks cross-catalogue data isolation. Users can inadvertently or maliciously delete or tamper with listings in catalogues they do not have authority over, and cache revalidation is triggered for the wrong catalogue.

**Failing test**  
`tests/findings/bug-5-cross-catalogue-listing-idor.test.ts` — `FINDING 5: IDOR / Cross-Catalogue Listing Manipulation > should reject modifying a listing that belongs to a different catalogue`

---

## 6. Orders and Enquiries Allowed Against Draft and Expired Catalogues (Business Logic - High)

**What happens**  
Buyers can submit binding enquiries with quantities against internal draft catalogues or expired catalogues via `POST /api/enquiries`.

**Steps to reproduce**  
1. Send a `POST` request to `/api/enquiries` containing items from `festive-overstock-2026` (status: `draft`) or `monsoon-clearance-2026` (status: `expired`).
2. Provide valid buyer contact details and valid quantities respecting MOQ.
3. Observe that the API accepts the enquiry with `201 Created`, creates database rows in `enquiries` and `enquiry_items`, and triggers team notification.

**What should happen instead**  
The server must verify that the target catalogue exists, has `status === "published"`, and is not expired (`expiresAt == null || expiresAt >= new Date()`). Submissions against draft or expired catalogues must be rejected with `400 Bad Request` or `403 Forbidden`.

**Impact — how bad is this, and why?**  
**High.** Leads and binding enquiries are generated against draft pricing (internal, tentative pricing) or expired clearance pricing that the business no longer supports. This leads to customer disputes and commercial losses when orders cannot be fulfilled at quoted rates.

**Failing test**  
`tests/findings/bug-6-enquiry-against-draft-or-expired.test.ts` — `FINDING 6: Enquiries Allowed Against Draft or Expired Catalogues > should reject enquiry submissions against draft/confidential catalogues`

---

## 7. Spreadsheet autoMap Greedy Substring Collisions (Data Integrity - Medium)

**What happens**  
During CSV product import, `autoMap` greedily matches substrings without word boundaries or priority ordering. A column titled `"Min Qty"` matches `"quantity"` (because `"quantity"` has synonym `"qty"` and appears before `"moq"`), leaving the true `"Quantity"` column unmapped or mapped to `"attribute"`. Similarly, `"Warranty Period"` maps to `"category"` because it contains the substring `"type"`.

**Steps to reproduce**  
1. Call `autoMap(["Min Qty", "Quantity"])`.
2. Inspect the resulting mapping: `"Min Qty"` is mapped to `"quantity"`, and `"Quantity"` is discarded / mapped to `"attribute"`.
3. Call `autoMap(["Warranty Period", "Category"])`: `"Warranty Period"` is mapped to `"category"` (due to `"type"` in `"warrantyperiod"`).

**What should happen instead**  
Matching should prioritize exact synonym matches before substring matching, sort candidate keys by descending length, or use word boundary matching. `"Min Qty"` should map to `moq`, `"Quantity"` to `quantity`, and `"Warranty Period"` to `attribute`.

**Impact — how bad is this, and why?**  
**Medium.** Mis-maps inventory columns upon import. Bulk sheets with minimum order quantities end up setting stock quantity to MOQ (e.g. 5 units instead of 5,000 units), disrupting the entire warehouse inventory and catalogue listing quantities.

**Failing test**  
`tests/findings/bug-7-automap-substring-collision.test.ts` — `FINDING 7: Spreadsheet autoMap Substring Collisions & Greedy Mis-mapping > should correctly map 'Min Qty' to moq and 'Quantity' to quantity`

---

## 8. Pricing Discount Calculation Falsiness on Free Items and Negative Discount Percent (Business Logic - Medium)

**What happens**  
`discountPercent` returns `0%` when `offerPrice === 0` (free promotional sample), and returns negative percentages (e.g. `-25%`) when `offerPrice > mrp`.

**Steps to reproduce**  
1. Call `discountPercent({ priceOnRequest: false, mrp: 500, offerPrice: 0 })`. Observe that it returns `0` instead of `100`.
2. Call `discountPercent({ priceOnRequest: false, mrp: 100, offerPrice: 125 })`. Observe that it returns `-25`.

**What should happen instead**  
1. `!offerPrice` in JavaScript evaluates to true for `0`, incorrectly short-circuiting to `0`. It should check `offerPrice === null || offerPrice === undefined`.
2. When `offerPrice > mrp`, discount percentage should clamp to `0` (or raise a pricing validation issue), never displaying negative discounts like `"-25% OFF"` on buyer-facing storefronts.

**Impact — how bad is this, and why?**  
**Medium.** Displays confusing, unprofessional information to buyers (`-25% OFF` or `0%` on 100% free promotional giveaways).

**Failing test**  
`tests/findings/bug-8-pricing-zero-and-negative-discount.test.ts` — `FINDING 8: Discount Calculation Edge Cases (0-Price Falsiness & Negative Discount)`
