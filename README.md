# SplitSmart

CIS 285 Software Engineering Tools.

SplitSmart is an expense-sharing application for friends, roommates, family members, and
coworkers. This repository holds its requirements (Lab 6) and its architecture and design
(Lab 7), developed with the GitHub Spec Kit CLI (`specify`), its Docker development
environment (Lab 8), and a working web prototype (Lab 9).

## Lab 9: SplitSmart Prototype

Branch: `feature/lab9-splitsmart-prototype`. Everything lives in [`prototype/`](prototype/);
its [README](prototype/README.md) has the run instructions and the file map.

### Features implemented

| Requirement | What the prototype does |
|-------------|-------------------------|
| FR1 Group management | Create a group from the home page; the home page lists every group with member count, expense count, and total spent; a group switcher on the group page |
| FR2 Member management | Add members to a group (names unique within the group); member list on the group page |
| FR3 Expense recording | Description, amount, payer, and participant chips (all members selected by default); live preview of each member's share before saving |
| FR4 Expense history | Newest-first table with time, description, payer, each participant's share, and amount |
| FR5 Balance calculation | Per member: paid, share, and net (`paid - share`); the net amounts always sum to zero |

Business rules: equal split in integer cents; leftover cents go one each to the participants
with the lowest member ids, so the result does not depend on selection order; amounts must be
positive with at most two decimal places (at most $100,000.00, per the spec's FR-016); the payer
and every participant must belong to the group; blank names and descriptions are rejected; the
server validates everything and the forms show the message next to the field. Data lives in
SQLite through Prisma and survives a browser refresh and a server restart.

### Major files created or modified

| File | Purpose |
|------|---------|
| `prototype/prisma/schema.prisma` | `Group`, `Member`, `Expense`, `ExpenseShare` models (the Lab 8 `EnvironmentCheck` model is kept) |
| `prototype/prisma/migrations/20261119233721_init_splitsmart/` | SQL migration for the schema |
| `prototype/prisma/seed.mjs` | Idempotent demo data (`npm run db:seed`) |
| `prototype/src/lib/money.ts` | Dollar text to integer cents and back |
| `prototype/src/lib/split.ts` | Deterministic equal split in cents |
| `prototype/src/lib/balances.ts` | Net balance per member |
| `prototype/src/lib/services.ts` | Validation and all Prisma queries |
| `prototype/src/lib/actions.ts` | Server actions behind the three forms |
| `prototype/src/lib/db.ts`, `form-state.ts`, `errors.ts` | Prisma singleton, form state type, user-facing error types |
| `prototype/src/app/page.tsx` | Home: group list and create-group form |
| `prototype/src/app/groups/[id]/page.tsx` (+ `loading.tsx`, `not-found.tsx`) | Group page: members, balances, expense form, history |
| `prototype/src/app/layout.tsx`, `globals.css`, `error.tsx`, `loading.tsx` | App shell, light/dark theme, error and loading states |
| `prototype/src/components/*.tsx` | `CreateGroupForm`, `AddMemberForm`, `ExpenseForm`, `GroupSwitcher`, `SubmitButton`, shared UI pieces |
| `prototype/src/lib/split.test.ts`, `services.test.ts`, `vitest.config.mts` | Tests (see below) |
| `prototype/package.json` | Scripts: `test`, `db:push`, `db:migrate`, `db:seed` |
| `prototype/README.md` | Prototype run instructions |

### Running the application

```bash
cd prototype
npm run db:push     # create or update prisma/dev.db
npm run db:seed     # optional demo group
npm run dev         # open http://localhost:3000
```

Requires `prototype/.env` with `DATABASE_URL="file:./dev.db"` (the dev container creates it).

### Test results

Automated, `npm test` (Vitest 5.1.0, Node 24, 2026-11-19): **22 passed, 0 failed** in two files.
`split.test.ts` covers the split, money parsing, and balance math in isolation;
`services.test.ts` runs the real service layer against a throwaway SQLite database.

| Required check | How it was verified | Result |
|----------------|--------------------|--------|
| A group can be created | `services.test.ts` "creates a group and lists it"; browser: created "Lab 9 Test" | Pass |
| Three members can be added | `services.test.ts` "adds three members"; browser: Alice, Bob, Charlie added, duplicate "Alice" rejected | Pass |
| $60 shared by three gives Alice +$40, Bob -$20, Charlie -$20 | `split.test.ts` and `services.test.ts` "$60 expense"; browser: balances card showed +$40.00 / -$20.00 / -$20.00 | Pass |
| Multiple expenses update balances correctly | `services.test.ts` "multiple expenses"; browser: after a second $10 expense paid by Bob, balances were +$36.66 / -$13.33 / -$23.33 | Pass |
| Invalid amounts and member ids are rejected | `services.test.ts` "rejects invalid amounts" (`0`, `-5`, `abc`, empty, `12.345`) and "rejects payers and participants who are not in the group" (member of another group, unknown id, non-numeric id); browser: `-5` and `abc` showed the error and saved nothing | Pass |
| Data persists after refreshing the browser | `services.test.ts` "persists data across client instances"; browser: reloaded `/groups/2`, both expenses and balances still there | Pass |
| $10 shared by three is allocated to the cent | `split.test.ts` and `services.test.ts`: 334 + 333 + 333 cents; browser: history row shows Alice $3.34, Bob $3.33, Charlie $3.33 | Pass |
| All balances sum to zero | asserted in `split.test.ts` and `services.test.ts`; `split.test.ts` also checks every amount from 1 to 500 cents across 1 to 7 participants sums exactly | Pass |

Also run: `npm run lint` (clean), `npx tsc --noEmit` (clean), `npm run build` (succeeds), and a
manual pass at phone width (375 px) and in light and dark mode.

### Known issues and incomplete functionality

- Equal splits only; percentage splits, payments or settle-up, approvals, notifications, reports,
  and sign-in from the full specification are not in the prototype.
- Expenses and members cannot be edited or deleted.
- A wrong group id renders the "Group not found" page but, because the page streams behind a
  loading skeleton, the HTTP status is 200 rather than 404.
- The expense history table scrolls horizontally on narrow phones.

## Lab 8: Development Environment

| Item | Where |
|------|-------|
| Dev container | [`.devcontainer/Dockerfile`](.devcontainer/Dockerfile) and [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json): Node.js 22, Next.js 15, React, TypeScript, Tailwind CSS, Prisma 6 with SQLite, Vitest |
| Starter application | [`prototype/`](prototype/): the unmodified Next.js starter, copied in by the container's `init-splitsmart` script |
| Environment-check model | [`prototype/prisma/schema.prisma`](prototype/prisma/schema.prisma): `EnvironmentCheck` only; the SplitSmart data model comes in Lab 9 |
| Ignored files | [`.gitignore`](.gitignore): `node_modules/`, `.next/`, `.env`, and the SQLite database are not committed |

Changes to the provided Dockerfile:

- The workspace paths (`TARGET` in `init-splitsmart`, and the final `WORKDIR`) point at
  `/workspaces/SplitSmart`, the folder this repository is cloned into.
- `init-splitsmart` also restores `prototype/.env` and creates `prototype/prisma/dev.db` when
  they are missing. Both are gitignored, so a fresh clone of this repository has neither, and
  because `prototype/` is already committed the script skips its template copy. Without them,
  `npx prisma --version` and `npx prisma validate` fail with
  `Missing required environment variable: DATABASE_URL`.

Open it: start Docker, then in VS Code run **Dev Containers: Clone Repository in Container
Volume** with `https://github.com/ibdeir12/SplitSmart.git` (branch `main`).

Verification, run inside the container from `prototype/`:

| Check | Command | Result |
|-------|---------|--------|
| Tool versions | `node --version`, `npm --version`, `npx next --version`, `npx prisma --version`, `npx vitest --version` | v22.23.4, 10.9.9, Next.js v15.5.29, prisma 6.19.3, vitest/5.1.0 |
| Prisma schema | `npx prisma validate` | The schema at prisma/schema.prisma is valid |
| SQLite database | `sqlite3 prisma/dev.db ".tables"` | `EnvironmentCheck` |
| Starter application | `npm run dev -- --hostname 0.0.0.0` | Next.js starter page at http://localhost:3000 |

## Lab 7: Architecture and Design

| Step | What was done | Deliverable |
|------|---------------|-------------|
| 1. Base architecture | Spec Kit `/speckit-plan` on the Lab 6 specification ([commit 44b2bbb](https://github.com/ibdeir12/SplitSmart/commit/44b2bbb)) | Architecture A: layered Swing desktop monolith over embedded H2. [`plan.md` as generated](https://github.com/ibdeir12/SplitSmart/blob/44b2bbb/specs/001-splitsmart-expense-sharing/plan.md), with `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| 2. Alternative architecture | Independent alternative design ([commit d898040](https://github.com/ibdeir12/SplitSmart/commit/d898040)) | Architecture B: hexagonal core, REST server, PostgreSQL ledger. [`docs/architecture/alternative-architecture.md`](docs/architecture/alternative-architecture.md) |
| 3. Review of both | Requirement coverage, constitution check, defects, scores ([commit 87e947f](https://github.com/ibdeir12/SplitSmart/commit/87e947f)) | [Review of A](docs/architecture/reviews/review-architecture-A-base.md), [Review of B](docs/architecture/reviews/review-architecture-B-alternative.md), [Comparison and recommendation](docs/architecture/reviews/comparison-and-recommendation.md) |
| 4. Decision | Architecture A chosen, five ideas adopted from B ([commit 2961a7b](https://github.com/ibdeir12/SplitSmart/commit/2961a7b)) | [`docs/architecture/decision.md`](docs/architecture/decision.md) (ADR-001) |
| 5. Consolidation instructions | Ordered instructions to update requirements, architecture, design | [`docs/architecture/consolidation-instructions.md`](docs/architecture/consolidation-instructions.md) |
| 6. Consolidated documents | Instructions applied | Updated requirements: [`spec.md`](specs/001-splitsmart-expense-sharing/spec.md). Updated architecture: [`plan.md`](specs/001-splitsmart-expense-sharing/plan.md), [`research.md`](specs/001-splitsmart-expense-sharing/research.md), [`quickstart.md`](specs/001-splitsmart-expense-sharing/quickstart.md). Updated design: [`data-model.md`](specs/001-splitsmart-expense-sharing/data-model.md), [`contracts/`](specs/001-splitsmart-expense-sharing/contracts/), [`docs/design/design.md`](docs/design/design.md) |

### UML diagrams (PlantUML sources and rendered PNGs in [`docs/design/diagrams/`](docs/design/diagrams/))

| Diagram | Source |
|---------|--------|
| Class diagram: domain model | [`class-domain.puml`](docs/design/diagrams/class-domain.puml) |
| Class diagram: services and ports | [`class-services-ports.puml`](docs/design/diagrams/class-services-ports.puml) |
| Component diagram | [`component.puml`](docs/design/diagrams/component.puml) |
| Deployment diagram | [`deployment.puml`](docs/design/diagrams/deployment.puml) |
| Activity: record an expense | [`activity-record-expense.puml`](docs/design/diagrams/activity-record-expense.puml) |
| Activity: approve or reject an expense | [`activity-approve-expense.puml`](docs/design/diagrams/activity-approve-expense.puml) |
| Activity: record and confirm a payment | [`activity-record-payment.puml`](docs/design/diagrams/activity-record-payment.puml) |
| Activity: remove a member or leave a group | [`activity-remove-member.puml`](docs/design/diagrams/activity-remove-member.puml) |
| Sequence: approve an expense | [`sequence-approve-expense.puml`](docs/design/diagrams/sequence-approve-expense.puml) |

Render: `java -jar plantuml.jar -tpng docs/design/diagrams/*.puml` (PlantUML 1.2025.4, Graphviz).

## Lab 6: Requirements

| Step | Command | Deliverable |
|------|---------|-------------|
| Setup | `uv tool install specify-cli`, `specify init . --integration copilot` | Spec Kit project |
| Customer input | n/a | [`UserRequirement.md`](UserRequirement.md): the original customer request (never edited) |
| Step 1 | `/speckit-constitution` | [`.specify/memory/constitution.md`](.specify/memory/constitution.md): engineering principles |
| Step 2 | `/speckit-specify` | [`specs/001-splitsmart-expense-sharing/spec.md`](specs/001-splitsmart-expense-sharing/spec.md): feature specification |
| Step 2 | `/speckit-specify` | [`specs/001-splitsmart-expense-sharing/checklists/requirements.md`](specs/001-splitsmart-expense-sharing/checklists/requirements.md): spec quality checklist |
| Step 3 | `/speckit-clarify` | The `Clarifications` section of the spec: 9 decisions, each confirmed by a person |

The specification keeps every customer feature in its Requirements Inventory (CR-01 to CR-10) and
tags each functional requirement either **[MVP]** (the Java Swing desktop subset) or **[Deferred]**
(for example the web, Android, and iOS clients).
