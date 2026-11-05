# Architecture A review: base design

Date: 2026-11-05  
Project: SplitSmart, CIS 285  
Assessment: suitable foundation for the course MVP, with corrections required before implementation acceptance.

## Review basis

This review assesses the documented design, not an implementation or executed tests. The authoritative inputs are [UserRequirement.md](../../../UserRequirement.md), the [constitution](../../../.specify/memory/constitution.md), and the complete [feature specification](../../../specs/001-splitsmart-expense-sharing/spec.md), including its clarifications and acceptance scenarios.

Architecture A consists of [plan.md](../../../specs/001-splitsmart-expense-sharing/plan.md), [research.md](../../../specs/001-splitsmart-expense-sharing/research.md), [data-model.md](../../../specs/001-splitsmart-expense-sharing/data-model.md), [contracts/service-api.md](../../../specs/001-splitsmart-expense-sharing/contracts/service-api.md), [contracts/ui-screens.md](../../../specs/001-splitsmart-expense-sharing/contracts/ui-screens.md), and [quickstart.md](../../../specs/001-splitsmart-expense-sharing/quickstart.md). All were read in full.

Coverage labels mean: **Covered** = a credible, sufficiently specified design path; **Partial** = an intended path has an identified contract or lifecycle gap; **Missing** = no concrete design or verification activity addresses it; **Deferred** = explicitly outside the MVP. Covered does not mean implemented, tested, or accepted.

## Design summary

A is a layered monolith in one Java 21 Maven module. Swing views and controllers call application services; plain Java domain objects and rule classes implement splitting, approvals, balances, and reporting. JDBC repositories persist relational data in an embedded H2 file. Receipt images are separate local files. Manual dependency wiring avoids a framework container.

Expenses start Pending, require every involved non-creator to approve, and become immutable when Approved. Balances are derived from approved shares and confirmed payments rather than maintained as a second stored balance. One member signs in at a time on one machine. Web, Android, iOS, external notifications, configurable approval levels, and report export remain deferred.

## Strengths

- The deployment and dependency count suit a course project: one process, one embedded database, one executable JAR, and no hosted service.
- The domain and service boundaries preserve reusable business logic without putting money calculations in Swing. Pure rule tests and real-schema H2 service tests are appropriate complementary checks.
- Money rules are unusually explicit: string-to-BigDecimal parsing, scale two, downward rounding, persisted participant order, remainder allocation, and exact-sum invariants.
- The design already handles important edges: refusing an expense with no approver, excluding its creator from approval, requiring rejection reasons, receiver-only payment decisions, and prohibiting changes to approved expenses.
- Password hashing, generic sign-in errors, membership checks, receipt decoding, field-specific validation, and preservation of other form entries are specified. These should not be mistaken for missing features.
- Keeping expenses, shares, payments, and timestamped approval decisions provides an inspectable source history even without a separate posting ledger.

## Weaknesses and risks

The main correctness risk is payment confirmation after multiple pending records or an intervening change in debt. Membership removal also interacts badly with pending approvals and the sole creator role. The read API does not fully support the promised expense list or balances by counterparty across groups.

H2 transactions do not establish atomicity with external receipt files. Operational failures and consistent backups are less developed than ordinary validation. The responsiveness target is stated, but performance and usability measurements are not planned concretely.

The one-session constraint materially reduces concurrency exposure. A simultaneous multi-user approval race is not established as a present deployment defect. Sequential payment overcommit remains possible under that constraint. If background execution or remote clients are added, transaction isolation and decision serialization must be revisited. Internal notification writes should explicitly participate in the originating use-case transaction; the internal callbacks in the service contract should not open independent commits.

## Requirement coverage

Ranges are inclusive and use one status only where the same assessment applies to every ID in the range.

| Requirement IDs | Status | Reason |
|---|---|---|
| FR-001–FR-002 | Covered | AccountService, User rules, and R-03 specify registration, password policy, uniqueness, hashing, and generic sign-in failure. |
| FR-003 | Covered | AccountService exposes signOut and the screen contract includes the account flow. |
| FR-004 | Partial | Session membership checks exist, but discovering and reopening group expenses is incomplete; A-D3. |
| FR-005 | Covered | R-03 and User specify salted PBKDF2 rather than readable passwords. |
| FR-006 | Covered | File-mode H2 and quickstart scenario 9 cover account data across restarts. |
| FR-007–FR-010 | Covered | GroupService and the Group screen map creation, creator management, renaming, and member-list visibility. |
| FR-011 | Partial | The balance guard exists, but removal with pending work and creator departure are unresolved; A-D2. |
| FR-012–FR-013 | Covered | ExpenseDraft, the member checks, and ordered participant controls support the specified creation and selection rules; retain the specification's payer default and unselect behavior. |
| FR-014–FR-016 | Covered | R-04, Share, Percentage, AmountRules, and preview define exact equal/percentage splitting and amount limits. |
| FR-017 | Partial | Optional validated images and retrieval exist, but database/file failure consistency is unspecified; A-D5. |
| FR-018–FR-020 | Covered | Required description/date, previewed shares, and persisted ordered shares are explicitly modeled. |
| FR-021–FR-022 | Covered | Notification callbacks, recipient rules, and notification types cover creation, decisions, payments, and creator exclusion. |
| FR-023 | Covered | Inbox, unreadCount, markRead, and the Notifications screen provide the required interactions. |
| FR-024 | Deferred | R-07 explicitly defers delivery outside the application. |
| FR-025 | Covered | Pending is the initial state and is excluded from derived balances. |
| FR-026–FR-027 | Partial | Creation-time approver rules are correct, but a required approver can lose access before deciding; A-D2. |
| FR-028–FR-029 | Covered | Rejection reason, terminal rejection, actor, and decision timestamp are modeled and exposed in details. |
| FR-030 | Deferred | Configurable multiple approval levels remain outside the single-level MVP. |
| FR-031 | Covered | BalanceCalculator nets each pair from approved shares and confirmed payments without group debt simplification. |
| FR-032–FR-033 | Partial | Per-group pair balances and an overall position exist; an all-groups per-counterparty result is undefined; A-D4. |
| FR-034 | Covered | Group zero-sum positions are an explicit invariant with planned invariant tests. |
| FR-035–FR-036 | Covered | Payment recording, awaiting status, receiver-only confirmation/decline, and confirmed-only balance effects are specified. |
| FR-037 | Partial | Recording-time limits do not establish safety across several pending payments or later debt changes; A-D1. |
| FR-038 | Covered | PaymentService.history and the Payments screen expose sent and received records with status. |
| FR-039–FR-040 | Covered | Summary and customReport provide the specified summary and date/group/type filtering contracts. |
| FR-041 | Partial | ReportService maps the requirement, but ReportQuery validation and empty-result/zero-total behavior are not defined beyond that reference. |
| FR-042 | Covered | The report flow explicitly totals listed items with Money.sum. |
| FR-043 | Deferred | Reports remain on screen; file export is retained for a later release. |
| FR-044–FR-046 | Deferred | The plan explicitly delivers desktop only and retains the web, Android, and iOS inventory. |
| FR-047 | Covered | Approved is final, and deleteExpense refuses deletion except for a Pending expense by its creator. |
| NFR-001 | Covered | BigDecimal, database decimals, centralized rounding, and monetary invariant tests are specified. |
| NFR-002 | Covered | Session-based service membership checks protect group reads/writes, including receipt retrieval through ExpenseService. |
| NFR-003 | Missing | No first-time-user timing activity or one-minute expense-entry criterion appears in A's verification plan; A-D8. |
| NFR-004 | Partial | The 20-member/1,000-expense/two-second target is stated without a timed acceptance workload; A-D8. |
| NFR-005 | Covered | ValidationException carries a field and message; the UI contract preserves all other entries. |
| NFR-006 | Partial | Database restart durability is addressed, but external receipts and backup recovery need a complete protocol; A-D5 and A-D7. |
| NFR-007 | Partial | FR-prefixed tests are planned, but explicit NFR test mappings and measurable checks are incomplete; A-D8. |
| NFR-008–NFR-009 | Deferred | Web uptime and cross-client propagation belong to the deferred networked release. |

## Constitution compliance

| Principle | Assessment | Evidence and qualification |
|---|---|---|
| I. Customer requirements are the source of truth | Aligned | plan.md, Constitution Check, preserves the customer inventory and labels desktop delivery as an implementation decision. |
| II. Requirement traceability | Partial | Service methods and data rules name FRs; R-08 requires ID-prefixed tests. NFR mappings and links through models, classes, and tests still need an explicit completion check; A-D8. |
| III. Object-oriented design and GUI separation | Aligned in design | Domain entities, encapsulating money types, rule classes, service boundaries, and the planned import check support a GUI-independent core. Implementation must demonstrate actual encapsulation. |
| IV. Exact BigDecimal arithmetic | Aligned in design | R-04 and Share define the scale, rounding mode, participant order, exact totals, and invariant tests. |
| V. JUnit 5 verified behavior | Planned, not demonstrated | Pure rules, H2 service/repository tests, requirement names, and mvn verify are specified. Documents cannot establish passing tests; acceptance also needs the missing checks in A-D8. |
| VI. Human review | Review process stated; acceptance unverified | The plan requires review before task generation. Owner acceptance and the constitution's review gate remain necessary; a PASS label is not a sign-off record. |

H2 has the required library justification in R-02. Java 21, Maven, Swing, and JUnit 5 match the course constraints. The reviewed design documents do not establish completion of the constitution's PlantUML-to-code traceability obligation.

## Concrete defects and fixes

### A-D1 — High: payment confirmation does not establish a current debt limit

**Location:** [plan.md, Architecture Overview → Key flows → Payment](../../../specs/001-splitsmart-expense-sharing/plan.md#key-flows); [service-api.md, PaymentService](../../../specs/001-splitsmart-expense-sharing/contracts/service-api.md#paymentservice-cr-08); [data-model.md, State transitions](../../../specs/001-splitsmart-expense-sharing/data-model.md#state-transitions).

The flow validates the owed amount when recording, while confirmation is described only as a receiver decision and state transition. Suppose B owes A 30.00. Two separate payments of 30.00 can each pass recording because neither pending payment changes the balance. If both are confirmed under the documented transition, the second creates a reverse debt. This is a sequential case, independent of concurrent sessions. A reverse expense approved after recording causes the same stale-limit problem.

**Fix:** re-read the current group/pair debt and validate the amount within the transaction that confirms the payment. Serialize the check and transition with other balance-changing operations and reject obsolete over-limit confirmation without changing balances. Test two pending payments and an intervening reverse expense. A reservation policy like B's is an additional possible safeguard and must distinguish available-to-record amounts from confirmed balances.

### A-D2 — High: membership and creator departure can strand workflows

**Location:** [data-model.md, Membership and Group](../../../specs/001-splitsmart-expense-sharing/data-model.md#membership); [plan.md, Key flows and Cross-cutting decisions](../../../specs/001-splitsmart-expense-sharing/plan.md#cross-cutting-decisions).

Removal is guarded by the current group balance. Pending expenses have no balance effect, so a required approver can be removed at zero and then fail the membership check on every approval service call. All-approver completion can become unreachable. Likewise, a creator can leave at zero while creatorId remains the only management authority and membership checks prevent that former member from using it.

**Fix:** record an owner-approved lifecycle clarification covering pending expenses/payments and creator departure. Define atomic resolution steps and their history, and either a continued creator role or an agreed ownership transition. Do not silently prohibit every zero-balance removal: specification US2-AS6 expects it to succeed. Preserve historical actors and test removal before approval, before payment confirmation, and after settlement.

### A-D3 — Medium: the Group screen lacks an expense-list query

**Location:** [ui-screens.md, Group row](../../../specs/001-splitsmart-expense-sharing/contracts/ui-screens.md#contract-desktop-screens); [service-api.md, GroupService and ExpenseService](../../../specs/001-splitsmart-expense-sharing/contracts/service-api.md#expenseservice-cr-03-cr-04).

The screen promises expenses but calls GroupService and BalanceService. Neither lists expenses, and ExpenseService only retrieves an expense by an already-known ID. After restart a creator has no specified discovery path through their own notifications or approval inbox, since both correctly exclude their own creation action.

**Fix:** add an authorized listExpenses(Session, groupId) returning summaries and stable IDs, wire the Group screen to it, and verify that a creator can reopen Pending, Approved, and Rejected records after restart.

### A-D4 — Medium: cross-group balances lack a defined counterparty result

**Location:** [service-api.md, BalanceService](../../../specs/001-splitsmart-expense-sharing/contracts/service-api.md#balanceservice-cr-07); [ui-screens.md, Dashboard and Group rows](../../../specs/001-splitsmart-expense-sharing/contracts/ui-screens.md#contract-desktop-screens).

The contract supplies myBalances(Session, groupId) and an undefined NetPosition from myOverallPosition. The screens expose per-group pairs and an overall position. Neither defines the per-counterparty aggregate required by FR-032/FR-033 and US5-AS4. One scalar cannot explain relationships with several people.

**Fix:** define an all-groups result with each counterparty's net amount and group breakdown, alongside the overall position. Specify the null/all-groups query semantics or add a dedicated method and screen. Test the 30.00 G1 versus 10.00 reverse G2 example with an additional counterparty.

### A-D5 — Medium: receipt files are outside the transaction protocol

**Location:** [research.md, R-06 Receipt images](../../../specs/001-splitsmart-expense-sharing/research.md#r-06-receipt-images); [plan.md, Cross-cutting decisions → Transactions](../../../specs/001-splitsmart-expense-sharing/plan.md#cross-cutting-decisions); [service-api.md, deleteExpense](../../../specs/001-splitsmart-expense-sharing/contracts/service-api.md#expenseservice-cr-03-cr-04).

R-06 copies the file and stores its reference, while rollback is specified only for JDBC. No ordering, compensation, pending-deletion cleanup, or crash recovery is defined. A database transaction cannot undo a filesystem write. The result can be an orphan image or, with unsafe ordering, a committed reference without an available image. Type, size, ImageIO validation, and authenticated retrieval already exist.

**Fix:** define validated staging, durable final-file placement before reference commit, rollback cleanup, and startup orphan recovery. Delete files only after proving that no retained expense references them. Alternatively, justify storing receipt bytes transactionally in H2. Verify failures between file and database steps and reopening after interruption.

### A-D6 — Medium: the error contract excludes operational failures

**Location:** [plan.md, Cross-cutting decisions → Errors](../../../specs/001-splitsmart-expense-sharing/plan.md#cross-cutting-decisions); [service-api.md, opening contract](../../../specs/001-splitsmart-expense-sharing/contracts/service-api.md#contract-application-service-api); [research.md, R-09 Swing structure](../../../specs/001-splitsmart-expense-sharing/research.md#r-09-swing-structure).

Validation and permission failures are handled, but database startup/write failures, disk-full conditions, unreadable stored receipts, and uncertain commit outcomes have no application/UI contract. A validation dialog alone cannot communicate whether retrying will duplicate an already-saved action.

**Fix:** map storage failures to safe application errors, preserve input, state whether the operation committed, and provide a defined retry or status-check path. Include startup failure and unavailable-receipt states. Put hashing, decoding, database work, and other potentially slow I/O off Swing's event thread, with progress and duplicate-submit prevention, rather than relying on R-09's assumption that no long operation is expected.

### A-D7 — Medium: folder-copy backup lacks a consistency condition

**Location:** [plan.md, Deployment](../../../specs/001-splitsmart-expense-sharing/plan.md#deployment).

The entire backup instruction is to copy ~/.splitsmart. It does not require a clean shutdown or snapshot procedure. Copying a changing database and a separately changing receipts directory does not establish a coherent, recoverable backup.

**Fix:** for this MVP, require clean application shutdown before copying the whole directory. Document restoration into a separate directory and verify accounts, approval history, payments, and receipt references after restoring. An online backup would require a deliberate database snapshot and receipt-consistency protocol.

### A-D8 — Medium: measurable acceptance coverage is incomplete

**Location:** [research.md, R-08 Testing approach](../../../specs/001-splitsmart-expense-sharing/research.md#r-08-testing-approach); [plan.md, Technical Context and Constitution Check](../../../specs/001-splitsmart-expense-sharing/plan.md#technical-context); [quickstart.md, End-to-end validation scenarios](../../../specs/001-splitsmart-expense-sharing/quickstart.md#end-to-end-validation-scenarios).

The plan promises FR-prefixed tests and money invariants but supplies no concrete NFR-003 usability measurement, NFR-004 timed dataset check, or complete NFR-to-test mapping. Nine smoke scenarios are useful but are not the full acceptance inventory. The specification also distinguishes a one-minute expense-entry target from SC-002's three-minute registration/group/expense journey; one measurement cannot silently replace the other.

**Fix:** add an ID-based acceptance matrix for domain, service, repository, and presentation checks; a manual first-time-user timing protocol; and a repeatable 20-member/1,000-expense timing check. Include payment, membership, storage-failure, privacy, sign-out, invalid-input, and empty-report cases. Keep deferred acceptance obligations recorded for their future release rather than claiming they already pass.

### A-D9 — Low: the MVP requirement count is incorrect

**Location:** [plan.md, Technical Context → Scale/Scope](../../../specs/001-splitsmart-expense-sharing/plan.md#technical-context).

The plan says 40 MVP functional requirements. There are 47 total and six deferred: FR-024, FR-030, and FR-043–FR-046. The MVP count is 41. An incorrect count weakens the completeness gate.

**Fix:** correct the count when updating the plan and generate the acceptance inventory from the stable IDs, including FR-047.

## Scores

Scale: 1 = poor, 3 = adequate with material gaps, 5 = excellent. For course-timeline risk, 5 means the lowest delivery risk. Scores assess the current documented design, including its planned controls.

| Criterion | Score / 5 | Rationale |
|---|---:|---|
| Requirement fit | 4 | Broad, explicit MVP coverage; payment, lifecycle, and read-contract defects are bounded but important. |
| Constitution fit | 4 | Matches the mandated stack, separation, and exact-money policy; verification and traceability remain incomplete. |
| Simplicity | 5 | One module, one process, embedded persistence, and manual wiring minimize moving parts. |
| Testability | 4 | Pure rules and real-schema H2 tests are strong; recovery and presentation checks need completion. |
| Extensibility to web/Android/iOS | 3 | Business logic is reusable, but shared storage, remote authentication, and transport adapters still need design. |
| Security | 3 | Solid local application baseline; operational failures and the local filesystem trust boundary need explicit treatment. |
| Deployability | 4 | One JAR and Java 21 are practical; receipt and backup recovery need correction. |
| Risk for a course timeline | 4 | Low structural overhead leaves time for feature coverage and targeted correctness fixes. |
