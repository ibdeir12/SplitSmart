# Data Model: SplitSmart Expense Sharing

**Phase 1 output of `/speckit-plan`** | **Date**: 2026-11-05 | **Plan**: [plan.md](plan.md)

All money fields are `Money` (a `BigDecimal` with scale 2) in Java and `DECIMAL(12,2)` in the
database. Identifiers are `UUID`. Timestamps are `Instant` (UTC); business dates are
`LocalDate`.

## Entities

### User (FR-001 – FR-006)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | primary key |
| email | String | required, unique (case-insensitive), valid email format |
| displayName | String | required, 1 – 60 characters |
| passwordHash | String | PBKDF2 `iterations:salt:hash`; never the plain password (FR-005) |
| createdAt | Instant | set on registration |

Password policy (validated before hashing): at least 8 characters, at least one letter and one
digit (FR-001).

### Group (FR-007 – FR-011)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | primary key |
| name | String | required, 1 – 60 characters |
| creatorId | UUID → User | the Group Creator; only this user may add, remove, or rename (FR-008, FR-009) |
| createdAt | Instant | |

### Membership

| Field | Type | Rules |
|-------|------|-------|
| groupId | UUID → Group | composite key with userId |
| userId | UUID → User | |
| joinedAt | Instant | |

Removal or leaving is refused while the member's group balance is not 0.00 (FR-011).

### Expense (FR-012 – FR-020, FR-025 – FR-029, FR-047)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | primary key |
| groupId | UUID → Group | creator must be a member |
| creatorId | UUID → User | the member who recorded it |
| payerId | UUID → User | must be a member of the group (FR-013) |
| amount | Money | 0.01 – 100,000.00, at most 2 decimals (FR-016) |
| expenseDate | LocalDate | required (FR-018); past or future allowed |
| description | String | required, 1 – 200 characters (FR-018) |
| splitMethod | enum `EQUAL`, `PERCENTAGE` | |
| status | enum `PENDING`, `APPROVED`, `REJECTED` | starts `PENDING` (FR-025) |
| receipt | ReceiptRef (nullable) | JPEG/PNG, ≤ 5 MB (FR-017) |
| createdAt | Instant | |

### Share (FR-014, FR-015, FR-020)

| Field | Type | Rules |
|-------|------|-------|
| expenseId | UUID → Expense | composite key with participantId |
| participantId | UUID → User | must be a member of the expense's group |
| position | int | listed order; used for leftover-cent allocation |
| percentage | Percentage (nullable) | only for `PERCENTAGE`; > 0, ≤ 2 decimals |
| amount | Money | computed by `SplitCalculator` |

Invariant: `sum(share.amount) == expense.amount` for every expense; for `PERCENTAGE`,
`sum(share.percentage) == 100.00`.

### ApprovalDecision (FR-026 – FR-029)

| Field | Type | Rules |
|-------|------|-------|
| expenseId | UUID → Expense | composite key with approverId |
| approverId | UUID → User | must be the payer or a participant, and not the creator |
| decision | enum `APPROVED`, `REJECTED` | |
| reason | String (nullable) | required when `REJECTED` |
| decidedAt | Instant | |

### Payment (FR-035 – FR-038)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | primary key |
| groupId | UUID → Group | both parties must be members |
| fromUserId | UUID → User | the member paying |
| toUserId | UUID → User | the member receiving; ≠ fromUserId |
| amount | Money | FR-016 rules, and ≤ amount currently owed in that group (FR-037) |
| paymentDate | LocalDate | required |
| note | String (nullable) | ≤ 200 characters |
| status | enum `AWAITING_CONFIRMATION`, `CONFIRMED`, `DECLINED` | |
| recordedById | UUID → User | |
| decidedAt | Instant (nullable) | |

### Notification (FR-021 – FR-023)

| Field | Type | Rules |
|-------|------|-------|
| id | UUID | primary key |
| recipientId | UUID → User | never the actor who caused it (FR-022) |
| type | enum `EXPENSE_RECORDED`, `EXPENSE_APPROVED`, `EXPENSE_REJECTED`, `PAYMENT_RECORDED` | |
| expenseId / paymentId | UUID (nullable) | link to the related item |
| message | String | |
| read | boolean | |
| createdAt | Instant | |

### Derived (not stored)

- **PairBalance** `(groupId, debtorId, creditorId, amount)`: net amount from Approved shares
  (participant owes payer) minus Confirmed payments (payer of the payment reduces their debt).
  Invariant: per group, the signed balances of all members sum to 0.00 (FR-034).
- **Report** `(memberId, from, to, groupId?, itemType)`: filtered list of expenses and payments
  with totals equal to the sum of the listed items (FR-042).

## State transitions

```text
Expense:  [new] --record--> PENDING --all approvers approve--> APPROVED   (final; no edit/delete)
                               \--any approver rejects (reason)--> REJECTED (final)

Payment:  [new] --record--> AWAITING_CONFIRMATION --receiver confirms--> CONFIRMED
                                        \--receiver declines--> DECLINED
```

## Database schema (summary)

Tables: `app_user`, `app_group`, `membership`, `expense`, `share`, `approval_decision`,
`payment`, `notification`. Foreign keys on every `*_id`; unique index on `lower(email)`;
check constraints on positive amounts and status values.
