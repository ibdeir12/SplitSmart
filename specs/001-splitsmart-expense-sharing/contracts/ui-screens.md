# Contract: Desktop Screens

**Revision 2 (consolidated per ADR-001)** | **Date**: 2026-11-05 |
**Architecture decision**: [ADR-001](../../../docs/architecture/decision.md) |
**Services**: [service-api.md](service-api.md) | **Data model**: [data-model.md](../data-model.md)

Screens are Swing views with controllers in `com.splitsmart.ui`. They collect input, call the
services in [service-api.md](service-api.md), and render results. Every business decision
(split amounts, approver sets, who may decide or delete, balances, allowances, settledness,
succession, report totals) is made by services and domain rules; a screen only displays the
flags and values it receives.

## 1. Screens

| Screen | Inputs | Shows | Calls | Requirements |
|--------|--------|-------|-------|--------------|
| Startup | retry, choose another data directory | opening progress; on failure a safe recovery message naming the data directory and the action to take; never member data | application startup (lock, schema check, migration, receipt reconciliation) | FR-006, NFR-006, NFR-010 |
| Login / Register | email, display name, password | field errors inline; after an uncertain registration, a prompt to sign in to check | `AccountService.register`, `signIn` | FR-001 – FR-003, FR-005 |
| Dashboard | open group, create group, open notifications, sign out | my groups; one row per counterparty across all my groups with owes / is owed / settled and its per-group breakdown; overall position equal to the sum of the rows; unread count | `GroupService.myGroups`, `createGroup`; `BalanceService.myCounterpartyBalances`, `myOverallPosition`; `NotificationService.unreadCount` | FR-004, FR-007, FR-023, FR-032, FR-033 |
| Group | add by email, rename, remove member, leave, record expense, record payment, open expense | active members with current and original creator marked; my pair balances in this group (settled rows shown as settled); the group's expense list with ID, date, description, payer, amount, status; my payments in this group; membership history on request | `GroupService.members`, `membershipHistory`, `addMember`, `renameGroup`; `BalanceService.myBalances`; `ExpenseService.listExpenses`; `PaymentService.history(Session, groupId)` | FR-004, FR-007 – FR-011, FR-031, FR-033, FR-038, FR-048 |
| Departure dialog (remove or leave) | confirm, cancel | from `previewDeparture`: if not settled, every outstanding counterparty amount and why departure is refused; if settled, how many pending expenses and awaiting payments will be cancelled (with no balance change), and who becomes Group Creator or that the group will be archived; after commit, the `DepartureResult` | `GroupService.previewDeparture`, `removeMember`, `leaveGroup` | FR-008, FR-011, FR-049 |
| Expense form (dialog) | amount, date, description, payer, participants (ordered, ticked; payer preselected and can be unticked), split method, percentages, receipt file | live share preview from the service; running percentage total; receipt name and size once validated | `ExpenseService.previewShares`, `recordExpense` | FR-012 – FR-019, FR-025, FR-026 |
| Expense details | approve, reject with reason, delete (Pending, creator only), view receipt | amount, date, payer, creator, status, ordered shares; one row per required approver with decision, actor, and time or "awaiting"; a separate lifecycle history (cancellation actor, reason, time); receipt as none, viewable, or unavailable; actions enabled only by `canDecide` / `canDelete` | `ExpenseService.getExpense`, `getReceipt`, `deleteExpense`; `ApprovalService.approve`, `reject` | FR-017, FR-026 – FR-029, FR-047, FR-048, FR-049 |
| Approvals inbox | open expense | expenses awaiting my decision | `ApprovalService.awaitingMyDecision` | FR-026 |
| Payment form (dialog) | to member, amount, date, note | for the chosen receiver, three separate figures: confirmed debt, reserved by my awaiting payments, available to record; refusal states the available amount | `PaymentService.allowance`, `recordPayment` | FR-016, FR-035, FR-037 |
| Payments | confirm, decline with optional reason | sent and received payments with group, other member, amount, date, status; receiver decision and, separately, lifecycle cancellation reason and time; on a stale confirmation, the current debt with the option to decline | `PaymentService.history`, `confirm`, `decline` | FR-036 – FR-038, FR-049 |
| Notifications | open, mark read | accessible notifications with unread state, including cancellation notices | `NotificationService.inbox`, `unreadCount`, `markRead`, `open` | FR-021 – FR-023, FR-049 |
| Reports | from, to, group (my current groups only), item type | summary (approved share, paid, received, current net position); report rows with status and each monetary column's subtotal; activity totals are never labelled the current balance | `ReportService.summary`, `customReport` | FR-039 – FR-042 |

## 2. Common behaviour (NFR-005, NFR-010, NFR-011)

**Workers and the event thread.** Hashing, image reading and decoding, database access,
filesystem access, and report computation run in a background worker (`SwingWorker`). Only
presentation updates run on the Swing event dispatch thread, which never blocks.

**Current session only.** Each worker captures the `Session` it started with. On completion
the controller renders the result only if that session is still the current one and the screen
is still showing the same group or record; otherwise the result is discarded. After sign-out no
result can reveal the previous member's data (US1-AS10).

**Duplicate prevention.** While a mutation runs, its submit control and every other mutation
on the same screen are disabled. The controller allocates one `operationId` per submission and
reuses it for retries of that submission, so a retry can never create a second record.

**Input retention.** On any error the form keeps every entry, including the chosen receipt
file, so the member never retypes data.

**Outcome messages.** Each failed mutation states one of three outcomes in plain words: "Not
saved" (`NOT_COMMITTED`), "Saved" (`COMMITTED`, including after a later refresh failure), or
"Not sure whether this was saved" (`UNKNOWN`). Messages are safe: no stack traces, SQL, file
paths outside the data directory, passwords, or receipt content.

### 2.1 State definitions

| State | Trigger | Required presentation |
|-------|---------|-----------------------|
| Loading | a worker is running | progress indicator in the affected area; submit disabled; the rest of the window stays responsive |
| Empty | a query succeeds with no rows | a specific empty message (for example "No expenses yet in this group"); totals shown as 0.00 where the screen has totals |
| Field error | `ValidationException` | each `FieldError` shown next to its field; other entries kept |
| Operational error | `StorageUnavailableException`, or a read that fails | a banner saying what failed and whether anything was saved; for a `NOT_COMMITTED` mutation a **Retry** action reusing the same operation ID; for a failed read a **Reload** action |
| Unknown outcome | `OutcomeUnknownException` | the "not sure" message; every mutation on the screen stays disabled; a **Check status** action calls `CommandRunner.lookup`. `COMMITTED` → show as saved and refresh; `NOT_COMMITTED` → enable **Retry** with the same ID; still unavailable → keep the unknown state |
| Access revoked | `AccessDeniedException` for a group, record, or link the member can no longer reach, or `NotificationTarget.kind = NO_ACCESS` | close the group or record view, return to the Dashboard, and show "You no longer have access to this group"; no cached group content stays on screen |
| Conflict | `ConflictException` | the reason in plain words with its payload (current debt, outstanding balances, current status), and a refresh of the affected record; no automatic retry |

### 2.2 States per screen

"—" means the state cannot occur on that screen.

| Screen | Loading | Empty | Field error | Operational error | Unknown outcome, retry and status check | Access revoked |
|--------|---------|-------|-------------|-------------------|------------------------------------------|----------------|
| Startup | opening data directory, migrating, reconciling receipts | — | — | unavailable or locked directory, checksum mismatch, unknown future version, interrupted migration: recovery message and Retry; the existing store is never replaced with an empty one (US1-AS8) | — | — |
| Login / Register | while hashing and checking | — | email, display name, password; sign-in failure is one generic message | storage unavailable; entries kept | registration only: "Your account may have been created; sign in to check", with the sign-in action offered; no operation lookup is used and the password is never stored | — |
| Dashboard | groups, counterparty rows, overall position, unread count load independently | "You are not in any groups yet" with Create group; no balances shows overall position 0.00, settled | group name when creating | per-panel Reload; create group Retry | create group: Check status | a group removed while displayed disappears on refresh; opening it shows the access-revoked message |
| Group | members, balances, expenses, payments load independently | "No expenses yet", "No payments yet"; zero balances shown as settled | add-by-email, rename | per-panel Reload; add and rename Retry | add member, rename: Check status | removed while viewing, or group archived: return to Dashboard with the message |
| Departure dialog | preview and departure | — | — | departure rolled back: "Not removed; nothing changed" with Retry (US2-AS12) | Check status; for the member who left, a committed lookup shows only "You left the group" | subject already gone or actor no longer creator: close and refresh |
| Expense form | preview, receipt validation, save | no members to choose: explains that only group members can be selected | amount, date, description, participants (including no approver), percentages with current total, receipt (type, size, unreadable) | save failed before commit: Retry with same ID; receipt storage failure is an operational error, not a field error | Check status; the form stays filled until resolved | removed from group while the form is open: close the form on submit failure and return to Dashboard |
| Expense details | details and receipt load separately | no decisions yet: every approver shown as awaiting; no lifecycle history section when empty | reject reason | Reload; approve, reject, delete Retry | approve, reject, delete: Check status | expense or group no longer accessible: return to Dashboard |
| Expense details: receipt | loading image | `NONE`: "No receipt attached" | — | `ReceiptUnavailableException`: "Receipt unavailable" while all other details stay visible | — | as Expense details |
| Approvals inbox | list | "Nothing waiting for your decision" | — | Reload | — | items from inaccessible groups never appear |
| Payment form | allowance, save | available 0.00: "Nothing to record; you owe this member nothing in this group" | to member, amount (states available), date, note | save failed: Retry with same ID | Check status | as Expense form |
| Payments | history | "No payments yet" | decline reason length | confirm or decline failed: Retry; stale confirmation is a Conflict showing the current debt and offering Decline | confirm, decline: Check status | payments of departed groups are not listed; an open payment in one shows the message |
| Notifications | inbox and count | "No notifications" | — | Reload; mark read retried silently on next open | — (mark read and open are idempotent) | `NO_ACCESS` target: "This item is no longer available" with no group content |
| Reports | summary and report | empty range: empty rows and 0.00 totals, not an error | from, to (missing, start after end), group | Reload | — | a group filter that is no longer accessible is refused and removed from the list |

## 3. Requirement and scenario coverage

| Concern | Requirements | Scenarios |
|---------|--------------|-----------|
| Expense list and reopening after restart | FR-048 | US3-AS12 |
| Departure, cleanup, succession, archive | FR-008, FR-011, FR-049 | US2-AS3, US2-AS6, US2-AS8 – US2-AS12 |
| Counterparty balances and overall position | FR-032, FR-033 | US5-AS4 |
| Payment allowance and stale confirmation | FR-037 | US6-AS7 – US6-AS9 |
| Receipt validation and unavailability | FR-017 | US3-AS13, US3-AS14 |
| Lifecycle history apart from decisions | FR-029, FR-038 | US4-AS6, US6-AS6 |
| Inaccessible links and data | FR-004, FR-023 | US7-AS3, US7-AS8 |
| Field errors with entries kept | NFR-005 | US3-AS4, US3-AS5, US3-AS10, US3-AS13, US6-AS3 |
| Startup, outcomes, status check | NFR-010 | US1-AS8, US1-AS9 |
| Loading, responsiveness, duplicate prevention, sign-out | NFR-011 | US1-AS10, US8-AS7 |
