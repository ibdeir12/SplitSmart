# Contract: Desktop Screens

**Phase 1 output of `/speckit-plan`** | **Date**: 2026-11-05

| Screen | Inputs | Shows | Calls | Requirements |
|--------|--------|-------|-------|--------------|
| Login / Register | email, display name, password | errors inline | `AccountService` | FR-001 – FR-003 |
| Dashboard | — | my groups, overall net position, unread count | `GroupService`, `BalanceService`, `NotificationService` | FR-004, FR-023, FR-032 |
| Group | add-by-email, rename, remove, leave | members, per-pair balances, expenses, payments | `GroupService`, `BalanceService` | FR-007 – FR-011, FR-033 |
| Expense form (dialog) | amount, date, description, payer, participants (ordered, ticked), split method, percentages, receipt | live share preview, running percentage total | `ExpenseService.previewShares`, `recordExpense` | FR-012 – FR-019 |
| Expense details | approve, reject + reason | shares, status, decision history, receipt | `ExpenseService`, `ApprovalService` | FR-026 – FR-029, FR-047 |
| Approvals inbox | — | expenses awaiting my decision | `ApprovalService` | FR-026 |
| Payment form (dialog) | to member, amount, date, note | amount currently owed | `PaymentService` | FR-035, FR-037 |
| Payments | confirm, decline | sent and received with status | `PaymentService` | FR-036, FR-038 |
| Notifications | open, mark read | list with unread state | `NotificationService` | FR-021 – FR-023 |
| Reports | from, to, group, type | items and totals; summary | `ReportService` | FR-039 – FR-042 |

Error contract (NFR-005): every `ValidationException` is shown next to or above the named field;
the form keeps all other entries.
