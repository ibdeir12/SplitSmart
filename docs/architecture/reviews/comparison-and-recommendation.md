# Architecture comparison and recommendation

Date: 2026-11-05  
Project: SplitSmart, CIS 285

## Recommendation

Recommend **Architecture A as the foundation for the course MVP**, after correcting its payment, membership, read-contract, receipt, and recovery defects. Preserve B as a direction for a later shared service and adopt its useful boundary and transaction ideas selectively. The project owner makes the final decision; this review does not authorize a scope change or amend the specification.

The [customer request](../../../UserRequirement.md) still calls for web-first delivery with Android and iOS apps. The [constitution](../../../.specify/memory/constitution.md) and [specification](../../../specs/001-splitsmart-expense-sharing/spec.md) explicitly narrow the course MVP to local Swing delivery and retain those platforms as deferred requirements. A fits that baseline with less delivery overhead. B anticipates the eventual product more directly, but does not itself deliver the deferred clients and changes the first release into a network-dependent system.

The detailed evidence and fixes are in the [A review](review-architecture-A-base.md) and [B review](review-architecture-B-alternative.md). Both reviews assess documents, not implementation or test results. All requested source documents were read in full. No build or test execution was used as evidence.

## Side-by-side scores

Scale: 1 = poor, 3 = adequate with material gaps, 5 = excellent. For course-timeline risk, 5 means the lowest delivery risk. Scores are judgments about the current documented designs; they are not a substitute for acceptance evidence. No unweighted total is used because course delivery and future platform readiness have different priorities.

| Criterion | A / 5 | B / 5 | Main reason for the difference |
|---|---:|---:|---|
| Requirement fit | 4 | 3 | A provides fuller MVP rules and screen/service contracts; B supplies broader foundations with more unspecified behavior. |
| Constitution fit | 4 | 3 | A explicitly states rounding, traceable tests, and build gates; B needs stronger money and acceptance contracts. |
| Simplicity | 5 | 2 | One local module/process/database versus four modules and a hosted service stack. |
| Testability | 4 | 4 | Both isolate rules; B offers stronger ports, while A needs less infrastructure for service tests. |
| Extensibility to web/Android/iOS | 3 | 5 | A preserves reusable logic; B already defines the shared service and remote client boundary. |
| Security | 3 | 2 | A has a smaller local exposure; B has sound authentication primitives but incomplete network authorization and client controls. |
| Deployability | 4 | 2 | A needs Java and one JAR; B requires server, database, proxy, receipt storage, and operational recovery. |
| Risk for a course timeline | 4 | 2 | A leaves more time for complete acceptance coverage; B adds substantial work before platform clients exist. |

## Key trade-offs

| Topic | Architecture A | Architecture B | Review judgment |
|---|---|---|---|
| Current scope | Local Swing MVP with explicit deferrals. | Swing first, but requires a shared server immediately. | Prefer the existing baseline unless the owner explicitly changes it. |
| Future clients | GUI-independent rules and services can be adapted later. | Versioned API and central account data already define the integration point. | B is the stronger platform foundation; A does not require discarding its domain to get there. |
| Money source | Derives balances from approved shares and confirmed payments. | Adds immutable ledger entries at approval/confirmation. | A avoids a second representation to reconcile; B's ledger must first be made internally coherent. |
| Auditability | Retains expenses, shares, payments, and actor/timestamp decisions. | Adds an explicit immutable posting history with source links. | B can improve posting auditability; A already has meaningful source history. |
| Payment creation | Checks each payment against confirmed debt. | Serializable creation counts pending reservations. | Borrow B's explicit reservation reasoning, while keeping reservations separate from balances. |
| Payment confirmation | No live-debt safety protocol is specified. | Payment versions exist, but changed pair debt is not covered explicitly. | Both need confirmation-time revalidation coordinated with all relevant money writers. |
| Notifications | Internal service callbacks and stored rows. | Synchronous events write rows in the originating transaction, then stream updates. | Keep transaction participation explicit; current in-app delivery does not require a distributed queue. |
| Persistence | Embedded H2 and external image files. | PostgreSQL, migrations, and object receipts. | Both need database/receipt consistency and recovery; B adds remote storage and operational obligations. |
| Security boundary | Local process, session, and service membership checks. | Bearer sessions, REST/SSE, proxy, central database, and bucket. | B's additional boundary demands role/resource checks and careful session/receipt handling. |
| Failure handling | Validation is defined; operational storage errors are incomplete. | Network uncertainty, conflicts, and retries add to storage failures. | B needs idempotent creates and remote error semantics as first-class work. |
| Verification | Requirement-prefixed tests and mvn verify are planned. | Pure-core and real-PostgreSQL adapter tests are proposed. | Neither establishes completed coverage or passing tests; both need measurable NFR checks. |

Neither design currently earns full acceptance. A's main defects are smaller to close within a course schedule. B's advantages become more valuable when shared remote use is an approved near-term deliverable.

## Findings that determine the recommendation

**Payment correctness is the first acceptance blocker for both designs.** In A, two pending payments of 30.00 can each be recorded against the same 30.00 confirmed debt; confirmation must prevent a second settlement from creating reverse debt (A-D1). B already prevents this aggregate creation case. Its remaining gap is a payment whose underlying debt shrinks after recording: a payment-row version does not represent the current pair balance (B-D2). Neither design should equate optimistic locking on one record with complete money concurrency control.

**B's ledger needs a representation decision before implementation.** Its positive obligation-edge rows do not sum to zero per posting, despite its claimed database check (B-D1). A posting ledger could be valuable, but a correct derived-balance model is simpler for this MVP. Do not add both representations merely to obtain an assurance the current row model cannot provide.

**Membership changes need a recorded product rule.** Pending work can coexist with a zero balance. Removing an approver can make completion impossible once membership gates access; a departing creator can leave no usable manager (A-D2 and B-D8). The fix must reconcile with US2-AS6's permitted zero-balance removal. A blanket new refusal rule would silently change the requirements.

**Platform preparedness is not platform delivery.** B's future adapters, notification stream, and common database do not fulfill FR-044–FR-046, the web uptime target, or measured whole-data propagation. FR-024, FR-030, FR-043–FR-046, NFR-008, and NFR-009 remain deferred in both assessments. B's networked first release also needs a dated owner decision to replace the local-MVP assumption (B-D10).

## Ideas worth keeping from A

- Keep centralized BigDecimal/percentage rules, exact input validation, persisted participant order, and downward rounding plus listed-order remainder allocation.
- Keep derived pairwise balances as the initial money model, backed by retained source records and exact-sum tests.
- Keep thin Swing controllers, GUI-independent domain/services, manual wiring, and one small deployment for the course release.
- Keep the detailed service/screen contracts, recipient/approver rules, receipt decoding checks, field errors, and requirement-prefixed verification policy. Complete their missing read paths and acceptance coverage.

## Ideas worth keeping from B

- Use explicit inbound use cases and replaceable outbound boundaries where they improve testing, particularly persistence, receipts, hashing, and clocks. These can begin as packages without requiring four deployable components.
- State transaction ownership explicitly so status changes, source records, and in-app notifications commit together.
- Document pending-payment reservations and concurrency policy. If reservations are adopted, label available-to-record amounts separately from confirmed balances and retain confirmation-time checks.
- Preserve decimal-string money transport and a versioned API convention for a future server boundary.
- Use schema versioning and realistic adapter tests when persistence evolves. Add an immutable posting ledger only after its invariant, source identity, and benefit justify the additional model.

## Recommended acceptance sequence

1. **Settle the lifecycle decision.** Record owner-approved behavior for pending work, zero-balance removal, and creator departure; preserve the original request and stable requirement IDs.
2. **Close A's correctness and contract defects.** Fix confirmation-time debt validation (A-D1), lifecycle behavior (A-D2), expense discovery (A-D3), cross-group counterparties (A-D4), and receipt consistency (A-D5).
3. **Complete failure and recovery behavior.** Define storage errors, retained input, off-thread I/O and loading, coherent backups/restoration, and explicit notification transaction participation (A-D6–A-D7).
4. **Make acceptance reviewable.** Complete the FR/NFR matrix, timed usability/performance checks, edge-case and privacy tests, and required model/class/test traceability; correct the MVP count to 41 (A-D8–A-D9). Require the constitution's build and human-review gates before acceptance.
5. **Retain deferred delivery visibly.** Continue tracking web, Android, iOS, external notifications, approval levels, export, availability, and cross-client consistency. If the owner brings shared remote use into the course release, reassess B after correcting B-D1–B-D10 and budgeting its hosting/security work explicitly.
