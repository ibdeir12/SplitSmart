# Implementation Plan: SplitSmart Expense Sharing

**Branch**: `001-splitsmart-expense-sharing` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Revision**: 2 (consolidated per [ADR-001](../../docs/architecture/decision.md))

**Design**: [docs/design/design.md](../../docs/design/design.md) | **Research**: [research.md](research.md) | **Data model**: [data-model.md](data-model.md) | **Contracts**: [service-api.md](contracts/service-api.md), [ui-screens.md](contracts/ui-screens.md) | **Validation**: [quickstart.md](quickstart.md)

**Input**: Feature specification from `/specs/001-splitsmart-expense-sharing/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

**Revision history**: Revision 1 was Architecture A as reviewed in
[review-architecture-A-base.md](../../docs/architecture/reviews/review-architecture-A-base.md)
(plan at commit `44b2bbb`). Revision 2 applies ADR-001: Architecture A is retained and decisions
D-1 through D-5 are adopted from Architecture B as package-level improvements inside one module.
It also closes review defects A-D1 through A-D9 following
[consolidation-instructions.md](../../docs/architecture/consolidation-instructions.md). The
lifecycle, receipt, and operational behaviour in the spec's clarification session 2026-11-05 was
decided by the project owner during consolidation, alongside ADR-001.

## Summary

SplitSmart records shared expenses inside groups, routes each expense through an approval step,
derives pairwise balances from Approved expense shares and Confirmed payments, notifies the
members involved, and reports on all of it. The MVP subset ([MVP] requirements in the spec) is
delivered as a single-machine Java 21 Swing desktop application with one signed-in member at a
time.

Technical approach: a **layered monolith** in one Maven module (Architecture A), organised as
Model-View-Controller on top of an application-service layer, with ports and adapters as Java
packages (ADR-001 D-1):

1. **Presentation** (`com.splitsmart.ui`): Swing views, controllers, and background workers.
   Collects input, allocates operation IDs, calls services off the event dispatch thread, and
   renders results. Contains no money, approval, or lifecycle logic (constitution Principle III).
2. **Application services** (`com.splitsmart.service`): one service per customer feature
   (accounts, groups, expenses, approvals, payments, balances, notifications, reports). Each
   top-level use case owns one unit of work and the group serialization lock (D-2).
3. **Ports** (`com.splitsmart.service.port`): repository interfaces, `ReceiptStore`,
   `PasswordHasher`, and `TransactionRunner`/`UnitOfWork`. Time comes from an injected
   `java.time.Clock`.
4. **Domain** (`com.splitsmart.domain`, `com.splitsmart.domain.rules`): entities, value objects
   (`Money`, `Percentage`), derived balance types, and the business rules (`SplitCalculator`,
   `BalanceCalculator`, `ApprovalPolicy`, `AmountRules`, `PasswordPolicy`). Plain Java, no Swing,
   no JDBC, no adapter imports.
5. **Adapters**: `com.splitsmart.persistence` (JDBC repositories, H2 startup, versioned
   migrations), `com.splitsmart.storage` (receipt files), `com.splitsmart.security` (PBKDF2).
   `com.splitsmart.app.AppContext` wires concrete adapters to ports by hand.

Balances are never stored and no ledger exists: Approved shares and Confirmed payments are the only
monetary source records. Awaiting Confirmation payments reserve recording allowance but never
change displayed balances (D-3). Web, Android, and iOS clients remain deferred customer
requirements (FR-044 through FR-046).

## Technical Context

**Language/Version**: Java 21 (LTS)

**Primary Dependencies**: Java SE (Swing, JDBC, `javax.imageio`, `javax.crypto` PBKDF2,
`java.util.logging`); H2 Database 2.x (embedded, file mode); JUnit 5 (Jupiter) for tests. H2 is
the only runtime library beyond the constitution's list; see [research.md](research.md) R-02. The
Maven Shade plugin is a build plugin used to package one executable JAR, not a runtime library.
No Flyway, Jackson, Javalin, PostgreSQL, or Testcontainers dependency (ADR-001).

**Storage**: one selected data directory, chosen with `--data-dir <path>` (default
`~/.splitsmart`), containing:

- `splitsmart.mv.db`: embedded H2 database file;
- `receipts/`: finalized receipt images, named by generated UUID storage keys;
- `receipts/staging/`: validated receipt bytes awaiting final placement (same filesystem);
- `app.lock`: exclusive application lock held for the process lifetime;
- `logs/`: local technical log (no passwords, no receipt contents).

Schema state lives in the `schema_version` table, created by
`src/main/resources/db/migration/V001__initial.sql` (D-5).

**Testing**: JUnit 5 via Maven Surefire (`mvn verify`). Layers: pure domain-rule tests; service
tests against port fakes and a fixed `Clock`; service and repository tests against real-schema H2
created by the migration runner; file-mode H2 tests in temporary directories for restart,
migration, receipt-protocol, injected-failure, and backup/restore evidence (in-memory H2 alone is
never durability evidence); headless controller tests for presentation states; one architecture
test for the package dependency rule. Test names start with the requirement ID and display the
acceptance scenario ID (for example `FR037_confirmRefusedWhenDebtShrank`, displayed as
"US6-AS8"). Timing measurements (NFR-003/SC-009, SC-002, NFR-004) are separate protocols in
[quickstart.md](quickstart.md) and are never inferred from a green build. All tests and
measurements are **planned**; none has been executed for this revision.

**Target Platform**: Desktop (Windows, macOS, Linux) with a Java 21 runtime.

**Project Type**: desktop-app

**Performance Goals**: balances and reports for a group of 20 members and 1,000 expenses in under
2 seconds each, measured from screen request to rendered result against a repeatable fixture
(NFR-004, US8-AS7). Slow work never blocks the Swing event dispatch thread (NFR-011).

**Constraints**: money exact to the cent with `BigDecimal` and decimal strings at every text
boundary (NFR-001, Principle IV, D-4); passwords never stored readable (FR-005); data, receipts,
and histories survive restart and closed-application backup/restore (NFR-006); safe operational
feedback with definite saved/not saved/unknown outcomes (NFR-010); one process owns a data
directory and one member is signed in at a time.

**Scale/Scope**: course MVP; tens of users per installation, up to about 20 members per group and
1,000 expenses per group; 9 user stories. **49 functional requirements: 43 [MVP] and 6
[Deferred]** (FR-024, FR-030, FR-043, FR-044, FR-045, FR-046), counted from the scope tag on each
FR definition, including FR-047, FR-048, and FR-049. 11 non-functional requirements (NFR-001 to
NFR-007, NFR-010, NFR-011 [MVP]; NFR-008, NFR-009 [Deferred]) and 9 success criteria (SC-001 to
SC-009). NFRs, SCs, and acceptance scenarios are not counted as FRs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The table records a **design assessment** of the documents in this revision. It does not record
executed tests: no implementation exists yet and every JUnit test is planned. The clarifications
of session 2026-11-05 were decided by the project owner during consolidation.

| Principle / gate | Design assessment | Evidence in this revision | Pending evidence |
|------------------|-------------------|---------------------------|------------------|
| I. Customer requirements are the source of truth | Aligned in design | `UserRequirement.md` unchanged; all ten customer inventory rows retained; deferred FR-024, FR-030, FR-043 to FR-046, NFR-008, NFR-009 kept with future acceptance obligations; desktop delivery labelled an implementation decision; session 2026-11-05 items recorded as dated owner decisions. | None for this revision. |
| II. Requirement traceability | Aligned in design, matrix audit pending | FRs counted from scope tags (49 = 43 + 6); spec traceability covers every FR and NFR; [design.md](../../docs/design/design.md) maps each MVP FR to source, scenario, diagram element, responsible class, and planned test; defect table below maps A-D1 to A-D9 to scenarios. | Matrix audit for NFR-007 and SC-008; regenerated PlantUML diagrams; ID-named tests once code exists. |
| III. OO design, GUI separated from business logic | Aligned in design | Package rule `ui -> service -> domain`, `service -> service.port <- adapters`; domain imports no Swing, JDBC, or adapter; business decisions only in services and rules; planned architecture test scans imports. | Architecture test executed against the implementation. |
| IV. Exact BigDecimal arithmetic | Aligned in design | `Money` scale 2; decimal strings parsed with `new BigDecimal(String)` (D-4); explicit scale and `RoundingMode` at every division and percentage step; listed-order leftover cents; exact DECIMAL columns with JDBC `BigDecimal` accessors; reservations never enter balances. | Invariant tests (shares sum to amount, group positions sum to 0.00) executed. |
| V. JUnit 5 verified behaviour | Planned, not executed | R-08 defines test layers, fakes, file-mode H2, injected failures, and ID naming; every MVP FR has a planned test in the design.md matrix. | `mvn verify` green with every planned test; recorded results per scenario ID. |
| VI. Human review | Reviewed by the project owner | Revision 2 was reviewed and accepted by the project owner on 2026-11-05 (ADR-001 and spec session 2026-11-05). | Human review of each implementation change before it is committed. |
| New libraries need justification | Aligned | H2 justified in R-02; no other runtime library; B's server stack rejected by ADR-001. | None. |

Pre-design gate: no unresolved scope or money-rule question blocks design; the 2026-11-05
clarifications are recorded owner decisions. Post-design re-check (after Phase 1): design
assessment complete as tabled; implementation, test, measurement, and review evidence remain
outstanding. No constitution exception is required (see Complexity Tracking).

## Project Structure

### Documentation (this feature)

```text
specs/001-splitsmart-expense-sharing/
├── spec.md              # /speckit-specify + /speckit-clarify output; session 2026-11-05 appended
├── plan.md              # This file (/speckit-plan command output), revision 2
├── research.md          # Phase 0 output, R-01 to R-09 revised per ADR-001
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output: build, run, validation scenarios, timing, backup
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── service-api.md   # use-case interface the Swing layer calls
│   └── ui-screens.md    # screen contract: inputs, outputs, states, error messages
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)

docs/
├── architecture/        # ADR-001 (decision.md), reviews, alternative, consolidation instructions
└── design/
    ├── design.md        # design document and acceptance matrix
    └── diagrams/        # PlantUML sources and rendered PNGs (same basename)
```

### Source Code (repository root)

```text
pom.xml
src/main/java/com/splitsmart/
├── app/            # Main (parses --data-dir), AppContext (manual wiring), AppPaths,
│                   #   DataDirectoryLock; AppContext.start: lock -> open -> migrate -> reconcile
├── ui/             # Swing: MainFrame, LoginPanel, DashboardPanel, GroupPanel,
│                   #   ExpenseFormDialog, ExpenseDetailsDialog, ApprovalPanel, PaymentDialog,
│                   #   BalancesPanel, NotificationPanel, ReportPanel; *Controller classes;
│                   #   SessionWorker (SwingWorker that renders only for the current session)
├── service/        # AccountService, GroupService, ExpenseService, ApprovalService,
│   │               #   PaymentService, BalanceService, NotificationService, ReportService,
│   │               #   Session, CommandRunner, CommandResult, OperationOutcome, GroupLocks,
│   │               #   AppException with ValidationException, AccessDeniedException,
│   │               #   ConflictException, StorageUnavailableException,
│   │               #   ReceiptUnavailableException, OutcomeUnknownException; DTOs (ExpenseSummary,
│   │               #   ExpenseDetails, DepartureResult, Summary, Report, ReportQuery)
│   └── port/       # *Repository interfaces, ReceiptStore, PasswordHasher,
│                   #   TransactionRunner, UnitOfWork
├── domain/         # User, Group, GroupState, Membership, Expense, ExpenseStatus, Share,
│   │               #   SplitMethod, ApprovalDecision, Payment, PaymentStatus, LifecycleEvent,
│   │               #   Notification, ReceiptRef, Money, Percentage, PairBalance,
│   │               #   CounterpartyBalance, PaymentAllowance
│   └── rules/      # SplitCalculator, BalanceCalculator, ApprovalPolicy, AmountRules,
│                   #   PasswordPolicy
├── persistence/    # Database (H2 connection), MigrationRunner, JdbcTransactionRunner
│   └── jdbc/       # Jdbc*Repository implementations
├── storage/        # FileReceiptStore (validation, staging, atomic placement, key listing)
└── security/       # Pbkdf2PasswordHasher (PBKDF2WithHmacSHA256)
src/main/resources/db/migration/
└── V001__initial.sql
src/test/java/com/splitsmart/
├── architecture/   # LayerDependencyTest (import scan)
├── domain/rules/   # SplitCalculatorTest, BalanceCalculatorTest, ApprovalPolicyTest, ...
├── service/        # per-service tests with port fakes + fixed Clock, and real-schema H2
├── persistence/    # repository round trips; file-mode migration, restart, backup/restore
├── storage/        # receipt protocol and injected-failure tests
├── ui/             # headless controller and presentation-state tests
└── performance/    # NFR-004 fixture builder and timed workload (run separately, tagged)
```

Class names above that do not yet exist are **planned**; the authoritative method signatures are
in [service-api.md](contracts/service-api.md) and the entities in [data-model.md](data-model.md).

**Structure Decision**: single Maven module (Option 1, desktop variant). Layers and adapters are
Java packages in `com.splitsmart`. A JUnit architecture test scans imports and enforces:

- `domain` imports nothing from `ui`, `service`, `persistence`, `storage`, `security`, or `app`,
  and no `javax.swing`, `java.awt`, or `java.sql`;
- `service` and `service.port` import `domain` (and `service.port`), never an adapter package,
  `ui`, `java.sql`, or `javax.swing`;
- adapters (`persistence`, `storage`, `security`) implement `service.port` interfaces and never
  import `ui` or a concrete service class;
- `ui` calls services and renders service results; it imports no port or adapter package and no
  `java.sql`;
- only `app` references concrete adapters, to wire them in `AppContext`.

## Architecture Overview

```text
┌──────────────────────── one Java 21 process, one Maven module ─────────────────────────┐
│  ui (Views + Controllers + SessionWorker background workers)                            │
│        │ calls on a worker thread; renders on the EDT                                  │
│        ▼                                                                               │
│  service (use cases, Session, access checks, CommandRunner, GroupLocks)                │
│        │ uses                                │ calls                                   │
│        ▼                                     ▼                                         │
│  domain + domain.rules                 service.port (repositories, ReceiptStore,       │
│  (entities, Money, rules)                PasswordHasher, TransactionRunner, Clock)     │
│                                              ▲ implemented by                          │
│                    ┌─────────────────────────┼──────────────────────┐                  │
│               persistence (JDBC,        storage (receipt        security (PBKDF2)      │
│               migrations)               files)                                         │
│                    │                         │                                         │
│  app.AppContext wires adapters to ports and runs startup; DataDirectoryLock            │
└────────────────────┼─────────────────────────┼─────────────────────────────────────────┘
                     ▼                         ▼
        <data-dir>/splitsmart.mv.db    <data-dir>/receipts/, receipts/staging/
        (schema_version, V001...)      <data-dir>/app.lock, logs/
```

There is no server, HTTP or SSE transport, ledger table, or monetary posting component.

### Key flows

All mutations below follow the same envelope: the controller allocates an operation UUID and runs
the call in a `SessionWorker`; the service runs the use case through `CommandRunner`, which
acquires the group lock, opens one unit of work through `TransactionRunner`, and returns a
`CommandResult` carrying the `OperationOutcome`. Inside the unit of work the service loads current
membership from the database (never from cached UI state), performs the use case, and writes the
operation-result record before commit. The controller renders the outcome on the event dispatch
thread only if the same session is still signed in.

- **Record expense (FR-012 to FR-022, FR-025, FR-026)**: `ExpenseFormDialog` ->
  `ExpenseController` -> `ExpenseService.previewShares` (pure, no transaction; same split rules) ->
  `ExpenseService.recordExpense(session, draft, operationId)`. Validation: `AmountRules` on the
  decimal string, required description and date, payer and ordered participants are active
  members (payer preselected as participant and may be unselected), percentages total exactly
  100.00. `ApprovalPolicy` derives the approver set (payer and participants, excluding the
  creator); an empty set is refused before anything is saved (US4-AS8). An optional receipt is
  validated and staged, then placed at its final path through `ReceiptStore` before the unit of
  work opens. In one unit of work: Expense (Pending), ordered Shares, receipt reference,
  notifications for the payer and participants other than the creator, and the operation result.
  Success is reported only after commit. Balances are unchanged.
- **Authorized expense discovery (FR-004, FR-048)**: `GroupPanel` calls
  `ExpenseService.listExpenses(session, groupId)`, which checks active membership and returns
  `ExpenseSummary` rows (stable ID, date, description, payer, amount, status) for every retained
  status (Pending, Approved, Rejected, Cancelled), ordered by business date descending, creation
  time descending, then UUID ascending. An empty group returns an empty list.
  `getExpense` and `getReceipt` repeat the membership check, so an old ID or notification link
  gives a former member a safe refusal (US3-AS12, US7-AS8).
- **Approve / reject (FR-026 to FR-029, FR-047)**: `ApprovalService.approve` / `reject(reason)`
  under the group lock: require active membership, a Pending expense, and a required approver who
  has not yet decided; a rejection needs a nonblank reason. Save the genuine decision with actor and
  `Clock` time. Any rejection makes the expense Rejected immediately; the last outstanding
  approval makes it Approved; otherwise it stays Pending (partial approval, no notification).
  A terminal outcome and its creator notification are saved in the same unit of work as the
  decision. Approval writes no monetary row: once Approved, the retained shares take part in every
  later derivation. A decision on a Rejected, Approved, or Cancelled expense, a second decision by
  the same approver, or a non-approver is refused with no change (US4-AS4, US4-AS9, US4-AS10).
- **Balances and counterparty aggregation (FR-031 to FR-034)**: `BalanceService.myBalances`
  loads Approved shares and Confirmed payments for one group; `BalanceCalculator` nets each pair.
  `BalanceService.myCounterpartyBalances` repeats this for each of the member's current groups,
  groups the signed pair amounts by counterparty user ID (positive = the viewer owes), and returns
  one `CounterpartyBalance` per counterparty with its per-group contributions and total, ordered by
  counterparty UUID; `myOverallPosition` is the sum of those totals. Pending, Rejected, Cancelled,
  Awaiting Confirmation, Declined, and Cancelled-payment records never contribute. The US5-AS4
  example yields A: owes 20.00 (G1 owes 30.00, G2 is owed 10.00), C: owes 5.00, overall owes 25.00.
  Cross-group totals are informational; payments stay group-specific.
- **Payment recording (FR-035, FR-037)**: `PaymentService.allowance(session, groupId, toUserId)`
  returns `PaymentAllowance(debt, reserved, available)`, where `debt = max(0.00, live signed pair
  debt from payer to receiver in the group)`, `reserved = sum of Awaiting Confirmation amounts in
  that direction and group`, and `available = max(0.00, debt - reserved)`. `recordPayment` uses the
  session member as payer, requires both parties to be distinct active members, validates amount
  and date, and refuses an amount above `available`. In one unit of work: the Awaiting Confirmation
  payment, the receiver's notification, and the operation result (US6-AS7).
- **Payment confirmation and decline (FR-036, FR-037)**: receiver only, under the same group lock
  as every other balance-changing operation. `confirm` re-reads the live confirmed debt in that
  group and refuses an amount above it **without** subtracting the confirming payment's own
  reservation; on refusal the status stays Awaiting Confirmation, balances are unchanged, and the
  current debt is shown, so the receiver can decline it (US6-AS8). `decline` changes status only,
  which releases the reservation. Confirmed, Declined, and Cancelled are terminal; a repeated or
  wrong-actor decision is refused (US6-AS9). If debt shrinks, pending payments remain awaiting until
  confirmed within the new limit, declined, or lifecycle-cancelled; no confirmation can create a
  reverse debt.
- **Departure, lifecycle cancellation, and creator succession (FR-008, FR-011, FR-049)**:
  `GroupService.removeMember` (current Group Creator only) or `leaveGroup` (self; removing oneself
  follows the same procedure) under the group lock, in one unit of work: compute every pairwise
  balance involving the departing member in the group; if any is non-zero, refuse and return the
  outstanding counterparties and amounts (a scalar 0.00 formed from opposite debts is still
  refused, US2-AS3). Otherwise: cancel each Pending expense where the member is creator, payer,
  participant, or required approver, and each Awaiting Confirmation payment they send or receive;
  keep the source records and genuine decisions; append separate `LifecycleEvent` rows with
  initiating actor, reason, and `Clock` time; notify affected expense creators and payment parties
  who remain current members, excluding the initiator. If the departing member is the current
  Group Creator, transfer the role to the remaining active member with the earliest current join
  time (ties by ascending user UUID) and record the event, keeping the original creator
  attribution; if no active member remains, archive the group. End the membership and write the
  operation result. Any failure rolls back everything (US2-AS12). After commit every access path
  for the departed member is refused; confirmed balances are unchanged. A permitted departure is
  never refused merely because pending work exists (US2-AS6, US2-AS8 to US2-AS11).
- **Notifications (FR-021 to FR-023)**: written by an internal notification writer that receives
  the originating `UnitOfWork` and the exact recipient list; it never commits on its own. Inbox,
  unread count, and link opening filter out groups the member can no longer access and return a
  safe unavailable result for stale links (US7-AS3, US7-AS7, US7-AS8).
- **Reports (FR-039 to FR-042)**: `ReportService.customReport(session, ReportQuery)` requires a
  start and end date (inclusive), refuses start after end, refuses a group filter outside the
  member's current groups, filters by item type (EXPENSES, PAYMENTS, BOTH), and totals each
  displayed monetary column with `Money.sum`; an empty result has empty rows and 0.00 totals.
  `summary` shows the approved-expense share, paid and received totals, and the current derived net
  balance, which is never confused with a date-filtered activity total.
- **Duplicate commands and unknown outcomes (NFR-010)**: a retry carrying the same operation ID
  and the same non-secret command fields returns the stored result instead of acting again; a
  different request under that ID is a conflict. After an UNKNOWN outcome the controller disables
  further submission and calls `CommandRunner.lookup` once the store is available; absence of
  the record after recovery permits a retry with the same ID (US1-AS9).

### Cross-cutting decisions

- **Ports and wiring (D-1)**: services depend only on `service.port` interfaces and an injected
  `Clock`. `AppContext` constructs `Database`, `JdbcTransactionRunner`, the `Jdbc*Repository`
  set, `FileReceiptStore`, and `Pbkdf2PasswordHasher` and passes them to service constructors.
  Tests substitute fakes and a fixed `Clock`. No dependency-injection framework.
- **Session and access control**: `Session` holds the signed-in user ID and a session token. Every service method takes the session, derives the actor from it (never from a
  parameter), and checks current active membership in the database before reading or writing
  (FR-004, FR-010, NFR-002). Sign-out is an in-memory operation with no database transaction.
- **Transaction ownership (D-2)**: the top-level use case owns exactly one unit of work. Source
  records, shares, genuine decisions, status changes, lifecycle events, operation results, and
  required notification rows commit or roll back together. Repositories and the notification
  writer receive the same transaction context and never open their own commits. Pure previews and
  sign-out open no database transaction. A JDBC rollback does not undo file writes; receipts follow
  the protocol below.
- **Serialization policy**: one process owns the data directory (exclusive lock). Every group
  mutation acquires that group's lock from `GroupLocks` before opening its unit of work and holds
  it until commit or rollback completes. This covers at least expense creation, approval and
  rejection, payment recording, confirmation, and decline, membership addition, removal, and
  leaving, renaming, lifecycle cleanup, and Pending-expense deletion. Background workers call the
  same services and cannot bypass the lock. An operation needing several group locks acquires them
  in ascending group UUID order. A payment row version alone cannot protect derived debt and is not
  relied on. The design claims no support for simultaneous remote users; a later server needs a new
  isolation review.
- **Money at boundaries (D-4)**: forms and files accept and emit decimal strings; parsing uses
  `new BigDecimal(String)` after a format check; display formats exactly two decimal places. No
  `float` or `double` appears in parsing, formatting, arithmetic, adapters, fixtures, or
  intermediate values (R-04).
- **Receipt protocol (closes A-D5)**:
  1. `ReceiptStore` validates the byte count (at most 5,000,000 bytes, inclusive) and decodes the
     actual content as JPEG or PNG; the filename extension is ignored. Storage keys are generated
     UUIDs, never user-selected paths. Viewing goes through an authorized expense ID.
  2. Validated bytes are written to `receipts/staging/`, flushed and forced to disk, closed, and
     moved to `receipts/<uuid>.<ext>` with an atomic rename on the same filesystem before the
     database reference is committed. If the platform cannot perform an atomic move, the save is
     refused with a storage error rather than acknowledged unsafely. Durability assumption: a local
     (non-network) filesystem on which a completed atomic rename survives a crash; a referenced file
     that is nevertheless missing is reported as receipt-unavailable, never as a lost expense.
  3. Expense, ordered shares, receipt reference, operation result, and notifications are saved in
     the originating unit of work; success is reported only after commit. The database and file are
     never saved on independent branches.
  4. After a known rollback (`NOT_COMMITTED`), the staged or final file is removed. After an
     `UNKNOWN` outcome, files are retained until database references and the operation status can
     be checked; a failed response is never assumed to mean rollback.
  5. On startup, under the exclusive lock and before new writes, `ReceiptStore.reconcile`
     receives the storage keys referenced by retained expenses, compares staging and final files
     with them, and removes only files proven unreferenced. A database-open failure is not permission to delete anything. A missing
     referenced file is reported as receipt-unavailable. Rejected and Cancelled expenses keep their
     receipts.
  6. After a permitted Pending-expense deletion (creator only, FR-047), the source and notification
     cleanup commits first; the file is removed only if no retained reference remains, and an
     interruption is repaired by reconciliation. Each boundary is tested with file-mode H2 and
     injected failures (US3-AS13, US3-AS14).
- **Error and outcome contract (closes A-D6)**: services raise subclasses of `AppException`:
  `ValidationException` (field and message), `AccessDeniedException`, `ConflictException` (stale
  state, for example a stale confirmation or an already-decided expense),
  `StorageUnavailableException`, `ReceiptUnavailableException`, and `OutcomeUnknownException`.
  Each carries a safe message, the operation ID, a retryable flag, and an `OperationOutcome` of
  `NOT_COMMITTED`, `COMMITTED`, or `UNKNOWN` where applicable; successful commands return a
  `CommandResult` with the same operation ID and outcome. Technical causes are
  logged locally without passwords or receipt contents. Controllers keep every form entry, never
  present a storage failure as invalid input, and treat a committed write followed by a failed
  refresh as saved.
- **Operation-status recovery**: for authenticated persistent commands the controller allocates a
  stable operation UUID; the service stores an actor-scoped operation-result record with a
  fingerprint of non-secret command fields in the same unit of work as the result. Lookup and
  replay both recheck current access: a departed member receives only a minimal saved or
  access-ended acknowledgement of their own departure, never a cached group payload. Registration
  uses a separate path: after an uncertain result the screen offers ordinary sign-in with the
  entered credentials, with generic errors and no unauthenticated disclosure of operation results.
  Passwords and credential buffers are never persisted or fingerprinted. Sign-in and sign-out do
  not use command replay. No remote idempotency service is introduced.
- **Responsiveness (NFR-011, R-09)**: password hashing, image decoding, JDBC, filesystem access, and
  report computation run in `SessionWorker` threads; the event dispatch thread only updates components.
  Each screen defines loading, empty, field-error, operational-error, unknown-outcome,
  retry/status-check, and access-revoked states. The submit action is disabled while its operation
  runs. A worker result is discarded if the session token changed (sign-out) before it
  completed. The local MVP needs no network connection.
- **Notifications**: rows in the `notification` table written synchronously in the originating
  unit of work; the dashboard reads them on sign-in and after each action. No push channel, event
  stream, or delivery queue (FR-024 remains deferred).

## Deployment

- **Build**: one executable JAR, `target/splitsmart.jar`, built by `mvn package` (Maven Shade
  plugin bundles H2). One Maven module.
- **Run**: `java -jar splitsmart.jar [--data-dir <path>]` on a machine with Java 21. The default
  data directory is `~/.splitsmart`; validation and testing always use a separate, explicitly
  selected directory ([quickstart.md](quickstart.md)).
- **Exclusive ownership**: at startup the application creates the data directory if it is missing,
  then acquires an exclusive lock on `<data-dir>/app.lock` **before** opening or inspecting
  H2, validating the schema, migrating, or reconciling receipt files, and holds it for the process
  lifetime. If the lock is unavailable, a second instance is refused with a safe message and
  changes nothing.
- **First launch**: a new, empty data directory receives `V001__initial.sql`; `schema_version`
  records the version, script checksum, and application time.
- **Normal reopen**: under the lock, the application validates that every applied version and
  checksum matches the scripts bundled in the JAR, then reconciles receipt files and opens the
  sign-in screen. An unknown future version or a checksum mismatch is refused without writing.
- **Upgrade (versioned migrations, D-5)**: ordered scripts in `src/main/resources/db/migration/`
  (`V001__initial.sql`, `V002__...`) are applied by `MigrationRunner`; no Flyway dependency. Before
  applying a newer script, the application closes the database while keeping the lock and copies
  the whole data directory to a pre-upgrade backup beside it (named with the current schema version
  and a timestamp); if the backup cannot be made, the upgrade is not attempted. It then durably
  records an in-progress migration marker (`schema_version.state = IN_PROGRESS`), runs the script, records the applied version and
  checksum, and clears the marker only after success. Because H2 DDL can commit independently, no
  whole-upgrade rollback is promised: a failed or interrupted migration (marker present) blocks
  normal startup and directs the member to recovery from the pre-upgrade backup, rather than
  re-running a partially applied script. An interrupted first initialization may be restarted only
  in a verified new directory that contains no user data.
- **Startup failure**: an unavailable, unreadable, or locked data directory, or a database that
  cannot be opened, produces a safe actionable message (retry, choose another directory, or
  restore) and shows no member data; the existing store is never replaced with an empty one
  (US1-AS8).
- **Backup (closes A-D7)**: exit the application cleanly (workers finish, H2 closes, the process
  exits), then copy the **entire** data directory: database files, `receipts/`,
  `receipts/staging/`, logs, and schema state. A directory that is changing because the
  application is running is never copied as a backup. No online backup is offered in the MVP.
- **Restore**: copy the backup into a **separate** directory and start with
  `--data-dir <restored-directory>`; the original directory is retained unchanged. Before adopting
  the restored copy, verify accounts, memberships, genuine approval history, lifecycle history,
  payment states, derived balances, schema version, and that every referenced receipt opens
  (US1-AS11; steps in [quickstart.md](quickstart.md)).

## ADR-001 adoptions

| Decision | Adopted as | Where in this plan | Research |
|----------|-----------|--------------------|----------|
| D-1 Ports for persistence, receipts, password hashing, and time | `com.splitsmart.service.port` holds repository interfaces, `ReceiptStore`, `PasswordHasher`, `TransactionRunner`/`UnitOfWork`; `Clock` injected; JDBC and migrations in `persistence`, receipt files in `storage`, PBKDF2 in `security`; `app.AppContext` wires them. Packages in one module. | Summary; Project Structure; Cross-cutting decisions (Ports and wiring) | R-01, R-08 |
| D-2 Explicit transaction ownership | The top-level use case owns one unit of work covering source records, decisions, status and lifecycle changes, operation results, and notifications; group lock held across it; receipts use the file protocol. | Key flows; Cross-cutting decisions (Transaction ownership, Serialization policy, Receipt protocol) | R-02, R-06, R-07 |
| D-3 Pending-payment reservation plus confirmation-time revalidation | Reservations derived from Awaiting Confirmation rows per group and direction; `PaymentAllowance(debt, reserved, available)`; confirmation rechecks live debt without subtracting its own reservation; no reservation table. | Key flows (Payment recording, Payment confirmation and decline) | R-05 |
| D-4 Money as decimal strings at text boundaries | `new BigDecimal(String)` parsing, two-decimal formatting, no binary floating point anywhere; a future API would also use decimal strings. | Cross-cutting decisions (Money at boundaries) | R-04 |
| D-5 Versioned schema | `schema_version` table and numbered scripts from `V001__initial.sql`; exclusive startup migration, checksum validation, pre-upgrade backup, in-progress marker, and backup-based recovery. | Deployment | R-02 |

Rejected from Architecture B (ADR-001): the client-server MVP, HTTP/SSE transport, the ledger table
and monetary postings, PostgreSQL, Javalin, Jackson, Flyway, Testcontainers, and the four-module
build.

## Review defect resolution

Planned verification is evidence still to be produced; no row is closed by a passing test yet.

| Defect | Resolution | Section changed | Planned verification |
|--------|-----------|-----------------|----------------------|
| A-D1 High: confirmation lacks a current debt limit | D-3 reservations at recording; live-debt recheck at confirmation under the group lock; stale refusal without transition | Key flows (Payment recording, Payment confirmation and decline); Cross-cutting decisions (Serialization policy); R-05 | US6-AS7, US6-AS8, US6-AS9; FR-037 and FR-036 service tests on real-schema H2 |
| A-D2 High: membership and creator departure strand workflows | FR-049 lifecycle: every-pair-zero guard, atomic cancellation of pending work, lifecycle events, deterministic creator succession or archive | Key flows (Departure, lifecycle cancellation, and creator succession); data-model.md Group, Membership, LifecycleEvent | US2-AS3, US2-AS6, US2-AS8, US2-AS9, US2-AS10, US2-AS11, US2-AS12, US4-AS9 |
| A-D3 Medium: no expense-list query | `ExpenseService.listExpenses` with all retained statuses and stable IDs; Group screen wired to it | Key flows (Authorized expense discovery); service-api.md ExpenseService | US3-AS12, US7-AS8 |
| A-D4 Medium: no cross-group counterparty result | `myCounterpartyBalances` with per-group contributions; overall position as their sum | Key flows (Balances and counterparty aggregation); R-05 | US5-AS4 |
| A-D5 Medium: receipt files outside the transaction protocol | Validated staging, atomic final placement before reference commit, rollback cleanup, startup reconciliation | Cross-cutting decisions (Receipt protocol); R-06 | US3-AS13, US3-AS14, US3-AS6 |
| A-D6 Medium: error contract excludes operational failures | `AppException` hierarchy, `CommandResult`/`OperationOutcome`, `CommandRunner.lookup` recovery, worker threads, startup failure handling | Cross-cutting decisions (Error and outcome contract, Operation-status recovery, Responsiveness); Deployment (Startup failure); R-09 | US1-AS8, US1-AS9, US1-AS10, US4-AS10, US7-AS7 |
| A-D7 Medium: folder-copy backup lacks a consistency condition | Clean-shutdown full-directory backup; restore into a separate `--data-dir`; verification checklist | Deployment (Backup, Restore); quickstart.md | US1-AS11 |
| A-D8 Medium: measurable acceptance coverage incomplete | ID-based acceptance matrix in design.md; extended validation scenarios; NFR-004 fixture timing; separate NFR-003/SC-009 and SC-002 protocols | Technical Context (Testing); R-08; quickstart.md | US3-AS15 and SC-009 timing; SC-002 timing; US8-AS7 timed workload; NFR-007 matrix audit; SC-008 |
| A-D9 Low: incorrect MVP requirement count | Recounted from scope tags: 49 FRs = 43 MVP + 6 deferred | Technical Context (Scale/Scope) | Definition count audit across spec, plan, and design.md |

## Complexity Tracking

> No constitution exception is required by the selected architecture.

The ports and adapter packages (D-1) add interfaces, but they stay inside one Maven module and one
process and serve Principle III testability; they are not a constitution exception. H2 is the one
added runtime library and is justified in R-02, as the constitution requires. If implementation
needs any further library or departs from a principle, it must be recorded here with its
justification before it is accepted.
