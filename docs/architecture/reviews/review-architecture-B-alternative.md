# Architecture B review: alternative design

Date: 2026-11-05  
Project: SplitSmart, CIS 285  
Assessment: useful direction for a later shared service; significant contract and scope corrections are needed before selecting it for the course MVP.

## Review basis

The authoritative inputs are [UserRequirement.md](../../../UserRequirement.md), the [constitution](../../../.specify/memory/constitution.md), and the complete [feature specification](../../../specs/001-splitsmart-expense-sharing/spec.md). The reviewed alternative is [docs/architecture/alternative-architecture.md](../alternative-architecture.md), sections 1–11, read in full. A's plan, research, data model, service and screen contracts, and quickstart were also read in full for comparison.

This is a design review, not evidence of implemented behavior or passing tests. **Covered** means a credible, sufficiently specified design path; **Partial** means intent is present but an important contract or lifecycle detail is unresolved; **Missing** means there is no concrete treatment; **Deferred** means outside the specified MVP. The REST table explicitly says it is abridged: an unlisted route is not proof that a feature is impossible. Conversely, printing an FR range beside a route does not specify every behavior in that range. B explicitly inherits A's password hashing, but does not declare general inheritance of all A contracts.

## Design summary

B separates a dependency-light Java core from HTTP and persistence adapters. Four Maven modules contain the core, a Javalin server, a typed Java HTTP client, and a thin Swing desktop application. PostgreSQL is the central database; receipts use object storage. The server exposes a versioned JSON API with decimal-string money values, server-held sessions, and a notification stream.

Approved expenses and confirmed payments create immutable debt-ledger entries in the same transaction as their status changes. Synchronous domain events create in-app notifications in that transaction. Optimistic row versions protect decisions, while Serializable payment-recording transactions include outstanding payment reservations.

The shared server anticipates future web, Android, and iOS clients, but those clients are still later work. It also changes the first release from the specified local, single-machine MVP into a network-dependent system.

## Strengths

- Central data ownership and a common versioned API are a direct foundation for the customer's eventual cross-platform product.
- Inbound use cases and outbound repository, clock, hashing, receipt, and event ports create good seams for isolated rule tests and alternative adapters.
- B explicitly addresses simultaneous decision attempts and several pending payments. These controls are more developed than A's concurrency policy.
- Status changes, money entries, and current in-app notifications share transactions. The present synchronous notification design does not require a separate delivery queue to become atomic.
- Decimal strings prevent transport-level conversion of money into binary floating-point values. Opaque random sessions, hashed server-side token storage, expiry, PBKDF2, and an HTTPS proxy are specified.
- Flyway migrations, PostgreSQL adapter tests, and database backup/PITR planning improve the operational foundation for a future hosted service.

## Weaknesses and risks

The ledger illustration and its claimed zero-sum database check describe incompatible representations. Payment creation is protected, but later confirmation after another ledger movement remains underspecified. Authentication is considerably more detailed than resource authorization.

B identifies most functional areas through broad endpoint ranges but does not carry forward complete money, approval, membership, receipt, validation, summary, or acceptance contracts. Several are partial coverage rather than proven incorrect algorithms. Network timeouts and uncertain outcomes introduce duplicate-create risks absent from a purely local call boundary.

Four modules, a server, PostgreSQL, an HTTPS proxy, receipt storage, containers, and client session handling add implementation and operational work before deferred clients are delivered. The module graph improves dependency direction but does not make misplaced business logic impossible. The networked MVP also needs an explicit owner decision because it differs from the specification's local-storage assumption.

## Requirement coverage

Ranges are inclusive. Partial marks a documented intent with missing behavioral detail; it does not assert that an unspecified implementation is already defective.

| Requirement IDs | Status | Reason |
|---|---|---|
| FR-001–FR-002 | Partial | Section 4 supplies account/session routes and token mechanics, but registration validation and generic failure feedback are not contracted fully. |
| FR-003 | Covered | DELETE /sessions/current provides an explicit sign-out operation; detailed revocation and client cleanup remain security-contract work. |
| FR-004 | Partial | Identity is authenticated; per-resource membership and ownership checks are unspecified; B-D3. |
| FR-005 | Covered | Section 4 explicitly inherits the base PBKDF2 password-storage design. |
| FR-006 | Covered | PostgreSQL owns persistent account/domain data independently of the desktop process. |
| FR-007–FR-010 | Partial | Group routes exist, but creator-only mutations, initial membership, and member-list authorization need explicit use-case rules; B-D3 and B-D8. |
| FR-011 | Partial | Group management is mapped, but the balance refusal and pending-work/creator lifecycle contract are not defined; B-D8. |
| FR-012–FR-013 | Partial | Record-expense intent exists; required fields, member eligibility, participant minimum, and payer default/toggle need a concrete request/use-case contract. |
| FR-014–FR-016 | Partial | Money, SplitCalculator, AmountRules, and decimal strings are present, but exact internal scale, rounding, remainder order, and validation rules are not explicitly adopted; B-D6. |
| FR-017 | Partial | ReceiptStore and a 5 MB JPEG/PNG limit exist; validated storage, authorized viewing, and recovery are undefined; B-D5. |
| FR-018 | Partial | The expense route names the requirement range without a required-description/date error contract. |
| FR-019 | Covered | The API includes an expense-preview operation and the desktop is intended to render API results. |
| FR-020 | Partial | Core Share and later ledger entries are named, but persisted participant order/shares before approval are not contracted. |
| FR-021–FR-022 | Partial | Section 7 makes notification persistence transactional, but exact recipients, creator exclusion, and decision-notification routing remain ID references rather than defined handler rules. |
| FR-023 | Partial | Inbox/PATCH routes and SSE are provided; unread-count, mark-read/open behavior and ownership checks need definition. |
| FR-024 | Deferred | Additional push/email handlers are a future extension, not a delivered channel. |
| FR-025 | Partial | Only approval posts money, but new-expense Pending initialization and its acceptance contract are not explicit. |
| FR-026–FR-029 | Partial | ApprovalPolicy and a decision endpoint exist; exact approvers, empty-set refusal, rejection reason, decision history, and authorization need adoption; B-D3 and B-D8. |
| FR-030 | Deferred | No configurable multilevel approval design is supplied; the specification's deferral remains. |
| FR-031 | Partial | Pairwise netting is described, but the ledger/check contradiction can prevent valid source movements; B-D1. |
| FR-032–FR-033 | Partial | The balances route has a group filter but no result contract for counterparty totals, group breakdowns, and overall position. |
| FR-034 | Partial | Zero-sum enforcement is claimed, but the illustrated posting does not meet the stated check; B-D1. |
| FR-035–FR-036 | Partial | Payment routes and versions exist; payer identity, receiver-only decisions, state initialization, and decline/no-effect rules need explicit contracts. |
| FR-037 | Partial | Pending reservations and Serializable recording are specified; confirmation after debt changes remains unresolved; B-D2. |
| FR-038 | Partial | The abridged payment API does not define the sent/received history result or its display. |
| FR-039–FR-042 | Partial | Reports are mapped, but summary semantics, inclusive ranges, invalid/empty results, and item-matching totals need concrete contracts. |
| FR-043 | Deferred | No report-export delivery is proposed. |
| FR-044–FR-046 | Deferred | Future clients can share the API, but web, Android, and iOS applications are not supplied by this design. |
| FR-047 | Partial | Section 5 makes ledger entries immutable; that alone does not prohibit editing/deleting an Approved expense or its shares. |
| NFR-001 | Partial | Exact transport is specified, but rounding and the ledger invariant require correction; B-D1 and B-D6. |
| NFR-002 | Partial | The authorization policy for groups, receipts, notifications, and SSE is not defined; B-D3. |
| NFR-003 | Missing | No first-time-user timing target or usability verification activity is proposed; B-D9. |
| NFR-004 | Missing | No 20-member/1,000-expense/two-second workload or end-to-end measurement plan is specified; B-D9. |
| NFR-005 | Partial | The remote boundary lacks field-error responses and preserved-input/loading/retry behavior; B-D4. |
| NFR-006 | Partial | Persistent PostgreSQL and backups exist, but database/object receipt consistency and recovery are incomplete; B-D5. |
| NFR-007 | Partial | Endpoint FR ranges and test infrastructure do not establish ID-based acceptance coverage; B-D9. |
| NFR-008 | Deferred | HTTPS and hosting components do not establish the later web client's 99.5% uptime target. |
| NFR-009 | Deferred | Shared storage/SSE are foundations; future clients and measured whole-data propagation within 10 seconds remain undelivered. |

## Constitution compliance

| Principle | Assessment | Evidence and qualification |
|---|---|---|
| I. Customer requirements are the source of truth | Partial | Section 1 keeps future clients visible, but a shared-server MVP changes the local MVP assumption without a recorded scope decision; B-D10. |
| II. Requirement traceability | Partial | Section 4 maps endpoint groups to FR ranges. Use-case/model/test links and NFR coverage are not specified completely; B-D9. |
| III. Object-oriented design and GUI separation | Aligned intent; enforcement overstated | Core domain/use cases and ports support separation, but module dependencies cannot prevent duplicated client arithmetic or JDK GUI/SQL imports; B-D7. Encapsulated entity behavior still needs design evidence. |
| IV. Exact BigDecimal arithmetic | Partial | Decimal strings and BigDecimal mapping are good foundations; explicit scale/rounding/remainders and a coherent ledger invariant are still needed; B-D1 and B-D6. |
| V. JUnit 5 verified behavior | Partial, not execution-verified | JUnit 5 and adapter infrastructure exist as choices, but a requirement-indexed suite and acceptance/build gates are missing; B-D9. |
| VI. Human review | Not evidenced in this document | Section 10 asserts compliance without documenting the required review/acceptance gate. The project-wide gate still applies; B-D9. |

Section 9 gives documented reasons for the added application libraries; their existence is not itself a constitutional violation. B retains Java 21, Maven, and Swing. Containers, the shared server, and operational dependencies nevertheless add scope. The document does not establish PlantUML traceability or completion of review and verification obligations.

## Concrete defects and fixes

All section references below refer to [docs/architecture/alternative-architecture.md](../alternative-architecture.md).

### B-D1 — High: ledger rows and the claimed zero-sum check conflict

**Location:** [section 5, The ledger](../alternative-architecture.md#5-the-ledger), event table and database-check bullet; section 2, money driver.

An approved expense inserts positive directed debt rows, one per nonpayer participant. A payment inserts a negative row. A valid posting containing B→A +33.33 has a row-amount sum of +33.33, yet the document says each posting nets to zero under a database check. These are obligation edges, not balanced debit/credit legs. Signed member positions can sum to zero by interpreting both endpoints of each edge; that is a different invariant. A literal posting-sum check would reject valid expenses.

**Fix:** choose the representation explicitly. Either retain directed obligation edges and define/test their derived signed-member invariant, or introduce posting IDs and equal/opposite member-account legs, retaining counterparty identity for pairwise balances. Specify transaction-level enforcement: an ordinary row CHECK cannot establish a sum across a posting's other rows. Add a unique source/posting identity to make exactly-once source posting explicit. Test one expense, its reverse, and a confirmed settlement.

### B-D2 — High: recording-time reservations do not cover changed debt at confirmation

**Location:** [section 6, Concurrency](../alternative-architecture.md#6-concurrency), both bullets; [section 5, payment-confirmed entries](../alternative-architecture.md#5-the-ledger).

B already counts Awaiting Confirmation payments and uses Serializable isolation when recording; that is a strength. The remaining gap is confirmation after another ledger movement. B owes A 100.00 and records 100.00 pending. A later approved reverse expense reduces that debt to 20.00. The original payment row's version need not change, and section 5 still posts −100.00 on confirmation. No current-debt revalidation or reservation-reconciliation policy is specified for this case.

**Fix:** validate the live pairwise debt in the confirmation transaction and coordinate with all expense/payment writers affecting that group/pair. Define how reverse-direction reservations are handled when debt changes. Specify conflict results and bounded retries for both optimistic and Serializable failures. Test sequential and simultaneous reverse-expense/confirmation cases; do not treat a payment-row version as a version of the pair balance.

### B-D3 — High: authentication has no complete authorization contract

**Location:** [section 3, server auth filter](../alternative-architecture.md#3-module-structure-multi-module-maven); [section 4, Authentication and REST API](../alternative-architecture.md#authentication); [section 11, Security](../alternative-architecture.md#11-risks).

The token identifies a caller, but the design does not specify membership, creator, approver, receiver, notification-owner, receipt, or stream-access predicates. Resource IDs in authenticated requests must not become authorization. The identified rate-limiting/token-handling risk also has no concrete control contract. This is an unspecified security boundary, not a claim of a demonstrated exploit. Token randomness, hashing, expiry, PBKDF2, and HTTPS already exist in the design.

**Fix:** derive the actor from the validated session and enforce resource/role checks in use cases on every read and mutation, including report filters, receipt retrieval, and SSE reconnects. Never trust actor IDs supplied by clients. Define sign-out revocation and client cleanup, safe token storage, sign-in throttling, and generic authentication errors. Add cross-group/object-ID, wrong-role, expired-session, and removed-member tests.

### B-D4 — High: uncertain network outcomes and retries can duplicate creations

**Location:** [section 4, REST API](../alternative-architecture.md#rest-api-v1-abridged); [section 6, Concurrency](../alternative-architecture.md#6-concurrency); [section 11, Offline use](../alternative-architecture.md#11-risks).

HTTP replaces local service calls, but no timeout, error envelope, retry, or idempotency contract is defined. A server can commit an expense or payment and lose the response. Retrying its POST can create another record and another notification. Versions on existing rows do not deduplicate creation. Validation feedback and Swing loading behavior also remain uncontracted.

**Fix:** add actor-scoped idempotency keys for creation with persisted request/result identity in the creation transaction. Define validation, unauthorized, forbidden, conflict, and unavailable outcomes, including field names and preserved input. Run HTTP/SSE work off the Swing event thread; show loading and connection-loss states and prevent accidental resubmission. Define reconnect/status recovery and bounded retries rather than blindly retrying a mutation.

### B-D5 — Medium: receipt storage has no complete access or recovery lifecycle

**Location:** [section 3, ReceiptStore port](../alternative-architecture.md#3-module-structure-multi-module-maven); [section 4, Runtime view](../alternative-architecture.md#4-runtime-view); [section 8, Receipt storage and Database](../alternative-architecture.md#8-deployment).

The design specifies an S3-compatible bucket or local folder and a 5 MB JPEG/PNG limit. It does not define content decoding, private retrieval, the expense reference, database/object partial failure handling, or coordinated recovery. Database PITR does not restore deleted receipt objects. The defect is this missing lifecycle, not merely the absence of a route from an abridged table.

**Fix:** adopt validated content inspection, stable non-user-controlled object keys, authenticated expense-based retrieval or short-lived authorized links, and a staged upload/finalization/cleanup protocol. Keep objects private and avoid exposing arbitrary storage paths. Define object retention/versioning with database restore points and test partial upload, failed commit, missing object, and restored expense/receipt consistency.

### B-D6 — Medium: decimal transport does not define the money algorithm

**Location:** [section 3, Money/SplitCalculator/AmountRules](../alternative-architecture.md#3-module-structure-multi-module-maven); [section 4, money transport](../alternative-architecture.md#rest-api-v1-abridged); [section 9, Jackson justification](../alternative-architecture.md#9-libraries-beyond-the-constitution-justification-required).

These sections name the right abstractions and BigDecimal mapping but do not explicitly adopt the required scale, RoundingMode.DOWN, percentage validation, participant-order remainder rule, or prohibition on float/double money construction and intermediate arithmetic. Unlike password hashing, the money contract is not stated to inherit the base design. Decimal JSON strings alone cannot establish Principle IV compliance.

**Fix:** explicitly adopt A's R-04 and Share rules as the shared contract: BigDecimal throughout, exact input validation, stated division/percentage scale and rounding, and listed-order remainder allocation. Preserve participant order in persistence and requests. Verify exact shares and group positions, including tiny expenses that yield zero-cent participant shares; do not apply the positive expense-input minimum to computed shares.

### B-D7 — Medium: the claimed compiler guarantees are false

**Location:** [section 2, GUI-independence driver](../alternative-architecture.md#2-drivers); [section 3, dependency-rule paragraph](../alternative-architecture.md#3-module-structure-multi-module-maven).

The document says the module graph enforces no Swing/HTTP/JDBC dependencies in core and makes balance logic in Swing impossible. Swing, JDBC, and the Java HTTP client are JDK APIs, while core is allowed to depend on the JDK. Desktop can also duplicate arithmetic without importing core. Maven module separation does not prove either claim.

**Fix:** retain the useful module boundaries but correct the assurance. Add import/dependency architecture checks or explicit Java module restrictions, pure-core tests, and review of controllers for duplicated business decisions. Define the desktop as rendering server-calculated shares, balances, and approval results.

### B-D8 — Medium: approval and membership lifecycle contracts are incomplete

**Location:** [section 3, ApprovalPolicy and use cases](../alternative-architecture.md#3-module-structure-multi-module-maven); [section 4, group and approval endpoint rows](../alternative-architecture.md#rest-api-v1-abridged); [section 5, correcting-expense statement](../alternative-architecture.md#5-the-ledger).

The endpoint mappings do not define creator exclusion, the unique payer/participant approver set, no-approver refusal, all-required approval, rejection reasons/history, or the effect of removing a zero-balance member with pending work. A required approver can have zero confirmed balance; applying membership-based access later can strand that expense. Creator departure is likewise unresolved. Immutable ledger rows also do not prevent an Approved expense or its shares from being edited independently.

**Fix:** explicitly carry forward the base expense/approval contracts and FR-047's source-record immutability. Record an owner-approved membership/creator lifecycle policy consistent with US2-AS6, resolve affected pending work atomically, and preserve historical references. Test creator distinct from payer, payer also a participant, empty approvers, removal before decision, rejection races, and attempts to change approved source records.

### B-D9 — Medium: compliance assertions exceed the acceptance plan

**Location:** [section 3, parent POM and test choices](../alternative-architecture.md#3-module-structure-multi-module-maven); [section 8, test setup](../alternative-architecture.md#8-deployment); [section 10, Constitution fit](../alternative-architecture.md#10-trade-offs).

JUnit 5, pure-core tests, and Testcontainers provide infrastructure, but the design does not specify requirement-named acceptance coverage, diagram/class/test links, mandatory money/concurrency edge suites, the mvn verify gate, measurable NFR checks, or the required human acceptance process. Section 10 nevertheless labels constitution fit as passing. Infrastructure is not evidence of those gates being met.

**Fix:** add a requirement-indexed test and review plan, including input validation, privacy, complete reports, empty states, recovery, reservations, stale confirmations, and decision conflicts. Measure the one-minute expense flow separately from the three-minute onboarding journey and time end-to-end balance/report responses on the specified dataset. Require a clean-checkout mvn verify and human sign-off, with deferred requirements retained for later verification. Describe compliance as planned until evidence exists.

### B-D10 — Medium: the networked MVP is an unreconciled scope change

**Location:** [sections 1–2, Summary and Drivers](../alternative-architecture.md#1-summary); [section 11, Offline use](../alternative-architecture.md#11-risks). Compare [spec.md, Overview and Scope and Assumptions](../../../specs/001-splitsmart-expense-sharing/spec.md#assumptions).

B requires a shared server for the first Swing release, while the specification explicitly assumes single-machine local storage and defers multi-device synchronization. This may be a reasonable proposal, but it is a change to the accepted planning baseline, not automatic fulfillment of the customer's deferred clients. The unconditional constitution-fit statement does not acknowledge that decision dependency.

**Fix:** present a networked first release as a proposed scope change for the owner. If selected, record the dated decision and reconcile the specification, operational responsibilities, and any applicable constitution exception before implementation. Keep actual web/mobile delivery, web uptime, and whole-data propagation targets deferred until their acceptance criteria are met.

## Scores

Scale: 1 = poor, 3 = adequate with material gaps, 5 = excellent. For course-timeline risk, 5 means the lowest delivery risk. The larger exposed boundary is included in security and deployment scores.

| Criterion | Score / 5 | Rationale |
|---|---:|---|
| Requirement fit | 3 | Broad use-case alignment and future platform fit, but major money, lifecycle, and contract gaps remain. |
| Constitution fit | 3 | Strong separation intent and dependency justifications; explicit money rules, traceability, and acceptance gates need completion. |
| Simplicity | 2 | Four modules and multiple deployed components exceed the local MVP's needs. |
| Testability | 4 | Ports, pure-core tests, and realistic PostgreSQL adapter tests provide good seams. |
| Extensibility to web/Android/iOS | 5 | Central ownership and a versioned API are directly reusable by future clients. |
| Security | 2 | Good authentication/TLS foundations, but authorization and token/receipt boundary controls are underspecified. |
| Deployability | 2 | Migrations and backup intent help; hosting, proxy, database, storage, and recovery require sustained operational work. |
| Risk for a course timeline | 2 | Network, security, ledger, and operational work compete with completing the graded MVP behaviors. |
