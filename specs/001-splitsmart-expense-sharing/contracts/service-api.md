# Contract: Application Service API

**Revision 2 (consolidated per ADR-001)** | **Date**: 2026-11-05 |
**Architecture decision**: [ADR-001](../../../docs/architecture/decision.md) |
**Data model**: [data-model.md](../data-model.md) | **Screens**: [ui-screens.md](ui-screens.md)

The Swing layer talks to the business layer only through the services below, which live in
`com.splitsmart.service`. Services depend on the domain (`com.splitsmart.domain`, with rules in
`com.splitsmart.domain.rules`) and on ports in `com.splitsmart.service.port`; adapters in
`persistence`, `storage`, and `security` implement those ports, and `app.AppContext` wires them
manually. Dependencies run `ui → service → domain` and `service → port ← adapters`; the domain
imports no Swing, JDBC, or adapter class. All of this is one Maven module.

Lifecycle behaviour (FR-011 as amended, FR-049) realizes the 2026-11-05 clarifications decided
by the project owner during consolidation.

## 1. Common contract

### 1.1 Sessions and actors

- Every method except `register` and `signIn` takes the current `Session`
  (`sessionId`, `userId`, `displayName`, `signedInAt`). The **actor is always the session
  member**; no method accepts an actor, payer, recorder, or approver user ID from the caller.
- One member is signed in at a time. `signOut` ends the session; any later call with that
  session is refused with `AccessDeniedException` and returns no data.
- Every list, detail, receipt, report, notification link, and operation lookup rechecks the
  actor's **active membership** of the relevant group at the time of the call (FR-004, FR-010,
  NFR-002). An archived group has no active members and is therefore inaccessible.

### 1.2 Ports and unit of work (ADR-001 D-1, D-2)

| Port (`com.splitsmart.service.port`) | Responsibility | Adapter |
|--------------------------------------|----------------|---------|
| `TransactionRunner` | runs one unit of work: `inTransaction(Function<UnitOfWork,T>)` opens one JDBC transaction; `read(Function<UnitOfWork,T>)` for a consistent read. Persistent commands reach it through `CommandRunner` (a service-layer class, not a port): `run(session, operationId, groupId [0..1], fingerprint, work)` takes that group's lock from `GroupLocks` when a group is named, checks the operation record, then calls `inTransaction`; `lookup(session, operationId)` reads a prior outcome. Registration, group creation, and mark-read run without a group lock. | `persistence.JdbcTransactionRunner` |
| `UnitOfWork` | one connection and transaction; exposes repositories bound to it; `afterCommit(Runnable)` and `afterRollback(Runnable)` hooks for receipt file cleanup | `persistence.JdbcUnitOfWork` |
| `UserRepository`, `GroupRepository` (groups, memberships), `ExpenseRepository` (expenses, shares, approval decisions, receipt references), `PaymentRepository`, `LifecycleEventRepository`, `NotificationRepository`, `OperationRecordRepository` | row access within the caller's unit of work; never commit | `persistence.jdbc.Jdbc*Repository` |
| `ReceiptStore` | validate and stage bytes, promote to the final generated path, read, delete, and list files for reconciliation | `storage.FileReceiptStore` |
| `PasswordHasher` | `String hash(char[])`, `boolean matches(char[], String)` | `security.Pbkdf2PasswordHasher` |
| `java.time.Clock` (injected) | the only time source | system clock; fixed clock in tests |

Rules:

1. **The top-level use-case method owns the unit of work.** Source records, shares, genuine
   decisions, status changes, lifecycle events, the operation record, and every required
   notification row commit or roll back together. Repositories and the internal
   writer methods of `NotificationService` receive the caller's `UnitOfWork`; none opens a transaction or commits.
   No internal notification callback owns a separate transaction.
2. **Group serialization.** Every mutation of an existing group runs through
   `CommandRunner.run` with that group's ID, which takes the same in-process group lock from
   `GroupLocks` before the transaction opens and keeps it through commit or rollback. This covers expense recording,
   deletion, approval and rejection, payment recording, confirmation and decline, adding,
   removing, leaving, renaming, and lifecycle cleanup. Background workers never bypass it. An
   operation needing more than one group lock acquires them in ascending group UUID order (no
   MVP operation currently does).
3. **Pure previews and queries** (`previewShares`, `allowance`, lists, details, balances,
   reports) run in `read(…)` or without a transaction; they write nothing. Sign-out is in memory
   and opens no transaction.
4. **Files are not transactional.** Receipt files follow the staging protocol in section 4: the
   file is finalized before the reference commits, and cleanup runs from `afterRollback` or
   startup reconciliation.

### 1.3 Errors and outcomes (NFR-005, NFR-010)

Every failure is a subclass of `AppException`, carrying a safe user-facing message, an
`ErrorCategory`, the `operationId` (for persistent commands), an `OperationOutcome`
(`NOT_COMMITTED` or `UNKNOWN`) where applicable, and a `retryable` flag. Technical causes are
logged locally without passwords or receipt contents; none reaches the message.

| Exception | `ErrorCategory` | Outcome | Retryable | Used for |
|-----------|-----------------|---------|-----------|----------|
| `ValidationException` | `VALIDATION` | `NOT_COMMITTED` | after correction | one or more `FieldError(field, message)`; the form keeps all entries (NFR-005) |
| `AccessDeniedException` | `ACCESS_DENIED` | `NOT_COMMITTED` | no | not a member, not the current creator, not a required approver, not the receiver, ended session, inaccessible link |
| `ConflictException` | `CONFLICT` | `NOT_COMMITTED` | no | stale state, with a `ConflictReason` and optional payload (below) |
| `StorageUnavailableException` | `STORAGE_UNAVAILABLE` | `NOT_COMMITTED` | yes, same operation ID | database, disk, or receipt-file failure known to have rolled back; never reported as invalid input |
| `ReceiptUnavailableException` | `RECEIPT_UNAVAILABLE` | not applicable | no | a referenced receipt file is missing or unreadable; the expense stays viewable |
| `OutcomeUnknownException` | `UNKNOWN_OUTCOME` | `UNKNOWN` | only after lookup | the commit call itself failed, so the result cannot be known |

| `ConflictReason` | Payload | Raised by |
|------------------|---------|-----------|
| `TERMINAL_STATE` | current status | decision, confirmation, decline, delete, or edit on a terminal or non-Pending record |
| `ALREADY_DECIDED` | — | a second decision by the same approver |
| `STALE_DEBT` | `currentDebt` (Money) | confirmation of a payment larger than the live debt |
| `NOT_SETTLED` | `outstanding` (`List<PairBalance>` of the departing member) | removal or leave while any pair balance is non-zero |
| `ALREADY_MEMBER` | — | adding a user who already has an active membership |
| `OPERATION_ID_REUSED` | — | a known operation ID sent with a different command fingerprint |

Successful persistent commands return `CommandResult<T>`:

| Field | Meaning |
|-------|---------|
| `operationId` | the ID the controller supplied |
| `outcome` | `COMMITTED` for a direct or replayed success; a lookup may also return `NOT_COMMITTED` |
| `value` | the result payload, re-read after access checks; null for `NONE` results or when `accessEnded` |
| `replayed` | true when the result came from an earlier commit of the same operation ID |
| `accessEnded` | true only in the minimal departure acknowledgement (section 1.4) |

Outcome rules: an exception before the commit call means a known rollback (`NOT_COMMITTED`). A
failure of the commit call itself is `UNKNOWN`. After a successful commit the service never
reports failure: post-commit work (file cleanup, refresh reads) that fails is logged, and a
later refresh failure is reported as a read failure while the command remains saved.

### 1.4 Operation IDs, status lookup, and duplicate commands (NFR-010)

- The controller allocates a random UUID `operationId` when a form or action is first submitted
  and reuses it for every retry of that submission. A new submission gets a new ID.
- Each persistent command writes an `OperationRecord` (actor, operation ID, type, fingerprint
  of non-secret fields, group, result reference) in the **same** unit of work as its result.

| Situation | Behaviour |
|-----------|-----------|
| No record for `(actor, operationId)` | execute normally |
| Record exists, same fingerprint | return the stored result as `CommandResult` with `replayed = true`; no new rows or notifications; access is rechecked first |
| Record exists, different fingerprint | `ConflictException(OPERATION_ID_REUSED)`; nothing written |
| Replay or lookup, actor no longer has access to the group | `AccessDeniedException`, except a departure the actor performed on themself, which returns the minimal acknowledgement: `outcome = COMMITTED`, `accessEnded = true`, `value` null |
| Same intent with a new operation ID | a new command; terminal-state and already-decided guards refuse repeated decisions, and the screens prevent double submission |

| Method | Realises | Notes |
|--------|----------|-------|
| `CommandResult<?> lookup(Session s, UUID operationId)` on `CommandRunner` | NFR-010 | read-only. Returns `COMMITTED` with the re-read result when the record exists and access remains; `NOT_COMMITTED` when the store is available and no record exists (the command may then be retried with the same ID); `StorageUnavailableException` while the store cannot be read (the screen keeps showing unknown and keeps further mutation disabled) |

Persistent commands with operation IDs: `createGroup`, `addMember`, `removeMember`,
`leaveGroup`, `renameGroup`, `recordExpense`, `deleteExpense`, `approve`, `reject`,
`recordPayment`, `confirm`, `decline`. `markRead` and `open` are idempotent and take no
operation ID. Registration, sign-in, and sign-out are excluded (section 2).

## 2. AccountService (CR-01)

| Method | Realises | Contract |
|--------|----------|----------|
| `UserView register(String email, String displayName, char[] password)` | FR-001, FR-005 | `inTransaction`. Refuses invalid email, display name outside 1 – 60, weak password (`ValidationException` per field), and a duplicate normalized email (`ValidationException("email")`). The password is hashed by `PasswordHasher`, never stored or fingerprinted, and the buffer is cleared. On an uncertain commit, `OutcomeUnknownException` whose message offers ordinary sign-in to find out whether the account exists; no unauthenticated operation result is disclosed. Returns `UserView(id, email, displayName)`. |
| `Session signIn(String email, char[] password)` | FR-002 | `read`. Any failure is the same generic "email or password is incorrect" `ValidationException`; storage failure is `StorageUnavailableException`. Hashing runs on a worker. |
| `void signOut(Session s)` | FR-003 | in memory; invalidates the session so late worker results are discarded. |

## 3. GroupService (CR-02)

| Method | Realises | Contract |
|--------|----------|----------|
| `CommandResult<GroupView> createGroup(Session s, UUID operationId, String name)` | FR-007 | `inTransaction`. Name 1 – 60. Creates an `ACTIVE` group with `originalCreatorId = currentCreatorId = actor` and the founding membership. |
| `CommandResult<MemberView> addMember(Session s, UUID operationId, UUID groupId, String email)` | FR-004, FR-008 | group lock. Actor must be the current Group Creator. Unknown email is `ValidationException("email")`; an active member is `ConflictException(ALREADY_MEMBER)`. A former member gets a new membership period with their unchanged user ID. |
| `DeparturePreview previewDeparture(Session s, UUID groupId, UUID userId)` | FR-011, FR-049 | read-only; same authorization as the departure itself. Returns `groupId`, `subjectUserId`, `settled`, `outstanding` (`List<PairBalance>` of the subject, non-zero rows only, ordered by counterparty UUID), `pendingExpenseCount`, `awaitingPaymentCount`, `successorId` [0..1], `successorDisplayName` [0..1], `groupWouldArchive`. |
| `CommandResult<DepartureResult> removeMember(Session s, UUID operationId, UUID groupId, UUID userId)` | FR-008, FR-011, FR-021, FR-049 | group lock; the departure transaction in [data-model.md](../data-model.md#departure-transaction-fr-008-fr-011-fr-049). Actor must be the current Group Creator; removing oneself follows the leave path. Refusal when not settled: `ConflictException(NOT_SETTLED)` with the outstanding counterparty amounts; pending work alone never refuses. |
| `CommandResult<DepartureResult> leaveGroup(Session s, UUID operationId, UUID groupId)` | FR-008, FR-011, FR-021, FR-049 | as `removeMember`, with the actor as the subject. |
| `CommandResult<GroupView> renameGroup(Session s, UUID operationId, UUID groupId, String name)` | FR-009 | group lock. Actor must be the current Group Creator, including a successor; others get `AccessDeniedException`. Name 1 – 60. |
| `List<GroupView> myGroups(Session s)` | FR-004 | groups where the actor has an active membership, ordered by name (case-insensitive), then group UUID. Empty list when none. |
| `List<MemberView> members(Session s, UUID groupId)` | FR-004, FR-010 | **active** memberships only, ordered by current `joinedAt` ascending, then user UUID (the succession order). |
| `List<MembershipHistoryView> membershipHistory(Session s, UUID groupId)` | FR-004, FR-029, FR-049 | all periods, including ended ones, ordered by `joinedAt`, then user UUID; kept separate from `members`. |

Return types:

- `GroupView(id, name, state, originalCreatorId, currentCreatorId, viewerIsCurrentCreator, activeMemberCount)`.
- `MemberView(userId, displayName, email, joinedAt, isCurrentCreator, isOriginalCreator)`.
- `MembershipHistoryView(userId, displayName, joinedAt, leftAt [0..1], endedBy` (`MEMBER_REMOVED` or `MEMBER_LEFT`) `[0..1], endedByActorDisplayName [0..1])`.
- `DepartureResult(groupId, departedUserId, departureType` (`MEMBER_REMOVED` or `MEMBER_LEFT`)`, cancelledExpenseIds, cancelledPaymentIds, successorId [0..1], successorDisplayName [0..1], groupArchived, accessEnded)`. The operation ID is in the enclosing `CommandResult`. The cancelled ID lists are ordered by UUID and may be empty. A replay or lookup by the departed member returns only the minimal acknowledgement.

## 4. ExpenseService (CR-03, CR-04, CR-06)

| Method | Realises | Contract |
|--------|----------|----------|
| `List<ShareView> previewShares(Session s, ExpenseDraft d)` | FR-014, FR-015, FR-019 | read-only; same `AmountRules`, percentage, and `SplitCalculator` rules as saving; returns shares in listed order. Validation errors as `ValidationException` per field. |
| `CommandResult<ExpenseDetails> recordExpense(Session s, UUID operationId, ExpenseDraft d)` | FR-012 – FR-022, FR-025, FR-026 | group lock. See the record flow below. |
| `List<ExpenseSummary> listExpenses(Session s, UUID groupId)` | FR-004, FR-048 | read-only. Actor must be an active member, else `AccessDeniedException`. Returns every retained expense of the group in **all** statuses (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`) with no implicit status filter, ordered by `expenseDate` descending, then `createdAt` descending, then expense UUID ascending. Empty list when the group has none. |
| `ExpenseDetails getExpense(Session s, UUID expenseId)` | FR-004, FR-017, FR-029, FR-048 | read-only. Repeats the membership check for the expense's group; an unknown ID and an inaccessible ID give the same `AccessDeniedException`. |
| `CommandResult<Void> deleteExpense(Session s, UUID operationId, UUID expenseId)` | FR-047 | group lock. Only the creator, only while `PENDING`; otherwise `ConflictException(TERMINAL_STATE)` or `AccessDeniedException`. Deletes notifications, decisions, shares, the receipt reference, and the expense in one unit of work; after commit removes the receipt file if no reference remains (interruption is repaired by startup reconciliation). Approved edit and delete stay forbidden. |
| `ReceiptView getReceipt(Session s, UUID expenseId)` | FR-004, FR-017 | read-only; membership check as `getExpense`. No attachment returns `ReceiptView(state = NONE)`; an attached, readable file returns `ReceiptView(state = ATTACHED, contentType, bytes)`; a referenced file that is missing or unreadable raises `ReceiptUnavailableException`, which never hides the expense or changes balances. |

`ExpenseDraft(groupId, amountText, expenseDate, description, payerId, splitMethod,
participants, receiptFile [0..1])`: `amountText` is a decimal string (D-4); `participants` is an
ordered `List<ParticipantEntry(userId, percentageText [0..1])>`; `receiptFile` is a `Path` the
member chose, read by the service only. The screen preselects the payer as a participant and
lets the member untick them (FR-013).

**Record flow** (US3-AS13, US3-AS14, US7-AS7):

1. Validate fields: amount (FR-016), description and date (FR-018), at least one unique
   participant (FR-013), percentages (FR-015). All field errors are returned together.
2. If a receipt is chosen: read at most 5,000,001 bytes; refuse more than 5,000,000 bytes, and
   content that does not decode as JPEG or PNG, as `ValidationException("receipt")`; stage,
   write, close, and force it; promote it to its final generated path. A storage failure here is
   `StorageUnavailableException` (`NOT_COMMITTED`) and the staged file is removed.
3. In the group unit of work: check the actor, payer, and participants are active members;
   compute shares with `SplitCalculator`; derive approvers with `ApprovalPolicy` and refuse an
   empty set as `ValidationException("participants")`; insert the `PENDING` expense, ordered
   shares, receipt reference, `EXPENSE_RECORDED` notifications through the `NotificationService` writer methods, and
   the operation record.
4. Commit. Known rollback: `afterRollback` removes the final file. Uncertain commit: the file is
   kept until a lookup or startup reconciliation resolves the reference.

Return types:

- `ExpenseSummary(id, groupId, expenseDate, description, payerId, payerDisplayName, amount, status, createdAt)`.
- `ExpenseDetails(id, groupId, groupName, expenseDate, description, amount, status, splitMethod, creatorId, creatorDisplayName, payerId, payerDisplayName, createdAt, shares, decisions, lifecycle, receiptState, receiptContentType [0..1], canDecide, canDelete)`.
  - `shares`: `List<ShareView(participantId, displayName, position, percentage [0..1], amount)>` in position order.
  - `decisions`: one `DecisionView(approverId, approverDisplayName, decision [0..1], reason [0..1], decidedAt [0..1])` per required approver, ordered by approver UUID; undecided approvers have null decision fields.
  - `lifecycle`: `List<LifecycleEventView(eventId, eventType, actorId, actorDisplayName, subjectUserId, subjectDisplayName, reason, occurredAt, successorId [0..1], successorDisplayName [0..1])>`, ordered by `occurredAt`; shown separately from decisions and never labelled as an approver's decision.
  - `receiptState`: `NONE`, `ATTACHED`, or `UNAVAILABLE` (reference present but file missing or unreadable).
  - `canDecide` (actor is an undecided required approver and the expense is `PENDING`) and `canDelete` (actor is the creator and the expense is `PENDING`) are computed by the service; the screen does not derive them.

## 5. ApprovalService (CR-06)

| Method | Realises | Contract |
|--------|----------|----------|
| `List<ExpenseSummary> awaitingMyDecision(Session s)` | FR-026 | read-only. `PENDING` expenses in the actor's current groups for which the actor is an undecided required approver, ordered by `createdAt` ascending, then UUID. Empty list when none. |
| `CommandResult<ExpenseDetails> approve(Session s, UUID operationId, UUID expenseId)` | FR-021, FR-026, FR-027, FR-029 | group lock. Guards: active membership; expense `PENDING` (else `ConflictException(TERMINAL_STATE)`, including `CANCELLED`); actor in the approver set (else `AccessDeniedException`); no earlier decision by the actor (else `ConflictException(ALREADY_DECIDED)`). Saves the genuine decision with `Clock` time; if every approver has now approved, sets `APPROVED` and writes `EXPENSE_APPROVED` for the creator; otherwise the expense stays `PENDING`. Decision, status, notification, and operation record share one unit of work. No balance row is written. |
| `CommandResult<ExpenseDetails> reject(Session s, UUID operationId, UUID expenseId, String reason)` | FR-021, FR-026, FR-028, FR-029 | same guards; `reason` nonblank and at most 200 characters (`ValidationException("reason")`). Saves the decision, sets `REJECTED`, writes `EXPENSE_REJECTED` for the creator, in one unit of work. Balances unchanged. |

Any failure rolls back the decision, status, and notification together (US4-AS10). Refused
attempts change no balance and create no decision or notification.

## 6. BalanceService (CR-07)

Sign convention for every type here: **positive = the viewing member owes**, negative = the
viewing member is owed, 0.00 = settled. Only `APPROVED` shares and `CONFIRMED` payments are
used; reservations never enter a balance.

| Method | Realises | Contract |
|--------|----------|----------|
| `List<PairBalance> myBalances(Session s, UUID groupId)` | FR-031, FR-033, FR-034 | read-only; active membership required. One row per other active member of the group, including 0.00 rows shown as settled, ordered by counterparty UUID. `PairBalance(groupId, memberId = actor, counterpartyId, counterpartyDisplayName, amount, direction)`. |
| `List<CounterpartyBalance> myCounterpartyBalances(Session s)` | FR-032, FR-033 | read-only; across the actor's current groups. One row per counterparty user ID with at least one non-zero group contribution, ordered by counterparty UUID. `CounterpartyBalance(counterpartyId, counterpartyDisplayName, byGroup, total, direction)`, where `byGroup` is `List<GroupContribution(groupId, groupName, amount)>` of non-zero amounts ordered by group UUID and `total` is their sum. A total of 0.00 is `SETTLED`, never a directional debt. Debts between different counterparties are never simplified. Empty list when none. |
| `NetPosition myOverallPosition(Session s)` | FR-032 | read-only. `NetPosition(amount, direction)` with `amount` = the sum of `myCounterpartyBalances` totals; `0.00` and `SETTLED` when there are no balances. |

All-groups figures are informational; payments are always validated against one group's pair
balance (FR-033). There is no null-group form of `myBalances`.

## 7. PaymentService (CR-08)

| Method | Realises | Contract |
|--------|----------|----------|
| `PaymentAllowance allowance(Session s, UUID groupId, UUID toUserId)` | FR-037 | read-only; actor and `toUserId` must be distinct active members. Returns `PaymentAllowance(groupId, payerId = actor, receiverId, debt, reserved, available)` with `debt = max(0.00, pair balance from actor to receiver in the group)`, `reserved` = sum of the actor's `AWAITING_CONFIRMATION` payments to that receiver in that group, `available = max(0.00, debt - reserved)`. None is negative. |
| `CommandResult<PaymentView> recordPayment(Session s, UUID operationId, PaymentDraft d)` | FR-016, FR-021, FR-035, FR-037 | group lock. `PaymentDraft(groupId, toUserId, amountText, paymentDate, note [0..1])`. The payer is the session member; both parties are distinct active members. Amount per FR-016; date required; note at most 200. Under the lock, recomputes the allowance and refuses `amount > available` as `ValidationException("amount")` whose message states the available amount (zero when nothing is owed). Inserts the `AWAITING_CONFIRMATION` payment, `PAYMENT_RECORDED` for the receiver, and the operation record. Balances unchanged. |
| `CommandResult<PaymentView> confirm(Session s, UUID operationId, UUID paymentId)` | FR-036, FR-037 | group lock. Receiver only (`AccessDeniedException` otherwise); payment `AWAITING_CONFIRMATION` (else `ConflictException(TERMINAL_STATE)`). Re-reads the live pair debt from payer to receiver in that group **without subtracting this payment's own reservation**; if `amount > debt`, `ConflictException(STALE_DEBT, currentDebt)` and nothing changes, so the receiver may decline instead. Otherwise sets `CONFIRMED`, `decidedById`, `decidedAt`. |
| `CommandResult<PaymentView> decline(Session s, UUID operationId, UUID paymentId, String reason)` | FR-036 | group lock. Receiver only; payment `AWAITING_CONFIRMATION`; `reason` optional, at most 200. Sets `DECLINED`, releasing the reservation; balances unchanged. |
| `List<PaymentView> history(Session s)` | FR-004, FR-038 | read-only. Payments the actor sent or received in groups where the actor is currently an active member, in all statuses including `CANCELLED`; ordered by `paymentDate` descending, `recordedAt` descending, then UUID. Empty list when none. |
| `List<PaymentView> history(Session s, UUID groupId)` | FR-004, FR-038 | as above, restricted to one group; active membership required, else `AccessDeniedException`. Used by the Group screen. |

`PaymentView(id, groupId, groupName, fromUserId, fromDisplayName, toUserId, toDisplayName,
direction, amount, paymentDate, note [0..1], status, recordedAt, decidedAt [0..1],
decisionReason [0..1], cancellation [0..1], canConfirm, canDecline)`: `direction` is `SENT` or
`RECEIVED` from the actor's side; `cancellation` is a `LifecycleEventView` shown separately from
receiver decision fields; `canConfirm` and `canDecline` are true only for the receiver of an
`AWAITING_CONFIRMATION` payment.

## 8. NotificationService (CR-05)

| Method | Realises | Contract |
|--------|----------|----------|
| `List<NotificationView> inbox(Session s)` | FR-023 | read-only. The actor's notifications whose group the actor currently belongs to, ordered by `createdAt` descending, then UUID. Inaccessible notifications are omitted. Empty list when none. `NotificationView(id, type, message, read, createdAt, groupId, expenseId [0..1], paymentId [0..1])`. |
| `int unreadCount(Session s)` | FR-023 | read-only. Unread notifications counted under the same accessibility filter. |
| `void markRead(Session s, UUID notificationId)` | FR-023 | `inTransaction`; idempotent. Recipient only; a notification of another member, or whose group is inaccessible, is refused with `AccessDeniedException` and exposes no content. |
| `NotificationTarget open(Session s, UUID notificationId)` | FR-023 | marks read and returns `NotificationTarget(kind, expenseId [0..1], paymentId [0..1])` with `kind` `EXPENSE` or `PAYMENT` (cancellation notifications open the cancelled expense or payment). An inaccessible group or record returns `kind = NO_ACCESS` with no IDs and no content. |

Internal (package-private, not called by the UI): writer methods on `NotificationService`:
`notifyExpenseRecorded`, `notifyDecision`, `notifyPaymentRecorded`, and `notifyCancelled`
(expense and payment cancellations). Each takes the originating `UnitOfWork` and computes the exact recipients
from [data-model.md](../data-model.md#notification-fr-021--fr-023-fr-049); none commits.
A failed notification write rolls back the originating command (US7-AS7).

## 9. ReportService (CR-09)

| Method | Realises | Contract |
|--------|----------|----------|
| `Summary summary(Session s)` | FR-039 | read-only. `Summary(approvedShareTotal, paidTotal, receivedTotal, netPosition)` over the actor's current groups: the actor's shares of `APPROVED` expenses; `CONFIRMED` payments sent; `CONFIRMED` payments received; and `myOverallPosition`. All 0.00 when there is no activity. |
| `Report customReport(Session s, ReportQuery q)` | FR-040 – FR-042 | read-only. See below. |

`ReportQuery(from, to, groupId [0..1], itemType)`: `from` and `to` are required `LocalDate`s and
the range is inclusive; `itemType` is `EXPENSES`, `PAYMENTS`, or `BOTH`. Missing dates are
`ValidationException` on that field; `from` after `to` is `ValidationException("to")`. A
`groupId` the actor is not an active member of is refused with `AccessDeniedException`. Without a
`groupId`, the scope is all of the actor's current groups.

`Report(query, expenseRows, paymentRows, totals)`:

- `expenseRows` (when `EXPENSES` or `BOTH`): expenses in scope with `expenseDate` in range where
  the actor is creator, payer, or participant, in every status, ordered by `expenseDate`, then
  `createdAt`, then UUID. `ExpenseReportRow(expenseId, groupId, groupName, expenseDate,
  description, status, payerDisplayName, expenseAmount, myShare)`, where `expenseAmount` is the
  full amount and `myShare` is the actor's share (0.00 when not a participant).
- `paymentRows` (when `PAYMENTS` or `BOTH`): payments in scope with `paymentDate` in range sent or
  received by the actor, in every status, same ordering by `paymentDate`. `PaymentReportRow(paymentId,
  groupId, groupName, paymentDate, direction, counterpartyDisplayName, amount, status)`.
- `totals`: `ReportTotals(expenseAmountTotal, myShareTotal, sentTotal, receivedTotal)`, each equal
  to the sum of the displayed values in its column (sent and received are the payment rows of
  that direction) (FR-042). No hidden status exclusion applies; each row shows its status. These
  are date-filtered activity totals and are never labelled the current balance.
- An empty result has empty row lists and 0.00 totals, not an error (FR-041).

## 10. Requirement coverage summary

| Service | MVP requirements realised |
|---------|---------------------------|
| AccountService | FR-001 – FR-003, FR-005, FR-006 |
| GroupService | FR-004, FR-007 – FR-011, FR-021, FR-049 |
| ExpenseService | FR-004, FR-012 – FR-022, FR-025, FR-026, FR-029, FR-047, FR-048 |
| ApprovalService | FR-021, FR-022, FR-025 – FR-029 |
| BalanceService | FR-031 – FR-034 |
| PaymentService | FR-004, FR-016, FR-021, FR-035 – FR-038 |
| NotificationService | FR-021 – FR-023 |
| ReportService | FR-039 – FR-042 |
| CommandRunner and the common contract | NFR-005, NFR-010; NFR-011 is met by the screens running these calls on workers ([ui-screens.md](ui-screens.md)) |

Deferred requirements (FR-024, FR-030, FR-043 – FR-046) have no service method in the MVP.
