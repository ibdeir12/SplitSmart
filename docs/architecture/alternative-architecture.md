# Alternative Architecture: Hexagonal Core with a Client–Server Split

**Date**: 2026-11-05 | **Spec**: [spec.md](../../specs/001-splitsmart-expense-sharing/spec.md) |
**Compared with**: [base plan](../../specs/001-splitsmart-expense-sharing/plan.md) (Spec Kit
`/speckit-plan`)

## 1. Summary

The base plan builds the MVP as a single desktop process that owns its database. This
alternative designs for the customer's full scope from day one (CR-10: web first, plus Android
and iOS) while still shipping the Java Swing client as the first front end:

- a **hexagonal (ports and adapters) core** that holds every business rule and knows nothing
  about Swing, HTTP, or SQL;
- a **SplitSmart server** that exposes the core as a versioned JSON REST API and owns the only
  database;
- the **Swing desktop app as a thin API client**, the first of several clients (web, Android,
  iOS later use the same API);
- an **append-only ledger** for money movements, so balances are a sum over immutable entries
  instead of a recomputation over expenses and payments;
- **domain events** (ExpenseRecorded, ExpenseDecided, PaymentRecorded, PaymentDecided) that
  drive notifications, so the same events can later feed push and email (FR-024).

## 2. Drivers

| Driver | Source | How this design responds |
|--------|--------|--------------------------|
| Web primary, Android and iOS apps, same data on each | CR-10, FR-044 – FR-046, NFR-009 | One server and one API; every client is an adapter |
| Members on different machines see each other's expenses and notifications | CR-05, CR-06 | Shared server database instead of one per machine |
| Money exact and auditable | CR-07, NFR-001, Principle IV | Append-only ledger, DB constraint that each posting sums to zero |
| Business logic independent of the GUI | Principle III | Core module has no Swing, HTTP, or JDBC dependency (enforced by the Maven module graph) |
| Push or email notifications later | FR-024 | Notifications are event handlers; adding a channel is adding a handler |

## 3. Module structure (multi-module Maven)

```text
splitsmart/
├── pom.xml                       # parent: Java 21, JUnit 5, dependency management
├── splitsmart-core/              # domain + use cases; depends on nothing but the JDK
│   └── com.splitsmart.core
│       ├── domain/               # User, Group, Expense, Share, Payment, LedgerEntry, Money, ...
│       ├── rules/                # SplitCalculator, ApprovalPolicy, AmountRules
│       ├── usecase/              # RecordExpense, DecideExpense, RecordPayment, ... (inbound ports)
│       ├── port/out/             # UserRepository, ExpenseRepository, LedgerRepository,
│       │                         #   ReceiptStore, PasswordHasher, Clock, EventPublisher
│       └── event/                # ExpenseRecorded, ExpenseDecided, PaymentRecorded, ...
├── splitsmart-server/            # adapters: REST in, PostgreSQL out
│   └── com.splitsmart.server
│       ├── http/                 # Javalin routes, JSON DTOs (Jackson), auth filter
│       ├── persistence/          # JDBC adapters, Flyway migrations
│       ├── notify/               # InAppNotificationHandler (+ later Push/Email handlers)
│       └── ServerMain
├── splitsmart-api-client/        # typed Java client for the REST API (java.net.http)
└── splitsmart-desktop/           # Swing app; depends on api-client only, never on core
    └── com.splitsmart.desktop    # views, view models, controllers
```

Dependency rule: `desktop → api-client → (HTTP) → server → core`. `core` depends on nothing.
Because the desktop module cannot see the core, it is impossible to put a balance rule in Swing
code (Principle III enforced by the compiler, not only by review).

## 4. Runtime view

```text
 Swing desktop ──┐
 Web SPA (later)─┼── HTTPS / JSON ──► SplitSmart server (Javalin) ──► PostgreSQL 16
 Android (later)─┤                      │  core use cases               │  ledger_entry (append-only)
 iOS (later) ────┘                      │  event bus ─► notification     receipts: object storage
                                        └─ SSE stream /api/v1/events (live notifications)
```

### REST API (v1, abridged)

| Method and path | Use case | FR |
|-----------------|----------|----|
| `POST /api/v1/accounts`, `POST /api/v1/sessions`, `DELETE /api/v1/sessions/current` | register, sign in, sign out | FR-001 – FR-003 |
| `POST /api/v1/groups`, `PATCH /groups/{id}`, `POST /groups/{id}/members`, `DELETE /groups/{id}/members/{uid}` | group management | FR-007 – FR-011 |
| `POST /api/v1/groups/{id}/expenses:preview`, `POST /groups/{id}/expenses` | preview and record | FR-012 – FR-020 |
| `POST /api/v1/expenses/{id}/decisions` | approve or reject | FR-026 – FR-029 |
| `GET /api/v1/balances?groupId=` | balances | FR-031 – FR-034 |
| `POST /api/v1/groups/{id}/payments`, `POST /payments/{id}/decisions` | payments | FR-035 – FR-038 |
| `GET /api/v1/notifications`, `PATCH /notifications/{id}` | inbox | FR-021 – FR-023 |
| `GET /api/v1/reports?from=&to=&groupId=&type=` | reports | FR-039 – FR-042 |

Money crosses the wire as a decimal **string** (`"33.34"`), never a JSON number, so no client
parses it into a binary float.

### Authentication

Sign-in returns an opaque random session token (256-bit), stored server-side hashed with an
expiry of 14 days; clients send it as `Authorization: Bearer`. Passwords hashed with PBKDF2
(JDK) as in the base plan.

## 5. The ledger

Every money movement is a balanced posting of `ledger_entry` rows:

| Event | Entries (per participant p with share s, payer P) |
|-------|---------------------------------------------------|
| Expense approved | for each p ≠ P: `(group, debtor=p, creditor=P, +s)` |
| Payment confirmed (B pays A amount x) | `(group, debtor=B, creditor=A, −x)` |

- Entries are inserted in the same transaction that changes the expense or payment status;
  they are never updated or deleted (a correcting expense adds new entries, matching FR-047).
- Pair balance = `SUM(amount)` over `(group, debtor, creditor)` minus the reverse direction.
- A database check verifies each posting nets per group to zero, so FR-034 is enforced by
  storage as well as by tests.
- Audit: "why does B owe A 33.33?" is answered by listing B→A entries with their source.

## 6. Concurrency

- Each `expense` and `payment` row has a `version` column; approve and confirm use optimistic
  locking (`UPDATE ... WHERE version = ?`), so two approvers deciding at once cannot both finish
  the workflow or double-post the ledger.
- Payment validation (FR-037) reads the current balance and inserts the payment in one
  `SERIALIZABLE` transaction, and counts payments still Awaiting Confirmation against the amount
  owed, so two simultaneous payments cannot overpay.

## 7. Notifications

`EventPublisher` is an in-process synchronous bus in the server. `InAppNotificationHandler`
writes notification rows in the same transaction as the event (FR-021, FR-022). The server
streams new notifications to signed-in clients over Server-Sent Events, so a member on another
machine sees them without signing in again. Push and email (FR-024) become extra handlers.

## 8. Deployment

| Node | Artifact | Notes |
|------|----------|-------|
| Server host (cloud VM or container) | `splitsmart-server.jar` in a Docker image | Java 21 runtime, behind HTTPS reverse proxy (Caddy) |
| Database | PostgreSQL 16 | daily backups, point-in-time recovery |
| Receipt storage | S3-compatible bucket (local folder in development) | max 5 MB JPEG/PNG |
| Member PC | `splitsmart-desktop.jar` | Java 21; server URL in a settings file |

Local development: `docker compose up` starts PostgreSQL and the server; the desktop app points at
`http://localhost:7070`. Tests in `core` need nothing; adapter tests use Testcontainers
PostgreSQL.

## 9. Libraries beyond the constitution (justification required)

| Library | Why |
|---------|-----|
| Javalin 6 | small HTTP framework for the REST adapter |
| Jackson | JSON mapping with `BigDecimal` as string |
| PostgreSQL JDBC + Flyway | shared multi-user database and versioned schema |
| Testcontainers (test only) | real PostgreSQL in adapter tests |

## 10. Trade-offs

| Aspect | This alternative | Base plan |
|--------|------------------|-----------|
| Fit to customer scope (CR-10) | High: the API is the web/mobile backbone | Low: deferred clients need a re-architecture |
| Multi-user on different machines | Yes | No (one machine, take turns) |
| MVP effort | High: 4 modules, server, DB, auth tokens, deployment | Low: one module, one JAR |
| Running the MVP | Needs a server and database running | Double-click a JAR |
| New dependencies | 4 runtime + 1 test, each needing justification | 1 (H2) |
| Testability of rules | Excellent (core has no dependencies) | Good (package rule checked by a test) |
| Money auditability | Ledger with storage-level invariant | Derived on read; correct but no audit trail |
| Risk for a course timeline | Higher: networking, security, ops | Lower |
| Constitution fit | Passes, but the extra libraries need the documented justification above | Passes |

## 11. Risks

- Scope: the server, auth, and deployment work could crowd out the MVP features the course
  grades.
- Security: a network API needs TLS, rate limiting on sign-in, and token handling the base plan
  never exposes.
- Operations: someone must host and back up the server and database.
- Offline use: the desktop client does nothing without the server.
