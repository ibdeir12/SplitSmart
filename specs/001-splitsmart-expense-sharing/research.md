# Research: SplitSmart Expense Sharing

**Phase 0 output of `/speckit-plan`** | **Date**: 2026-11-05 | **Plan**: [plan.md](plan.md)

**Revision**: 2 (consolidated per [ADR-001](../../docs/architecture/decision.md))

The Technical Context in the plan had no `NEEDS CLARIFICATION` items left after Lab 6's
`/speckit-clarify` session, because the constitution fixed the language, build tool, UI toolkit,
and test framework. The decisions below cover the remaining technical choices. Revision 2 records
the ADR-001 adoptions D-1 through D-5 and the fixes for review defects A-D1 through A-D9
([review](../../docs/architecture/reviews/review-architecture-A-base.md)). Behaviour taken from the
spec's clarification session 2026-11-05 (receipt bound, lifecycle cancellation, creator
succession, counterparty balances, operational outcomes) is an owner decision recorded as a dated
clarification, not a customer quotation.

## R-01 Architecture style

- **Decision**: Architecture A remains the selected layered monolith in one Maven module and one
  Java 21 process, with MVC in the Swing layer. ADR-001 D-1 adds ports as packages in the same
  module:
  - `com.splitsmart.ui`: Swing views, controllers, background workers;
  - `com.splitsmart.service`: application services, `Session`, access checks, unit-of-work and
    group-lock ownership, DTOs and the error/outcome contract;
  - `com.splitsmart.service.port`: repository interfaces, `ReceiptStore`, `PasswordHasher`,
    `TransactionRunner`/`UnitOfWork`; `java.time.Clock` is injected;
  - `com.splitsmart.domain` and `com.splitsmart.domain.rules`: entities, value objects, rules;
  - adapters `com.splitsmart.persistence` (JDBC, H2 startup, migrations),
    `com.splitsmart.storage` (receipt files), `com.splitsmart.security` (PBKDF2);
  - `com.splitsmart.app`: `Main`, `AppContext` (manual wiring), startup coordination.
- **Dependency rule**: `ui -> service -> domain`; `service -> service.port <- adapters`. The
  domain imports none of Swing, AWT, JDBC, ports, services, or adapters. Services import only
  domain and ports. Adapters implement ports and never import `ui` or a concrete service. Only
  `app` references concrete adapters. A JUnit architecture test scans imports to enforce this.
- **Rationale**: smallest structure that satisfies Principle III and keeps rules and services
  testable with fakes. Ports let a later server reuse the core unchanged without paying for that
  server now. One module keeps the build and course submission simple.
- **Alternatives considered**:
  - Architecture B's client-server deployment (REST server, Swing as an API client): rejected by
    ADR-001; it turns the first release into a hosted system and contradicts the local-MVP
    assumption. Web, Android, and iOS remain deferred (FR-044 to FR-046).
  - Architecture B's ledger table: rejected by ADR-001; its zero-sum check was wrong as written and
    it creates a second representation of money to reconcile (see R-05).
  - Multi-module Maven (B's four modules, or core/desktop): cleaner physical boundary but more build
    configuration for one client; the package rule and architecture test give the same direction
    of dependency.

## R-02 Persistence, transactions, and schema versions

- **Decision**: embedded H2 2.x in file mode (`<data-dir>/splitsmart.mv.db`), accessed through
  plain JDBC behind the repository ports.
  - **Transaction ownership (D-2)**: `TransactionRunner` opens one connection with auto-commit off
    per top-level use case and exposes a `UnitOfWork` from which every repository and the
    notification writer obtain the same connection. Source records, shares, genuine decisions,
    status and lifecycle changes, operation results, and notifications commit or roll back
    together; no repository or internal writer commits independently. Pure previews and sign-out
    open no transaction.
  - **Serialization**: one process owns the data directory through an exclusive file lock. Each
    group mutation acquires the in-process group lock before opening its unit of work and holds it
    through commit or rollback; operations needing several group locks take them in ascending group
    UUID order. This protects derived-debt checks that row versions cannot.
  - **Schema versions (D-5)**: the unversioned `schema.sql` is replaced by a `schema_version` table
    (version, script checksum, application time) and ordered scripts in
    `src/main/resources/db/migration/`, starting with `V001__initial.sql`, applied by a small
    in-house `MigrationRunner` under the exclusive lock. Normal startup validates every applied
    version and checksum; an unknown future version or a checksum mismatch is refused without
    writing.
  - **Closed-store upgrade recovery**: before a newer script runs, the database is closed while the
    lock is retained and the whole data directory is copied to a pre-upgrade backup. A durable
    in-progress marker is recorded before each script and cleared only after its version and
    checksum are recorded. H2 DDL can commit independently, so whole-upgrade rollback is not
    promised; a failed or interrupted migration blocks normal startup and is recovered from the
    pre-upgrade backup, never by re-running a partially applied script. An interrupted first
    initialization may be restarted only in a verified new directory with no user data.
- **Rationale**: NFR-006 needs data to survive restarts; the data is relational (groups, members,
  expenses, shares, approvals, payments); transactions keep an expense, its shares, and its
  notifications consistent; `DECIMAL` columns map to `BigDecimal` exactly. H2 is a single JAR with
  no install step, so the desktop application stays self-contained. It is the one runtime library
  added beyond the constitution's list.
- **Alternatives considered**: Java serialization or JSON files (no transactions, whole-file
  rewrites, harder report queries); SQLite through a JDBC driver (native library per operating
  system); JPA/Hibernate (large dependency, hides the SQL the course wants visible); PostgreSQL and
  Testcontainers (need a server, rejected by ADR-001); Flyway (a dependency for a handful of
  scripts, rejected by ADR-001 in favour of the in-house runner).

## R-03 Password storage

- **Decision**: PBKDF2WithHmacSHA256 from the JDK behind the `PasswordHasher` port
  (`Pbkdf2PasswordHasher` in `com.splitsmart.security`). Each user has a 16-byte random salt from
  `SecureRandom`; the derived key is 256 bits; the stored value is `iterations:salt:hash` (salt
  and hash Base64-encoded). Verification reads the iteration count and salt from the stored value,
  so the parameter can be raised later without invalidating existing accounts, and compares hashes
  in constant time. Password `char[]` buffers are cleared after use and are never logged,
  persisted, or used in an operation fingerprint.
- **Iteration count**: **210,000**. This is a **team parameter requiring security review**; this
  document does not claim that it follows any current published guidance. Before release, the
  reviewer either confirms the value against a cited, verified reference or sets a new value and
  records the source here.
- **Threading**: hashing during registration and sign-in runs in a background worker, never on
  the Swing event dispatch thread (R-09).
- **Rationale**: satisfies FR-005 with no extra dependency; the self-describing stored format keeps
  the parameter adjustable.
- **Alternatives considered**: BCrypt or Argon2 libraries (extra dependency); plain SHA-256 (too
  fast and unsalted, rejected).

## R-04 Money representation and rounding

- **Decision**: `Money` value object wrapping `BigDecimal` at scale 2; `Percentage` wrapping
  `BigDecimal` at scale 2.
  - **Decimal text at every boundary (D-4)**: form fields, fixtures, and files carry decimal
    strings. Input is trimmed, checked against a plain decimal format (digits with at most two
    decimal places; no sign, exponent, or grouping separators), then parsed with
    `new BigDecimal(String)`. Output is formatted with exactly two decimal places. A future API
    would also use decimal strings; it is outside this MVP. No `float` or `double` appears in
    parsing, formatting, arithmetic, storage adapters, test fixtures, or intermediate values, and
    no `BigDecimal` is constructed from a binary floating-point value.
  - **Equal split**: `share = amount.divide(BigDecimal.valueOf(n), 2, RoundingMode.DOWN)`.
  - **Percentage split**: `share = amount.multiply(percentage).movePointLeft(2).setScale(2,
    RoundingMode.DOWN)`; the multiplication and decimal shift are exact, and the only rounding is
    the explicit `setScale`. Percentages must each be greater than 0 with at most two decimal
    places and total exactly 100.00.
  - **Leftover cents**: `amount - sum(shares)` is handed out one cent at a time in the persisted
    listed participant order (FR-014, FR-015), so shares sum exactly to the amount.
  - **Persistence**: source amounts in exact `DECIMAL` columns, written and read only with
    `PreparedStatement.setBigDecimal` and `ResultSet.getBigDecimal`.
- **Value ranges**: valid **input** amounts for expenses and payments are 0.01 to 100,000.00
  (FR-016, FR-037). **Computed shares** may be 0.00 (for example 0.02 among three participants
  gives 0.01, 0.01, 0.00), so shares are not subject to the positive-input rule. **Aggregate
  balances** and totals are signed and may exceed 100,000.00; they are computed in unbounded
  `BigDecimal` and are never validated against the input cap.
- **Rationale**: Principle IV; the clarified rounding rule (100.00 / 3 = 33.34, 33.33, 33.33).
- **Alternatives considered**: storing cents as `long` (exact, but the constitution names
  `BigDecimal`); banker's rounding (does not guarantee the sum); decimal values as JSON numbers
  (parsers commonly produce binary floating point).

## R-05 Balances: stored or derived

- **Decision**: balances are derived on read from Approved expense shares and Confirmed payments
  only. Nothing stores a running balance, and there is no ledger. Pending, Rejected, and Cancelled
  expenses and Awaiting Confirmation, Declined, and Cancelled payments never contribute.
  - **Pair balances**: `BalanceCalculator` nets, per group, what each member owes each other member
    (no debt simplification across a group, FR-031). Group positions sum exactly to 0.00 (FR-034).
  - **Reservations and confirmation (D-3)**: for a payer, receiver, and group,
    `debt = max(0.00, live signed pair debt from payer to receiver)`,
    `reserved = sum of Awaiting Confirmation amounts in that direction and group`, and
    `available = max(0.00, debt - reserved)`, returned as `PaymentAllowance(debt, reserved,
    available)`. Recording refuses an amount above `available`. Confirmation re-reads the live
    `debt` under the group lock and refuses an amount above it **without** subtracting the
    confirming payment's own reservation; the refused payment stays Awaiting Confirmation. Decline
    and lifecycle cancellation release a reservation by changing status. Reservations are derived
    from Awaiting Confirmation rows, so no reservation table exists; over-reservation after a debt
    shrinks never yields a negative allowance and never changes confirmed balances. Cross-group or
    opposite-direction reservations never increase an allowance.
  - **All-groups counterparty aggregation**: for the signed-in member, signed pair amounts from each
    current group (positive = the member owes) are grouped by counterparty **user ID** (not
    display name) into `CounterpartyBalance` rows, each with its per-group contributions and its
    total; the overall position is the sum of the counterparty totals. Zero is shown as settled.
    Cross-group totals are informational; payment validation always uses the payment's own group.
    Example (US5-AS4): B owes A 30.00 in G1, A owes B 10.00 in G2, B owes C 5.00 in G1, so B sees
    A: owes 20.00 (G1 owes 30.00, G2 is owed 10.00), C: owes 5.00, overall owes 25.00.
- **Performance**: NFR-004 (20 members, 1,000 expenses, under 2 seconds) is a **measured**
  requirement, not an assumption: it is verified by the repeatable fixture and timing method in
  [quickstart.md](quickstart.md) (US8-AS7). If measurement fails, the first remedies are SQL
  aggregation per pair and the indexes in [data-model.md](data-model.md); a stored balance cache is
  considered only with measured evidence and a new decision record.
- **Rationale**: the spec says a balance is computed and never entered directly; one source of
  monetary truth cannot drift.
- **Alternatives considered**: a stored balance table updated on approval (two sources of truth);
  B's ledger postings (rejected by ADR-001); separate reservation rows (duplicate the information
  already carried by payment status).

## R-06 Receipt images

- **Decision**: one optional receipt per expense, accepted only when its actual content decodes as
  JPEG or PNG and its size is at most **5,000,000 bytes** (inclusive; 5,000,001 bytes is refused).
  The filename extension alone is never trusted. This resolves the earlier ambiguous "5 MB" as an
  MVP planning limit (clarification, session 2026-11-05). All file operations sit behind
  the `ReceiptStore` port (`FileReceiptStore` in `com.splitsmart.storage`).
- **File lifecycle**:
  1. **Validate**: check the byte count, then decode with `javax.imageio` and accept only a JPEG or
     PNG reader result; unsupported, oversized, or undecodable content is refused with a
     receipt-specific message while the other form entries are kept. Choosing no attachment is
     valid.
  2. **Stage**: write the validated bytes under `<data-dir>/receipts/staging/<uuid>`, flush, force
     to disk, and close. Storage keys are generated UUIDs; the user never chooses an output path.
  3. **Finalize**: move the staged file to `<data-dir>/receipts/<uuid>.<jpg|png>` with an atomic
     rename on the same filesystem **before** the database reference is committed. If the
     platform cannot perform an atomic move, the save is refused with a storage error. Durability
     assumption: a local, non-network filesystem on which a completed atomic rename survives a
     crash.
  4. **Commit**: the expense, ordered shares, `ReceiptRef` (key, actual content type, exact byte
     count), operation result, and notifications are saved in the originating unit of work.
     Success is reported only after commit.
  5. **After rollback or uncertainty**: after a known rollback the staged or final file is
     removed. After an `UNKNOWN` outcome files are retained until the operation status and
     database references can be checked; a failed response is never assumed to mean rollback.
  6. **Startup reconciliation**: under the exclusive lock and before new writes,
     `ReceiptStore.reconcile` receives the storage keys referenced by retained expenses and compares
     staging and final files with them; only files proven unreferenced are removed. A database-open failure never permits deletion. Rejected and Cancelled expenses keep
     their receipts.
  7. **Pending-expense deletion** (creator only; Approved deletion stays forbidden by FR-047): the
     database change commits first, and the file is removed only if no retained reference remains;
     an interruption is repaired by reconciliation.
  8. **Viewing**: a receipt is read only through `ExpenseService.getReceipt` with an authorized
     expense ID; membership is rechecked. A missing or unreadable stored file produces a
     receipt-unavailable state while the expense details stay viewable and balances are unaffected.
     "No attachment" and "receipt unavailable" are distinct results.
- **Verification**: every boundary (validation, staging, finalization, commit, rollback, unknown
  outcome, reconciliation) is tested with file-mode H2 and injected failures (US3-AS13, US3-AS14).
- **Rationale**: files outside the database keep the database and its backups small, and the
  ordering ensures no committed reference points to a file that was never finalized.
- **Alternatives considered**: BLOB column in H2 (transactional, but bloats the database file and
  every backup; retained as the fallback if the file protocol proves unworkable on a target
  platform); writing the file after commit (can commit a reference to a missing file).

## R-07 Notifications in a single-machine MVP

- **Decision**: an in-app `notification` table written **synchronously in the originating unit of
  work** by an internal notification writer that receives that unit of work and an exact recipient
  list; it never commits independently. If a required notification write fails, the whole command
  rolls back (US7-AS7).
- **Recipients**:

  | Event | Recipients |
  |-------|-----------|
  | Expense recorded | payer and every participant, excluding the creator; uninvolved members get nothing (FR-021, FR-022) |
  | Expense Approved or Rejected (terminal decision) | the expense creator, when the decision is caused by another member (FR-021, FR-022) |
  | Payment recorded | the receiver (FR-021) |
  | Lifecycle cancellation on departure | affected expense creators and affected payment parties who remain current group members, excluding the initiating actor (FR-021, FR-049) |

  A member is never notified about their own expense-creation action; that exclusion does not
  suppress decision or cancellation notices caused by others.
- **Reading**: the inbox and unread count include only notifications whose group the member can
  still access; a stale link opens a safe unavailable or no-access result and never bypasses
  membership. Stored history is retained (FR-023, US7-AS8).
- **Rationale**: FR-021 to FR-023 are in-app only and the MVP runs on one machine, so no event
  stream, server push, or delivery queue is needed. FR-024 (push or email) stays deferred.

## R-08 Testing approach

- **Decision**: JUnit 5, organised by the ID-indexed acceptance matrix in
  [design.md](../../docs/design/design.md), which maps every requirement (FR, NFR, SC) to its
  acceptance scenarios, design element, responsible class, and planned test. Test methods start
  with the requirement ID and display the scenario ID (for example
  `FR014_equalSplitGivesLeftoverCentsInListedOrder`, "US3-AS2"). Deferred requirements keep their
  future verification plans and are never reported as passing.
- **Test layers**:
  - **Pure rules**: `SplitCalculator`, `BalanceCalculator`, `ApprovalPolicy`, `AmountRules`,
    `PasswordPolicy`, including invariants (shares sum to amount, group positions sum to 0.00),
    zero-cent shares, leftover order, and reservation arithmetic.
  - **Services with fakes**: in-memory fakes of the repository ports, `ReceiptStore`,
    `PasswordHasher`, and `TransactionRunner`, with a fixed `Clock`, for authorization, lifecycle,
    approval, payment, and notification-recipient rules.
  - **Real-schema H2 service and repository tests**: the schema created by `MigrationRunner` from
    `V001__initial.sql`, exercising transaction ownership, group serialization, and exact decimal
    mapping.
  - **File-mode tests** in temporary directories: restart durability, first launch, reopen,
    upgrade and checksum refusal, interrupted migration, the exclusive lock, receipt protocol
    boundaries, and closed-application backup/restore. In-memory H2 alone is never durability
    evidence.
  - **Operational failures**: injected failures (failing decorators around `TransactionRunner`,
    repositories, the notification writer, and `ReceiptStore`) before commit, after commit, and with
    uncertain commit, verifying `NOT_COMMITTED`, `COMMITTED`, and `UNKNOWN` outcomes and
    single-result retries (US1-AS8, US1-AS9, US2-AS12, US3-AS14, US4-AS10, US7-AS7).
  - **Lifecycle and payment edges**: settled-membership refusal with scalar zero (US2-AS3),
    departure cancellation, succession and archive (US2-AS8 to US2-AS11), reservations and stale
    confirmation (US6-AS7 to US6-AS9), and terminal-state refusals (US4-AS9).
  - **Presentation**: headless controller tests for loading, empty, error, unknown-outcome,
    duplicate-submit, and post-sign-out suppression states (US1-AS10).
  - **Architecture**: one test enforcing the package dependency rule of R-01.
- **Measurements**: usability (NFR-003/SC-009 and SC-002) and performance (NFR-004, US8-AS7) are
  measured by the separate protocols in [quickstart.md](quickstart.md). The performance workload is
  tagged and run explicitly with its environment recorded; neither measurement is inferred from
  `mvn verify` or from the other.
- **Rationale**: Principle V and NFR-007 traceability; fakes keep rule tests fast, real-schema and
  file-mode tests catch what fakes cannot.

## R-09 Swing structure and operational feedback

- **Decision**: one `MainFrame` with a `CardLayout` (Login, Dashboard), dialogs for forms; each
  panel has a controller that calls services and renders results. Earlier assumption that no long
  operation is expected is withdrawn.
  - **Worker and event-thread responsibilities**: password hashing, image decoding, JDBC calls,
    filesystem access, and report computation run in background workers (`SessionWorker`, a
    `SwingWorker` subclass). The event dispatch thread only reads input and updates components.
  - **Operation outcomes**: controllers allocate a stable operation UUID per authenticated
    persistent command and render the `OperationOutcome` of its `CommandResult` or `AppException`:
    `NOT_COMMITTED` (not saved), `COMMITTED` (saved), or `UNKNOWN`
    (outcome unknown). After UNKNOWN the form stays filled, further submission is disabled, and a
    status-check action calls `CommandRunner.lookup`; a retry reuses the same operation ID.
    A committed write followed by a failed refresh is shown as saved. Registration uses the
    sign-in check described in the plan instead of replay.
  - **Loading and duplicate prevention**: while an operation runs, the screen shows a loading
    state, stays responsive, and disables the submitting control, so repeated clicks create no
    duplicate action.
  - **Retained input**: field errors name the field and keep every other entry (NFR-005);
    operational errors keep all entries and are never shown as invalid input (NFR-010).
  - **Empty states**: no groups, no expenses, no notifications, no balances (shown as settled), and
    empty reports with 0.00 totals each have explicit screen text.
  - **Sign-out handling**: sign-out ends the session token; a worker result whose session token
    is no longer current is discarded and never rendered, so a late result cannot reveal
    the previous member's data.
  - **Startup and storage failures**: shown as safe actionable messages without technical detail;
    technical causes go to the local log.
- **Rationale**: keeps views passive and logic out of Swing (Principle III) and satisfies NFR-010
  and NFR-011. The local MVP has no network dependency; network failure belongs to the deferred
  clients.
