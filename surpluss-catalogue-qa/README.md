# Surpluss Catalogue — QA Automation Assessment

This is a trimmed copy of an internal Surpluss tool: a **product catalogue builder**. Our sales team uses it to assemble catalogues of surplus inventory, share them with buyers, and collect enquiries.

Everything here runs on your machine. It does not connect to any Surpluss system, and the data is entirely made up.

---

## Setup

You need **Node 20+** and **Docker** (or PostgreSQL on port 5544).

```bash
cp .env.example .env
npm install
docker compose up -d          # Postgres on localhost:5544
npm run db:deploy             # apply migrations
npm run db:seed               # load sample data and sign-in accounts
npm run dev                   # http://localhost:3001
```

To wipe and start over at any point:

```bash
npm run db:reset
```

### Sign-in accounts

These are seeded local accounts. The passwords are in this file on purpose — the database is disposable and never leaves your laptop.

| Email | Password | Role |
| --- | --- | --- |
| `admin@catalogue.test` | `Admin#2026` | admin |
| `staff@catalogue.test` | `Staff#2026` | staff |

**The two roles are not the same, and the difference matters.** `staff` is the sales team: they build catalogues, manage products and work leads. `admin` can additionally **publish** a catalogue and **delete** one — the two actions that either expose pricing to the public internet or destroy lead history.

---

## Running the tests

```bash
npm run test          # Vitest — unit, integration, API (55 tests passing)
npm run test:findings # Vitest — reproduces all 8 documented bug findings
npm run test:e2e      # Playwright — starts the dev server and runs buyer journey
npm run typecheck
npm run lint
```

### Key Deliverables:
- **`FINDINGS.md`**: Complete report of 8 discovered bugs (security vulnerabilities, access control flaws, and logic bugs) with steps to reproduce and failing automated tests.
- **`WRITEUP.md`**: Full technical write-up detailing testing strategy, risk analysis, Playwright E2E architecture, AI usage disclosures, architectural critique, and bonus tasks.
- **`tests/`**: Unit, integration, API, and findings test suites.
- **`e2e/`**: Playwright end-to-end buyer journey.
