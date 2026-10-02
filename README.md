# QA Automation Engineer — Assessment Submission
### Surpluss (WSYS Platform Private Limited) · Pune

Candidate Submission for the **QA Automation Engineer** role at **Surpluss**.

This repository contains the complete assessment solution, including automated test suites, documented security and logic findings, an end-to-end Playwright buyer journey, technical write-up, and a GitHub Actions CI pipeline.

---

## 📌 Quick Links to Deliverables

| Deliverable | Path | Description |
| :--- | :--- | :--- |
| **Task 1: Bug Findings** | [`surpluss-catalogue-qa/FINDINGS.md`](./surpluss-catalogue-qa/FINDINGS.md) | 8 real bugs documented with reproduction steps, business impact, and failing tests |
| **Tasks 2–5: Technical Write-Up** | [`surpluss-catalogue-qa/WRITEUP.md`](./surpluss-catalogue-qa/WRITEUP.md) | Strategy, riskiest area, Playwright stability, AI disclosures, and bonus analyses |
| **Task 2 & 3: Test Suites** | [`surpluss-catalogue-qa/tests/`](./surpluss-catalogue-qa/tests/) | 55 unit, integration, and API access-control tests in Vitest |
| **Task 4: Playwright E2E** | [`surpluss-catalogue-qa/e2e/buyer-journey.spec.ts`](./surpluss-catalogue-qa/e2e/buyer-journey.spec.ts) | Automated complete buyer journey from discovery to Admin Leads Inbox |
| **Bonus 1: CI Pipeline** | [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) | GitHub Actions CI workflow running typecheck, lint, test suite, and E2E |

---

## 🧪 Test Execution Summary

| Test Suite | Location | Tests | Status | Description |
| :--- | :--- | :---: | :---: | :--- |
| **Core Test Suite** | `tests/unit`, `tests/integration`, `tests/api` | **55** | ✅ **55 Passed** | Unit logic, pricing, import mapping, API role authorization, IDOR guards, enquiry validation |
| **Bug Regression Suite** | `tests/findings/` | **10** | ❌ **10 Failed** *(Expected)* | Automated reproduction tests verifying all 8 reported bugs on this unpatched build |
| **E2E Buyer Journey** | `e2e/buyer-journey.spec.ts` | **1** | ✅ **Passed** | End-to-end Playwright journey: Browse catalogue → Add MOQ items → Submit enquiry → Verify in Admin Inbox |

---

## 🚀 How to Run the Tests Locally

### Prerequisites
- Node.js 20+
- PostgreSQL cluster running on `localhost:5544` (or run `docker compose up -d` inside `surpluss-catalogue-qa`)

```bash
# 1. Navigate into the project folder
cd surpluss-catalogue-qa

# 2. Configure environment
cp .env.example .env

# 3. Install dependencies
npm ci

# 4. Prepare database
npm run db:deploy
npm run db:seed

# 5. Run the core test suite (55 tests passing)
npm run test

# 6. Run the bug reproduction tests (reproduces all 8 documented findings)
npm run test:findings

# 7. Run the Playwright E2E buyer journey test
npx playwright install --with-deps chromium
npm run test:e2e
```

---

## 🛡️ Summary of Discovered Bugs (Task 1 & Task 3)

Detailed in [`surpluss-catalogue-qa/FINDINGS.md`](./surpluss-catalogue-qa/FINDINGS.md):

1. **Confidential Draft Catalogue Data Leak (Security - Critical)**: Unauthenticated public visitors can search and view internal product names, SKUs, and negotiated offer prices from confidential draft catalogues via `/api/catalogues/[slug]/search`.
2. **Staff Role Can Delete Any Catalogue (Security - Critical)**: Sales team members (`staff`) can invoke the `deleteCatalogue` server action to permanently delete any catalogue without admin privileges.
3. **Staff Role Can Publish Catalogues (Security - High)**: Staff users can publish unapproved draft catalogues to the live internet via `PATCH /api/admin/catalogues/[id]` or `createCatalogueWithProducts({ publish: true })`.
4. **Inverted Date Comparison in Catalogue Expiry Logic (Logic - High)**: Future catalogues display as `"expired"` while expired catalogues remain active due to an inverted date comparison (`expiresAt > new Date()`).
5. **Insecure Direct Object Reference (IDOR) on Listing Mutation (Security - High)**: `PATCH /api/admin/catalogues/[id]/listings/[listingId]` mutates listings belonging to other catalogues without scoping queries to `catalogueId`.
6. **Enquiries Allowed Against Draft & Expired Catalogues (Business Logic - High)**: Buyers can submit binding commercial enquiries against draft/confidential or expired catalogues via `/api/enquiries`.
7. **Spreadsheet autoMap Greedy Substring Collisions (Data Integrity - Medium)**: Greedy synonym matching causes columns like `"Min Qty"` to overwrite `"quantity"` and `"Warranty Period"` to map to `"category"`.
8. **Pricing Discount Falsiness on Free Items & Negative Discount (Business Logic - Medium)**: Free promotional products (`offerPrice === 0`) show `0% OFF` instead of `100% OFF`, and items where `offerPrice > mrp` produce negative discount percentages (`-25% OFF`).

---

## 📂 Repository Layout

```
.
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions CI workflow
├── surpluss-catalogue-qa/         # Main Next.js project
│   ├── FINDINGS.md                # Task 1: Complete bug findings report
│   ├── WRITEUP.md                 # Tasks 2–5 & Bonus tasks write-up
│   ├── e2e/
│   │   └── buyer-journey.spec.ts  # Task 4: Playwright E2E test
│   ├── tests/
│   │   ├── unit/                  # Task 2: Pricing, import mapping, catalogue lifecycle
│   │   ├── integration/           # Task 2: Enquiry validation & processing
│   │   ├── api/                   # Task 3: Auth guards, role authorization, payload tampering
│   │   └── findings/              # Task 1: Automated reproduction tests for bugs 1–8
│   ├── src/                       # Application source code
│   ├── prisma/                    # Schema, migrations, and seed scripts
│   └── package.json               # NPM scripts and dependencies
├── .gitignore                     # Repository-level ignore rules
└── README.md                      # This file
```
