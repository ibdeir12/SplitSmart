# Implementation Plan: SplitSmart Expense Sharing

**Branch**: `001-splitsmart-expense-sharing` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-splitsmart-expense-sharing/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

SplitSmart records shared expenses inside groups, routes each expense through an approval step,
derives pairwise balances from approved expenses and confirmed payments, notifies the members
involved, and reports on all of it. The MVP subset ([MVP] requirements in the spec) is delivered
as a single-machine Java 21 Swing desktop application.

Technical approach (base architecture): a **layered monolith** in one Maven module, organised
as Model-View-Controller on top of a service layer:

1. **Presentation** (`ui`): Swing views and controllers. Collects input, calls services, renders
   results. Contains no money or approval logic (constitution Principle III).
2. **Application services** (`service`): one service per customer feature (accounts, groups,
   expenses, approvals, payments, balances, notifications, reports). Each public method is one
   use case and one database transaction.
3. **Domain** (`domain`): entities, value objects (`Money`, `Percentage`), and the business rules
   (`SplitCalculator`, `BalanceCalculator`, `ApprovalPolicy`, `AmountRules`). Plain Java, no
   Swing, no JDBC.
4. **Persistence** (`persistence`): repository interfaces plus JDBC implementations over an
   embedded H2 database file in the user's home directory; receipt images stored as files next to
   it.

## Technical Context

**Language/Version**: Java 21 (LTS)

**Primary Dependencies**: Java SE (Swing, JDBC, `java.security` PBKDF2); H2 Database 2.x
(embedded, file mode); JUnit 5 (Jupiter) for tests. See [research.md](research.md) R-02 for the
H2 justification required by the constitution.

**Storage**: Embedded H2 database file `~/.splitsmart/splitsmart.mv.db`; receipt images as files
under `~/.splitsmart/receipts/`.

**Testing**: JUnit 5 via Maven Surefire (`mvn verify`); domain rules tested without a GUI or
database; repository tests against an in-memory H2 database (`jdbc:h2:mem:`).

**Target Platform**: Desktop (Windows, macOS, Linux) with a Java 21 runtime.

**Project Type**: desktop-app

**Performance Goals**: balances and reports for a group of 20 members and 1,000 expenses in under
2 seconds (NFR-004).

**Constraints**: money exact to the cent with `BigDecimal` (NFR-001, Principle IV); passwords
never stored readable (FR-005); data survives restart (NFR-006); single machine, one signed-in
member at a time.

**Scale/Scope**: course MVP; tens of users per installation, up to about 20 members per group
and 1,000 expenses per group; 9 user stories, 40 [MVP] functional requirements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / gate | How this plan complies | Status |
|------------------|------------------------|--------|
| I. Customer requirements are the source of truth | `UserRequirement.md` untouched; deferred FRs (FR-024, FR-030, FR-043 – FR-046) stay in the inventory. | PASS |
| II. Requirement traceability | Every service method and data-model rule names the FR it realises; tests named `FR###_...`. | PASS |
| III. OO design, GUI separated from business logic | `domain` and `service` have no `javax.swing` import; `ui` depends on `service`, never the reverse. | PASS |
| IV. BigDecimal money | `Money` value object wraps `BigDecimal` scale 2; one `SplitCalculator` owns rounding (`RoundingMode.DOWN` + listed-order remainder). DB columns `DECIMAL(12,2)`. | PASS |
| V. JUnit 5 verified | Each [MVP] FR has a test class or method; invariants (shares = amount, group balances = 0) are property-style tests. | PASS |
| VI. Human review of generated output | Plan, research, and data model are reviewed before tasks are generated. | PASS |
| New libraries need justification | H2 justified in research.md R-02. No other runtime library. | PASS |

Post-design re-check (after Phase 1): PASS. No violations; the Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-splitsmart-expense-sharing/
├── spec.md              # /speckit-specify + /speckit-clarify output (Lab 6)
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── service-api.md   # use-case interface the Swing layer calls
│   └── ui-screens.md    # screen contract: inputs, outputs, error messages
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
pom.xml
src/main/java/com/splitsmart/
├── app/            # Main, AppContext (manual dependency wiring), AppPaths
├── ui/             # Swing: MainFrame, LoginPanel, DashboardPanel, GroupPanel,
│                   #   ExpenseFormDialog, ApprovalPanel, PaymentDialog, BalancesPanel,
│                   #   NotificationPanel, ReportPanel; *Controller classes
├── service/        # AccountService, GroupService, ExpenseService, ApprovalService,
│                   #   PaymentService, BalanceService, NotificationService, ReportService,
│                   #   Session, ValidationException, AccessDeniedException
├── domain/         # User, Group, Membership, Expense, Share, SplitMethod, ExpenseStatus,
│                   #   ApprovalDecision, Payment, PaymentStatus, Notification, ReceiptRef,
│                   #   Money, Percentage, PairBalance
│   └── rules/      # SplitCalculator, BalanceCalculator, ApprovalPolicy, AmountRules,
│                   #   PasswordPolicy
├── persistence/    # *Repository interfaces, Database (H2 connection + schema), ReceiptStore
│   └── jdbc/       # Jdbc*Repository implementations
└── security/       # PasswordHasher (PBKDF2WithHmacSHA256)
src/main/resources/db/schema.sql
src/test/java/com/splitsmart/
├── domain/rules/   # SplitCalculatorTest, BalanceCalculatorTest, ApprovalPolicyTest, ...
├── service/        # one test class per service, H2 in-memory
└── persistence/    # repository round-trip tests
```

**Structure Decision**: single Maven module (Option 1, desktop variant). The layers are Java
packages; the dependency rule `ui → service → domain ← persistence` is checked by a JUnit test
that scans imports (no `javax.swing` outside `ui`, no `java.sql` outside `persistence`).

## Architecture Overview

```text
┌──────────────────────────── Swing desktop process ────────────────────────────┐
│  ui (Views + Controllers)                                                     │
│        │ calls                                                                │
│        ▼                                                                      │
│  service (use cases, transactions, access checks, Session)                    │
│        │ uses                         │ uses                                  │
│        ▼                              ▼                                       │
│  domain (entities + rules)      persistence (repositories, ReceiptStore)       │
│                                       │ JDBC                                  │
│                                       ▼                                       │
│                        H2 file ~/.splitsmart/splitsmart.mv.db                 │
│                        receipts ~/.splitsmart/receipts/                       │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Key flows

- **Record expense (FR-012 – FR-021, FR-025)**: `ExpenseFormDialog` → `ExpenseController` →
  `ExpenseService.recordExpense(draft)`: validate (`AmountRules`, required fields), check payer
  and participants are group members, `SplitCalculator` computes shares, `ApprovalPolicy` derives
  approvers (refuse if none), save Expense + Shares as Pending in one transaction, then
  `NotificationService.notifyExpenseRecorded`.
- **Approve / reject (FR-026 – FR-029, FR-047)**: `ApprovalService.decide(expenseId, decision,
  reason)`: check the current member is a pending approver, store the decision; if any reject →
  Rejected; if all approved → Approved. Balances are never stored; they are recomputed from
  Approved expenses, so approval needs no balance write.
- **Balances (FR-031 – FR-034)**: `BalanceService` loads Approved shares and Confirmed payments
  for the member's groups; `BalanceCalculator` folds them into a map of `(debtor, creditor,
  group) → Money`, netting each pair.
- **Payment (FR-035 – FR-038)**: `PaymentService.recordPayment` validates the amount against the
  current owed amount, stores it Awaiting Confirmation, notifies the receiver; `confirm` /
  `decline` by the receiver only.
- **Reports (FR-039 – FR-042)**: `ReportService` filters expenses and payments by date range,
  group, and type, and totals them with `Money.sum`.

### Cross-cutting decisions

- **Session and access control**: `Session` holds the signed-in `User`; every service method
  takes the session and checks group membership before reading or writing (FR-004, FR-010,
  NFR-002).
- **Transactions**: each service method opens one JDBC connection with auto-commit off and
  commits or rolls back as a unit.
- **Notifications**: rows in a `notification` table; the dashboard reads unread ones on sign-in
  and refreshes after each action (MVP is single-machine, so no push channel is needed).
- **Errors**: `ValidationException` carries field name and message (NFR-005);
  `AccessDeniedException` for permission failures; controllers turn both into dialog messages and
  keep the form's other entries.

## Deployment

- One executable JAR built by `mvn package` (Maven Shade plugin bundles H2).
- Launched with `java -jar splitsmart.jar` on a machine with Java 21.
- First launch creates `~/.splitsmart/` and runs `schema.sql`.
- Backup = copy the `~/.splitsmart` folder.

## Complexity Tracking

> No constitution violations; nothing to justify.
