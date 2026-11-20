# SplitSmart prototype

A small web app for splitting shared expenses inside a group: create groups, add members,
record who paid for what, and see who owes whom. Built with Next.js 15 (App Router), React 19,
TypeScript, Tailwind CSS 4, and Prisma 6 on SQLite.

## Run it

From this folder (`prototype/`):

```bash
npm install            # skip inside the dev container, dependencies are preinstalled
npm run db:push        # creates prisma/dev.db (or updates it) from prisma/schema.prisma
npm run db:seed        # optional: adds the "Apartment 4B" demo group; safe to run again
npm run dev            # http://localhost:3000
```

`DATABASE_URL` comes from `.env` (`DATABASE_URL="file:./dev.db"`). The dev container creates
that file; on a fresh clone outside the container create it by hand. `db:push` works on an
empty database and on a Lab 8 database that only has the `EnvironmentCheck` table. A versioned
migration also exists in `prisma/migrations/` for `npm run db:migrate` (`prisma migrate deploy`).

Other scripts: `npm test` (Vitest), `npm run lint`, `npm run build`.

## What it does

| Feature | Where |
|---------|-------|
| Create and select groups | `/` lists groups; the group page has a switcher |
| Add members (unique names per group) | Members card on `/groups/[id]` |
| Record an expense: description, amount, payer, participants | Record an expense card, with a live preview of each share |
| Expense history | Table at the bottom of the group page |
| Balances: paid, share, and net per member | Balances card; the net amounts always sum to zero |

Rules enforced on the server: amounts must be positive with at most two decimals (up to
$100,000.00); the payer and every participant must belong to the group; at least one participant
is required; blank names and descriptions are rejected; every error is shown next to the form.

## How it is built

```
prisma/schema.prisma        Group, Member, Expense, ExpenseShare (plus the Lab 8 EnvironmentCheck)
prisma/seed.mjs             idempotent demo data
src/lib/money.ts            parse "12.50" / "$1,234.56" into integer cents, format cents
src/lib/split.ts            equal split in cents; leftover cents go to the lowest member ids
src/lib/balances.ts         net balance per member = paid - share
src/lib/services.ts         validation and Prisma queries (create group, add member, record expense, ...)
src/lib/actions.ts          server actions used by the forms ("use server")
src/lib/db.ts               Prisma client singleton (server only)
src/app/page.tsx            groups list and create form
src/app/groups/[id]/        group page, loading skeleton, not-found page
src/components/             forms (client components) and small UI pieces
src/lib/*.test.ts           Vitest unit tests and SQLite integration tests
```

Money is stored and computed as integer cents, so a $10.00 expense shared by three people is
recorded as 334 + 333 + 333 cents, never as 3.3333. Database access only happens in server
components and server actions; the browser never loads Prisma.

## Prototype limits

No sign-in (everyone sees the same data), equal splits only (no percentage split), no payments
or settle-up, no approvals or notifications, no editing or deleting of expenses or members.
