# Feature Specification: SplitSmart Expense Sharing

**Feature Branch**: `001-splitsmart-expense-sharing`

**Created**: 2026-10-28

**Updated**: 2026-11-05 (architecture consolidation, see [docs/architecture/decision.md](../../docs/architecture/decision.md))

**Status**: Reviewed

**Input**: User description: "Read UserRequirement.md in this workspace as the authoritative
customer requirements. Write a testable SplitSmart feature specification: actors, user
scenarios, functional and non-functional requirements, acceptance criteria, requirement IDs
(FR-001, etc.), and open questions. Preserve all original customer features in the requirements
inventory; label the Java Swing MVP subset separately. Do not write Java code. Do not edit
UserRequirement.md."

## Overview and Scope

SplitSmart lets friends, roommates, family members, and coworkers record shared expenses, see
who owes whom, and record payments that settle those debts. The authoritative customer request
is `UserRequirement.md`; it is not modified by this specification.

Two scopes are used throughout this document:

- **Full product (customer scope)**: every feature in `UserRequirement.md`, including web,
  Android, and iOS delivery. All of it is preserved in the
  [Requirements Inventory](#requirements-inventory).
- **MVP subset (desktop release)**: the first deliverable, a single-machine desktop application
  built with Java Swing as set by the project constitution. Requirements in this subset are
  tagged **[MVP]**; requirements outside it are tagged **[Deferred]** and remain customer
  requirements, not removed scope. The technology choice is an implementation decision recorded
  in `.specify/memory/constitution.md`, not a customer requirement. The MVP architecture is
  recorded in [ADR-001](../../docs/architecture/decision.md): one local Java 21 Swing process over
  an embedded H2 database and local receipt files, with one signed-in member at a time.

The specification defines **49 functional requirements: 43 tagged [MVP] and 6 tagged [Deferred]**
(FR-024, FR-030, FR-043, FR-044, FR-045, FR-046). Non-functional requirements (NFR-001 – NFR-011),
success criteria (SC-001 – SC-009), and acceptance scenarios are not counted as functional
requirements. The nine user stories are unchanged in number; the 2026-11-05 scenarios extend
existing stories.

## Clarifications

### Session 2026-10-28

- Q: Is the person who paid an expense also one of the people who owe a share of it? → A: The
  member chooses; the payer is included as a participant by default and can be unticked.
- Q: Who manages group membership, and what happens to someone who still owes or is owed money?
  → A: Only the Group Creator adds and removes members; expenses involve only members of the
  expense's group; a member with a non-zero balance in a group cannot be removed or leave it.
- Q: When a split does not divide evenly into cents, who gets the extra cent? → A: Leftover cents
  go one cent at a time to participants in the order they are listed (100.00 / 3 = 33.34, 33.33,
  33.33).
- Q: What expense and payment amounts are valid? → A: 0.01 to 100,000.00, at most two decimal
  places, a single currency (USD); zero, negative, and non-numeric amounts are refused.
- Q: For a percentage split, what totals are accepted? → A: Each participant's percentage is
  greater than 0 with at most two decimal places, and the total is exactly 100.00%; otherwise
  saving is refused and the current total is shown.
- Q: How do people sign in? → A: Unique email address plus a password of at least 8 characters
  containing at least one letter and one digit, stored hashed; account recovery is deferred to the
  web release.
- Q: Who gets notified about a new expense, and for what? → A: The payer and participants other
  than the expense creator get an in-app notification; members are also notified in-app of
  approval or rejection of their expenses and of payments recorded to them.
- Q: How does a recorded payment settle a balance? → A: A payment changes balances only after the
  receiver confirms it; it cannot exceed the amount currently owed; balances stay pairwise (no debt
  simplification across a group).
- Q: Who approves an expense before it changes balances, and can it be changed after approval? →
  A: Everyone involved (the payer and every participant) other than the expense creator must
  approve; any one of them can reject it with a reason; an Approved expense cannot be edited or
  deleted, and corrections are made by recording a new expense.

### Session 2026-11-05

Architecture consolidation (ADR-001). Decisions made by the project owner during consolidation.
These clarifications refine the 2026-10-28 answers; they are MVP clarifications and team
implementation decisions, not quotations from `UserRequirement.md`. Review defect labels A-D1 –
A-D4 refer to the [Architecture A review](../../docs/architecture/reviews/review-architecture-A-base.md);
D-1 – D-5 refer to the ideas adopted in [ADR-001](../../docs/architecture/decision.md).

- Q: Which architecture governs the MVP design? → A: ADR-001 selects Architecture A, one local
  Java 21 Swing process with one Maven module, embedded H2, local receipt files, manual dependency
  wiring, and one signed-in member at a time, and adopts D-1 – D-5 from Architecture B (ports for
  persistence, receipts, password hashing, and time; explicit transaction ownership; pending-payment
  reservation with confirmation-time revalidation; money as a decimal string at every text
  boundary; a versioned schema). These are implementation decisions, not customer requirements.
  The web, Android, and iOS clients stay deferred (FR-044 – FR-046).
- Q: Who records a payment, how much may be recorded while other payments are awaiting
  confirmation, and what happens if the debt changes before confirmation (A-D1, D-3)? → A: In the
  MVP, the signed-in recorder is the paying member; recording on behalf of another payer is not
  supported. A new payment may use only the current amount the payer owes the receiver in that
  group, less amounts already Awaiting Confirmation in the same direction. Reservations do not
  change balances. Confirmation must recheck the current debt; if the payment now exceeds it,
  confirmation is refused, the payment remains Awaiting Confirmation, and the receiver may decline
  it. A payment is never settled using a debt from another group.
- Q: When is a member settled, so that they can be removed or leave a group (A-D2)? → A: For
  removal or leaving, a member is settled only when every pairwise balance with that member in
  that group is 0.00. A scalar overall position of 0.00 can conceal debts to different people and
  is insufficient. This is an explicit clarification of FR-011 and US2-AS3/US2-AS6. A settled
  member can be removed or leave even when affected pending work exists; the system resolves that
  work as described in the next answer.
- Q: What happens to pending expenses and payments that involve a member who is removed or leaves
  (A-D2)? → A: In the same operation as a permitted departure, the system cancels each Pending
  expense for which the departing member is creator, payer, participant, or required approver,
  cancels each Awaiting Confirmation payment they send or receive, and releases the associated
  reservations. All source records and genuine decisions are kept. Cancellation is recorded
  separately with its initiating actor, reason, and time. Cancellation changes no balance and does
  not impersonate an Approver or a payment receiver.
- Q: Who becomes Group Creator when the current Group Creator departs, and what happens when the
  last member leaves (A-D2)? → A: The current Group Creator role transfers on that member's
  permitted departure to the remaining active member with the earliest current membership join
  time, breaking ties by ascending user UUID. The successor has all creator management rights.
  The original creator attribution is preserved. If no active member remains, the group is
  archived with its history and exposes no further member operations. No general group-deletion
  or ownership-transfer feature is introduced.
- Q: Which saved expenses can a member find and reopen (A-D3)? → A: Every current group member can
  list and reopen the group's saved expenses, including Pending, Approved, Rejected, and
  lifecycle-Cancelled records, after restart. The list includes stable expense IDs. A group with no
  expenses has an empty expense list. A former member cannot access the group through an old ID or
  notification.
- Q: How are balances shown across all of a member's groups (A-D4)? → A: The system shows a
  separate net amount for every counterparty across the signed-in member's current groups, with
  the contributing per-group amounts, plus an overall net position equal to the sum of those
  counterparty amounts. Debts between different counterparties are not simplified. Cross-group
  totals are informational; payments remain group-specific.
- Q: Which receipt images are accepted, and how large may they be? → A: One optional receipt is
  accepted only if its actual content decodes as JPEG or PNG and its size is at most
  **5,000,000 bytes (5 MB)**; the boundary is inclusive. A filename extension alone is
  insufficient. Invalid attachment input is refused while other form entries are retained;
  choosing no attachment remains valid. An unavailable stored image produces a receipt-unavailable
  message without hiding the expense or changing balances. This resolves research item R-06's
  ambiguous size unit as an MVP planning limit.
- Q: What must a member see when storage fails, an operation's outcome is unknown, or work is
  slow? → A: A storage or startup failure shows a safe, actionable message. A failed change states
  whether it was saved, not saved, or its outcome is unknown. Input is retained, and the operation
  status is checked before an unknown outcome is retried. The data store is never silently reset,
  false success is never reported, and a change is never repeated without resolving its prior
  result. Slow work shows a loading state and prevents duplicate submission. The local MVP needs no
  network connection; network failure belongs to the deferred clients.

## Actors

| Actor | Description | Customer source |
|-------|-------------|-----------------|
| **Visitor** | A person without a signed-in session; can register or sign in only. | User accounts |
| **Member** (registered user) | A person with a SplitSmart account who belongs to zero or more groups, records expenses, approves expenses, records payments, and views balances and reports. | User accounts, all features |
| **Group Creator** (current Group Creator) | The active member who currently holds a group's creator role and manages its membership and settings. Initially the member who created the group; after that member's permitted departure, the successor appointed under FR-049. An archived group has no current Group Creator. The **original creator** is a retained attribution of who created the group, not a role, and grants no rights after departure. | Group management; session 2026-11-05 |
| **Expense Creator** | The member who records an expense (may differ from the payer). | Expense creation |
| **Payer** | The member who actually paid for an expense; is owed money by the participants. For a payment, the paying member, who in the MVP is always the signed-in member who records it. | Expense creation, Balance tracking, Payment tracking |
| **Payment Receiver** | The member to whom a payment is recorded; the only member who can confirm or decline it. | Payment tracking |
| **Participant** | A member involved in an expense who owes a share of it. | Expense creation ("specify which other users were involved") |
| **Approver** | A member entitled to review a pending expense and approve or reject it; must hold active membership in the expense's group when deciding. | Approval workflow |
| **System** | SplitSmart itself: computes shares and balances, sends notifications, produces reports, and, on a permitted departure, cancels affected pending work, transfers the Group Creator role, or archives the group (FR-049). System actions are recorded as lifecycle events, never as an Approver's or receiver's decision. | Balance tracking, Notification system, Reporting; session 2026-11-05 |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Register, sign in, and see only my own data (Priority: P1)

A person creates a SplitSmart account, signs in, and sees their own groups, expenses, balances,
and payments, and nobody else's private data.

**Why this priority**: Every other feature depends on knowing who the user is; the customer
requires that each person access "their own expense and balance information".

**Independent Test**: Register two accounts, sign in as each, and confirm each sees only the
data they are entitled to.

**Acceptance Scenarios**:

1. **US1-AS1** **Given** a visitor with no account, **When** they register with valid details,
   **Then** an account is created and they can sign in with it.
2. **US1-AS2** **Given** a registered member, **When** they sign in with correct credentials,
   **Then** they see their own dashboard of groups, balances, and notifications.
3. **US1-AS3** **Given** a registered member, **When** they sign in with incorrect credentials,
   **Then** sign-in is refused with a message that does not reveal which field was wrong.
4. **US1-AS4** **Given** member A who is not in group G, **When** A views their data, **Then**
   no expense, balance, or member detail of group G is visible to A.
5. **US1-AS5** **Given** a signed-in member, **When** they sign out, **Then** no member data is
   visible until someone signs in again.
6. **US1-AS6** **Given** a registered member, **When** the stored account data is inspected,
   **Then** the member's password does not appear in readable form.
7. **US1-AS7** **Given** a member who recorded a group and an expense, **When** the application is
   closed, reopened, and the member signs in again, **Then** the same group and expense are shown.
8. **US1-AS8** **Given** an unavailable or unreadable data directory or database, **When** the
   application starts, **Then** it shows a safe recovery or retry message, shows no member data,
   and does not replace the existing data store with an empty one.
9. **US1-AS9** **Given** an authenticated persistent command with a stable operation ID, **When**
   a failure occurs before commit, after commit but before the result is displayed, or with an
   uncertain commit outcome, **Then** the member is told the change was not saved, saved, or has an
   unknown outcome respectively; input is preserved, an unknown outcome is resolved by a status
   check, and a retry produces only one source result and its notifications. An operation lookup
   or replay does not disclose resources the member can no longer access. **When** a registration
   outcome is uncertain, **Then** the visitor is offered ordinary sign-in to find out whether the
   account is usable, with generic credential errors and no disclosure of account results to an
   unauthenticated user. Password input is never persisted or fingerprinted.
10. **US1-AS10** **Given** slow sign-in, receipt, save, or report work, **When** it is running,
    **Then** a loading state is visible, the interface stays responsive, and repeated submission
    creates no duplicate action; **When** sign-out occurs before the work completes, **Then** its
    result cannot expose the prior member's data.
11. **US1-AS11** **Given** a backup taken while the application was closed, containing accounts,
    groups, decisions, payments, and receipts, **When** it is restored to a separate data directory
    and opened, **Then** those records, the derived balances, and the receipt references match the
    backup, and the original data directory is unchanged.

---

### User Story 2 - Create a group and manage its members (Priority: P1)

A member creates a group (for example "Apartment 4B" or "Ski Trip"), adds other members to it,
and later removes members who no longer share expenses.

**Why this priority**: The customer wants groups to "more easily track shared expenses and
balances within those groups"; every expense is recorded inside a group.

**Independent Test**: Create a group, add two members, remove one, and confirm the member list
and each member's view of the group.

**Acceptance Scenarios**:

1. **US2-AS1** **Given** a signed-in member, **When** they create a group with a name, **Then**
   the group exists with that member as its creator and first member.
2. **US2-AS2** **Given** a group, **When** the Group Creator adds a registered user by email,
   **Then** that user appears in the group's member list and can see the group.
3. **US2-AS3** **Given** a group member with at least one non-zero pairwise balance in the group,
   including a member whose overall net position in the group is 0.00 only because they owe one
   member and are owed the same amount by another, **When** the current Group Creator tries to
   remove them or they try to leave, **Then** the action is refused with a message showing each
   outstanding counterparty and amount.
4. **US2-AS4** **Given** a member who is not in a group, **When** they try to view or change it,
   **Then** access is refused.
5. **US2-AS5** **Given** a group member who is not the Group Creator, **When** they try to add or
   remove a member, **Then** the action is refused.
6. **US2-AS6** **Given** a group member whose every pairwise balance in the group is 0.00, **When**
   the current Group Creator removes them, **Then** removal succeeds, any affected pending work is
   resolved as FR-049 specifies, the removed member no longer sees the group, and the group's
   confirmed balances are unchanged.
7. **US2-AS7** **Given** a group, **When** the current Group Creator, including a successor
   appointed under FR-049, renames it, **Then** every member sees the new name; **When** another
   member tries to rename it, **Then** the action is refused.
8. **US2-AS8** **Given** a settled member who is the creator, payer, participant, or required
   approver of one or more Pending expenses, **When** they are removed or leave, **Then** the
   departure succeeds, every affected expense becomes Cancelled, prior genuine decisions and a
   separate cancellation history remain, no approval is left waiting on a departed member,
   balances stay unchanged, and each affected expense creator who remains a current group member
   and is not the initiating actor receives a cancellation notification that exposes nothing to
   the departed member.
9. **US2-AS9** **Given** a settled member with Awaiting Confirmation payments they sent or
   received, **When** their departure succeeds, **Then** those payments become Cancelled and their
   reservations are released in the same operation, balances do not change, and each affected
   payment party who remains a current group member and is not the initiating actor receives a
   cancellation notification.
10. **US2-AS10** **Given** a settled departing current Group Creator and remaining active members,
    **When** the departure succeeds, **Then** the remaining member with the earliest current join
    time, with ties broken by ascending user UUID, becomes current Group Creator and can add,
    remove, and rename; the original creator attribution remains, and the former creator loses
    access to the group.
11. **US2-AS11** **Given** a group whose last active member is settled, **When** that member
    leaves, **Then** the group is archived, its history remains, no active membership or
    management action remains, and confirmed balances stay unchanged.
12. **US2-AS12** **Given** a departure that requires pending-work cleanup and possibly creator
    succession, **When** any database or notification write fails, **Then** all departure,
    cancellation, reservation, role, and notification changes roll back together and group access
    remains as it was before.

---

### User Story 3 - Record a shared expense split equally or by percentage (Priority: P1)

A member records an expense with amount, date, description, payer, the participants involved,
and how it is shared (equally or by percentage), optionally attaching a receipt image.

**Why this priority**: Expense creation is the core of the customer's request; without it there
is nothing to balance, approve, or report.

**Independent Test**: Record an equal-split and a percentage-split expense and confirm each
participant's share and the total.

**Acceptance Scenarios**:

1. **US3-AS1** **Given** a group of three members, **When** a member records a 90.00 expense
   split equally among all three, **Then** each participant's share is 30.00 and the shares sum
   to 90.00.
2. **US3-AS2** **Given** a group of three members, **When** a member records a 100.00 expense
   split equally among all three, **Then** the shares are 33.34, 33.33, and 33.33 (the extra
   cent goes to the first participant listed) and sum to exactly 100.00.
3. **US3-AS3** **Given** a group, **When** a member records a 200.00 expense split 50% / 30% /
   20%, **Then** the shares are 100.00, 60.00, and 40.00.
4. **US3-AS4** **Given** a percentage split whose percentages total 99.99% or 100.01%, or that
   gives a participant 0% or a negative percentage, **When** the member tries to save it, **Then**
   saving is refused with a message stating the current total.
5. **US3-AS5** **Given** an expense form, **When** the amount is missing, 0.00, negative,
   non-numeric, has more than two decimal places, or is above 100,000.00, **Then** saving is
   refused with a message naming the problem; **When** the amount is 0.01 or 100,000.00, **Then**
   it is accepted.
6. **US3-AS6** **Given** an expense form, **When** the member attaches a receipt image whose
   content decodes as JPEG or PNG and whose size is at most 5,000,000 bytes (inclusive), **Then**
   the image is stored with the expense and can be viewed later through the authorized expense;
   **When** no image is attached, **Then** the expense is still valid.
7. **US3-AS7** **Given** an expense form, **When** no participant is selected, **Then** saving is
   refused.
8. **US3-AS8** **Given** A pays 60.00 for B and C and unticks themself as a participant, **When**
   the expense is split equally, **Then** B and C each owe 30.00 and A owes no share.
9. **US3-AS9** **Given** an expense in group G, **When** the member tries to choose a payer or a
   participant who is not a member of G, **Then** that person cannot be selected.
10. **US3-AS10** **Given** an expense form, **When** the description or the date is missing,
    **Then** saving is refused with a message naming the missing field.
11. **US3-AS11** **Given** a completed expense form, **When** the member reviews it before saving,
    **Then** each participant's computed share is shown and the shares add up to the amount.
12. **US3-AS12** **Given** saved Pending, Approved, Rejected, and Cancelled expenses in a group,
    **When** their creator restarts the application and opens the group's expense list, **Then**
    every one is listed with its stable ID and reopens with correct details; **When** a group has
    no expenses, **Then** its expense list is empty; **When** a nonmember requests the list or an
    expense's details, **Then** both are refused.
13. **US3-AS13** **Given** a receipt selection, **When** it is a valid JPEG or PNG of exactly
    5,000,000 bytes, **Then** it is accepted; **When** it is 5,000,001 bytes, of an unsupported
    type, undecodable, or misleadingly named with incompatible content, **Then** it is refused with
    a receipt-specific message and the other form entries remain.
14. **US3-AS14** **Given** receipt staging, final placement, and saving of the receipt reference,
    **When** storage fails or execution stops between any of these steps, **Then** reopening or
    recovery yields no committed reference to a file that was never finalized, keeps committed
    referenced files, and removes unreferenced staging or final files only after safe
    reconciliation; **When** a stored file later goes missing or becomes unreadable, **Then** the
    expense shows receipt-unavailable and its other details remain usable.
15. **US3-AS15** **Given** a first-time member already signed in to a prepared group, **When** they
    record an equal-split expense without help, **Then** the measured entry flow takes under one
    minute; this timing is recorded separately from the under-three-minute SC-002 journey.

---

### User Story 4 - Review and approve an expense before it affects balances (Priority: P2)

When an expense is recorded, it is first pending. Approvers review it and approve or reject it;
only approved expenses change balances.

**Why this priority**: The customer explicitly requires review and approval "before they are
added to the system and used to adjust balances".

**Independent Test**: Record an expense, confirm balances are unchanged while it is pending,
approve it, and confirm balances change; reject another and confirm balances never change.

**Acceptance Scenarios**:

1. **US4-AS1** **Given** a newly recorded expense, **When** no approval has happened, **Then** its
   status is Pending and no balance changes.
2. **US4-AS2** **Given** A records an expense paid by A with participants A, B, and C, **When** B
   approves and C has not, **Then** it stays Pending; **When** C also approves, **Then** its status
   becomes Approved and balances change by each participant's share.
3. **US4-AS3** **Given** a pending expense, **When** any one approver rejects it with a reason,
   **Then** its status becomes Rejected, balances do not change, and the expense creator can see
   the reason.
4. **US4-AS4** **Given** a member who is not an approver for an expense (including its creator and
   group members not involved in it), **When** they try to approve or reject it, **Then** the
   action is refused.
5. **US4-AS5** **Given** an Approved expense, **When** anyone tries to edit or delete it, **Then**
   the action is refused and the member is told to record a correcting expense instead.
6. **US4-AS6** **Given** an expense that has been approved, rejected, or lifecycle-cancelled,
   **When** a member involved in it views the expense, **Then** each genuine decision is listed
   with who made it and when, and any lifecycle event is listed separately with its initiating
   actor, reason, and time; a system cancellation is never labelled as an Approver's decision.
7. **US4-AS7** *[Deferred]* **Given** a group configured for two approval levels, **When** an
   expense passes the first level, **Then** it stays Pending until the second level approves it.
8. **US4-AS8** **Given** an expense whose creator is its only payer and participant, **When**
   saving is attempted, **Then** it is refused because it has no Approver, and no expense, shares,
   or notifications are saved.
9. **US4-AS9** **Given** a lifecycle-Cancelled expense, **When** an approve or reject action is
   attempted, **Then** the action is refused, genuine prior decisions and the separate cancellation
   history are retained, and balances are unchanged.
10. **US4-AS10** **Given** a Pending expense and an authorized Approver who has not yet decided,
    **When** persisting the decision, status, or notification fails, **Then** all of those writes
    roll back; **When** a decision is repeated or targets an expense in a terminal status, **Then**
    no second decision and no second outcome notification is created.

---

### User Story 5 - See who owes whom (Priority: P1)

A member sees, for every other member they share expenses with, how much they owe or are owed,
based on all approved expenses and recorded payments.

**Why this priority**: Balance tracking is the outcome users care about most; it is the reason
to record expenses at all.

**Independent Test**: Approve a small set of expenses and payments with hand-computed expected
balances, then compare the displayed balances.

**Acceptance Scenarios**:

1. **US5-AS1** **Given** A paid 90.00 split equally among A, B, and C and it is approved, **When**
   A views balances, **Then** B owes A 30.00 and C owes A 30.00.
2. **US5-AS2** **Given** the state of US5-AS1 and an approved 60.00 expense paid by B split
   equally between A and B, **When** balances are viewed, **Then** the A-B balance is shown as a
   single net amount (B owes A 0.00) and C owes A 30.00.
3. **US5-AS3** **Given** any set of approved expenses and confirmed payments in a group, **When**
   all members' balances are added together, **Then** the total is exactly 0.00.
4. **US5-AS4** **Given** B owes A 30.00 in group G1, A owes B 10.00 in group G2, and B owes C 5.00
   in group G1, **When** B views balances across all groups, **Then** B sees A: owes 20.00, made up
   of G1 owes 30.00 and G2 is owed 10.00; C: owes 5.00; and an overall position of owes 25.00.
   Per-group debts remain separate for payment validation, and no data from groups B cannot access
   appears.

---

### User Story 6 - Record a payment that settles a balance (Priority: P2)

A member who owes money records that they paid another member (in cash or any outside method);
the balance between them is reduced accordingly.

**Why this priority**: The customer requires balances to be "accurately reflected" after
payments; without it balances only ever grow.

**Independent Test**: Starting from a known balance, record a full and a partial payment and
confirm the remaining balance each time.

**Acceptance Scenarios**:

1. **US6-AS1** **Given** B owes A 30.00, **When** B records a 30.00 payment to A and A confirms
   it, **Then** B owes A 0.00 and the balance is shown as settled.
2. **US6-AS2** **Given** B owes A 30.00, **When** B records a 10.00 payment and A confirms it,
   **Then** B owes A 20.00.
3. **US6-AS3** **Given** B owes A 30.00, **When** a payment of 0.00, a negative amount, or more
   than 30.00 is entered, **Then** it is refused with a message naming the problem.
4. **US6-AS4** **Given** B records a 30.00 payment to A, **When** A has not yet confirmed it,
   **Then** its status is Awaiting Confirmation, the confirmed debt is unchanged (B still owes A
   30.00), the payment reserves 30.00 of the amount B can record to A in that group, and A is
   notified.
5. **US6-AS5** **Given** a payment awaiting A's confirmation, **When** A declines it, **Then** its
   status becomes Declined, the confirmed debt is unchanged, and the payment's reservation is
   released.
6. **US6-AS6** **Given** a member who has sent and received payments, **When** they view their
   payment history, **Then** every payment is listed with its group, other member, amount, date,
   and status, including lifecycle-Cancelled payments with their separate cancellation reason and
   time.
7. **US6-AS7** **Given** B owes A 30.00 in group G, **When** B records a 20.00 payment that is
   Awaiting Confirmation, **Then** the confirmed debt stays 30.00 and the amount available to
   record becomes 10.00; a further 20.00 payment is refused and a further 10.00 payment is
   accepted.
8. **US6-AS8** **Given** an Awaiting Confirmation payment of 30.00 and a later approved expense in
   the reverse direction that reduces the debt to 20.00, **When** the receiver confirms the
   payment, **Then** confirmation is refused showing the current debt of 20.00, the status stays
   Awaiting Confirmation, and balances remain 20.00; the receiver can decline the payment to
   release its reservation. The same refusal applies when the debt falls to zero or reverses
   direction.
9. **US6-AS9** **Given** several Awaiting Confirmation payments, **When** one is confirmed,
   declined, or lifecycle-cancelled, **Then** only that payment's reservation is released and only
   confirmation changes balances; repeated decisions, decisions by anyone other than the receiver,
   and attempts to record a payment for a different payer are refused. Competing approvals and
   payment decisions are serialized, and no confirmation creates a reverse debt by overpayment.
   Reservations in another group or in the opposite direction never increase the amount available
   to record.

---

### User Story 7 - Be notified of new expenses (Priority: P2)

When another group member records an expense that involves me, I am told about it so I can
review it.

**Why this priority**: Required by the customer ("notify users when other group members create
a new expense") and needed for timely approval.

**Independent Test**: Member A records an expense involving B; sign in as B and confirm an
unread notification about it.

**Acceptance Scenarios**:

1. **US7-AS1** **Given** A records an expense in group G with B as a participant, **When** B next
   views SplitSmart, **Then** B has an unread in-app notification naming the expense, its amount,
   and A.
2. **US7-AS2** **Given** A records an expense, **When** A views their own notifications, **Then**
   A has no notification about their own action.
3. **US7-AS3** **Given** an unread notification about a group B can still access, **When** B opens
   it, **Then** it is marked read and B is taken to the related expense or payment; **When** the
   linked group is no longer accessible to B, **Then** opening it gives the safe unavailable or
   no-access result of FR-023 and exposes no group content.
4. **US7-AS4** **Given** A records an expense in group G that does not involve member D, **When** D
   views notifications, **Then** D has no notification about it.
5. **US7-AS5** **Given** B created an expense, **When** it is approved or rejected, **Then** B
   receives an in-app notification of the decision.
6. **US7-AS6** *[Deferred]* **Given** a member with push or email notifications turned on, **When**
   another member records an expense involving them, **Then** they also receive the notification
   outside the application.
7. **US7-AS7** **Given** expense recording, a terminal expense decision, or payment recording,
   **When** a required notification write fails, **Then** the originating command rolls back with
   no partial source, status, or notification result; **When** it is retried successfully, **Then**
   exactly the specified recipients are notified, the creator receives no notification about their
   own creation action, and the creator does receive the required notifications about decisions or
   cancellations caused by others.
8. **US7-AS8** **Given** a former member holding an old notification or a saved object ID, **When**
   they request their inbox, unread count, a linked expense or payment, a receipt, group data, or a
   report, **Then** no content of that group is exposed and direct access is refused safely.

---

### User Story 8 - View reports of expenses, balances, and payments (Priority: P3)

A member views summaries of their expenses, balances, and payments, and builds a custom report
for a chosen date range and other filters.

**Why this priority**: Valuable but not needed to share expenses day to day.

**Independent Test**: With known data, run a report for a date range and compare its totals with
hand-computed values.

**Acceptance Scenarios**:

1. **US8-AS1** **Given** a member with expenses in several months, **When** they request a
   report for a start and end date, **Then** only expenses and payments dated within that range
   (inclusive) appear, with correct totals.
2. **US8-AS2** **Given** a report request, **When** the member filters by group, **Then** only that
   group's items are included.
3. **US8-AS3** **Given** a report request whose start date is after its end date, **When** it is
   submitted, **Then** it is refused with a message.
4. **US8-AS4** **Given** a range with no activity, **When** the report runs, **Then** it shows an
   empty result with zero totals rather than an error.
5. **US8-AS5** **Given** a member with expenses, balances, and payments, **When** they open their
   summary, **Then** it shows their total share of approved expenses, total paid and received, and
   current net balance, each matching hand-computed values.
6. **US8-AS6** *[Deferred]* **Given** a report on screen, **When** the member exports it, **Then** a
   file is saved containing the same items and totals.
7. **US8-AS7** **Given** the repeatable fixture of 20 members and 1,000 expenses in one group,
   **When** balances and reports are requested through their screen-to-service path, **Then** each
   completes in under two seconds, and the environment, the fixture, and separate elapsed results
   are recorded.

---

### User Story 9 - Use SplitSmart on the web, Android, and iOS (Priority: P3, Deferred)

A member uses SplitSmart from a web browser as the primary client, and from Android and iOS apps,
seeing the same account data on each.

**Why this priority**: A customer requirement, but deferred beyond the desktop MVP by an
implementation decision; preserved here so the scope reduction is visible.

**Independent Test**: Sign in to the same account on web, Android, and iOS and confirm identical
balances.

**Acceptance Scenarios**:

1. **US9-AS1** **Given** a member signed in on the web client, **When** they record an expense,
   **Then** it appears for the same account on the Android and iOS apps.

---

### Edge Cases

- An equal split whose amount does not divide evenly into cents (for example 100.00 among 3):
  leftover cents go to participants in listed order, so shares sum exactly to the amount.
- A percentage split that does not divide evenly into cents (for example 10.00 at 33.33% /
  33.33% / 33.34%): each share is rounded to the cent and any leftover cents go to participants
  in listed order, so shares sum exactly to the amount.
- Percentages that total 99.99% or 100.01%, a participant at 0%, or a negative percentage:
  refused.
- An amount of 0.00, a negative amount, more than two decimal places, non-numeric text, or an
  amount above 100,000.00: refused.
- The payer unticked as a participant: the payer owes no share and is owed the full amount.
- A participant who is not a member of the expense's group: cannot be selected.
- Removing a member, or a member leaving, while they still have any non-zero pairwise balance in
  the group: refused, showing each outstanding counterparty and amount. This includes a member
  whose overall position in the group is 0.00 only because they owe one member and are owed the
  same amount by another (session 2026-11-05).
- A settled member who is still involved in Pending expenses or Awaiting Confirmation payments:
  removal or leaving succeeds, and the affected pending work becomes Cancelled in the same
  operation with no balance change (FR-049).
- The current Group Creator departs: the role passes to the remaining active member with the
  earliest current join time (ties by ascending user UUID); if no active member remains, the group
  is archived with its history (FR-049).
- A former member opens an old notification or a saved expense, payment, or receipt ID: access is
  refused safely and no group content is shown.
- A group with no expenses: its expense list is empty, not an error.
- A payment larger than the amount available to record (the confirmed debt in that group and
  direction, less amounts already Awaiting Confirmation in that direction), or a payment between
  two members who owe each other nothing: refused.
- A payment the receiver never confirms: it stays Awaiting Confirmation and does not change the
  balance; it continues to reserve part of the amount available to record.
- A debt that shrinks, reaches zero, or reverses direction while a payment is Awaiting
  Confirmation: confirmation of a payment that now exceeds the confirmed debt is refused and the
  payment stays Awaiting Confirmation until it is confirmed within the new limit, declined, or
  cancelled.
- An attempt to approve or reject a Cancelled expense, or to confirm or decline a Cancelled
  payment: refused.
- An expense that is rejected after balances were displayed as pending.
- Editing or deleting an expense after it has been approved: refused; a correcting expense is
  recorded instead.
- An expense whose only payer and participant is its own creator: there is nobody to approve it
  and it cannot change any balance, so it is refused.
- An expense dated in the future: accepted (assumption; see Assumptions).
- A receipt image of an unsupported type, with undecodable content, with a filename extension that
  does not match its content, or larger than 5,000,000 bytes: refused with a receipt-specific
  message while other entries are kept. A receipt of exactly 5,000,000 bytes is accepted.
- A stored receipt file that later goes missing or cannot be read: the expense remains viewable
  and shows the receipt as unavailable; balances are unaffected.
- The data directory or database is unavailable at startup: a safe recovery message is shown and
  the existing data is never replaced with an empty store.
- A save whose outcome is unknown (for example a failure during commit): the member is told the
  outcome is unknown, input is kept, and the status is checked before any retry.
- A report date range with no activity, or with start after end.
- A member who belongs to no groups: sees zero balances and no expenses, and can create a group.

## Requirements *(mandatory)*

### Requirements Inventory

Every customer feature in `UserRequirement.md` is listed below with the requirements that realize
it and its scope. Nothing from the customer request has been dropped. In total there are 49
functional requirements: 43 [MVP] and 6 [Deferred] (FR-024, FR-030, FR-043 – FR-046). Counts are
taken from the scope tags of the FR definitions below, not from ID ranges.

| ID | Customer feature (from `UserRequirement.md`) | Requirements | Scope |
|----|----------------------------------------------|--------------|-------|
| CR-01 | User accounts: own account, log in, access own expense and balance information | FR-001 – FR-006, FR-048 | MVP |
| CR-02 | Group management: create and manage groups of people | FR-007 – FR-011, FR-049 | MVP |
| CR-03 | Expense creation: amount, date, description, shared manner (equal or %), optional receipt image | FR-012, FR-014 – FR-019, FR-048 | MVP |
| CR-04 | Expense creation: specify which other users were involved, for balance adjustments | FR-013, FR-020 | MVP |
| CR-05 | Notification system: notify users when other group members create a new expense | FR-021 – FR-023 (in-app, MVP); FR-024 (push/email, Deferred) | MVP (partial) |
| CR-06 | Approval workflow: review and approve expenses before they adjust balances; single or multiple levels per group | FR-025 – FR-029, FR-047, FR-048, FR-049 (single level, MVP); FR-030 (multi-level, Deferred) | MVP (partial) |
| CR-07 | Balance tracking: balance owed by each user to every other user across all expenses | FR-031 – FR-034 | MVP |
| CR-08 | Payment tracking: record payments that settle balances | FR-035 – FR-038, FR-049 | MVP |
| CR-09 | Reporting: reports and summaries of expenses, balances, payments; custom reports by date range and other parameters | FR-039 – FR-042 (MVP); FR-043 (export, Deferred) | MVP (partial) |
| CR-10 | OS supported: primarily web-based, plus Android and iOS apps | FR-044 – FR-046 | Deferred |

The following clarified reliability and usability requirements are **implementation decisions or
team-set assumptions** that support the customer features above; they are not customer
requirements:

| Requirement | Supports | Basis |
|-------------|----------|-------|
| NFR-003 Usability (one-minute expense entry) | CR-03 | Team-set target; session 2026-11-05 separates it from SC-002 |
| NFR-004 Responsiveness (20 members, 1,000 expenses, under 2 seconds) | CR-07, CR-09 | Team-set target |
| NFR-006 Durability, including receipts, histories, and closed-application backup and restore | CR-01, CR-03 | Implementation decision, session 2026-11-05 |
| NFR-010 Operational reliability (saved, not saved, unknown outcomes; safe recovery) | CR-01, CR-03, CR-08 | Implementation decision, session 2026-11-05 |
| NFR-011 Responsive operation feedback (loading state, duplicate prevention) | CR-01, CR-03, CR-08, CR-09 | Implementation decision, session 2026-11-05 |

### Functional Requirements

Each requirement lists its customer source (CR-xx) and its scope tag. **[MVP]** = in the desktop
MVP subset. **[Deferred]** = a customer requirement kept for a later release. Requirements amended
or added in the 2026-11-05 consolidation also cite that session and the review defect they close;
their IDs and scope tags are unchanged.

#### User accounts (CR-01)

- **FR-001** [MVP] (CR-01): System MUST let a visitor register an account with a unique email
  address, a display name, and a password of at least 8 characters containing at least one letter
  and one digit; registration with an email already in use MUST be refused.
- **FR-002** [MVP] (CR-01): System MUST let a registered member sign in with their credentials
  and refuse sign-in for incorrect credentials without revealing which credential was wrong.
- **FR-003** [MVP] (CR-01): System MUST let a signed-in member sign out.
- **FR-004** [MVP] (CR-01; amended in session 2026-11-05, A-D2, A-D3): System MUST show a
  signed-in member only data they are authorized to access: expenses and member information in
  groups of which they are currently a member, their own balances and sent and received payments,
  and their own accessible notifications. Every list, detail, receipt, report, and linked-item
  lookup MUST enforce that authorization. Leaving or removal revokes group access without deleting
  historical source records.
- **FR-005** [MVP] (CR-01): System MUST store passwords only in a non-reversible protected form,
  never as readable text.
- **FR-006** [MVP] (CR-01): System MUST keep each account's data between sessions, so a member who
  signs out and back in sees the same data.

#### Group management (CR-02)

- **FR-007** [MVP] (CR-02; amended in session 2026-11-05, A-D2): System MUST let a member create a
  group with a name; the creator becomes the current Group Creator and the first member. System
  MUST retain the original creator attribution separately from the current Group Creator role,
  whose succession is defined by FR-049.
- **FR-008** [MVP] (CR-02; amended in session 2026-11-05, A-D2): System MUST let only the current
  Group Creator add registered users by email or remove members; other members MUST be refused. A
  member may leave their own group subject to FR-011 and FR-049. Removing oneself follows the same
  departure procedure as leaving.
- **FR-009** [MVP] (CR-02; amended in session 2026-11-05, A-D2): System MUST let only the current
  Group Creator rename the group, including a successor appointed under FR-049.
- **FR-010** [MVP] (CR-02): System MUST show each group's member list to its members only.
- **FR-011** [MVP] (CR-02; amended in session 2026-11-05, A-D2): System MUST refuse removal or
  departure while any pairwise balance involving that member in the group is non-zero, and MUST
  show the outstanding counterparty amounts. When all those amounts are 0.00, System MUST permit
  departure and perform FR-049 atomically; pending work alone MUST NOT cause refusal.
- **FR-049** [MVP] (CR-02, CR-06, CR-08; lifecycle clarification, session 2026-11-05, A-D2): On
  removal or departure permitted by FR-011, System MUST atomically cancel affected Pending expenses
  where the member is creator, payer, participant, or required approver, cancel their sent and
  received Awaiting Confirmation payments, release reservations, retain source records and genuine
  decisions, and append separate lifecycle events with initiating actor, reason, and timestamp. If
  the current Group Creator departs, System MUST transfer that role to the earliest-joined
  remaining active member, breaking ties by ascending user UUID, or archive the group if none
  remains. System MUST revoke the departed member's access. The operation MUST leave confirmed
  balances unchanged.

#### Expense creation (CR-03, CR-04)

- **FR-012** [MVP] (CR-03): System MUST let a member record an expense in one of their groups,
  with an amount, a date, a description, a payer, and a split method.
- **FR-013** [MVP] (CR-04): System MUST require the member to select at least one participant
  involved in the expense, chosen only from members of the expense's group; the payer MUST also be
  a member of that group, MUST be selected as a participant by default, and the member MUST be able
  to unselect the payer.
- **FR-014** [MVP] (CR-03): System MUST support an **equal split**, giving each participant the
  amount divided by the number of participants rounded down to the cent, then giving the leftover
  cents one cent at a time to participants in the order they are listed, so the shares sum exactly
  to the amount.
- **FR-015** [MVP] (CR-03): System MUST support a **percentage split**, where the member enters a
  percentage greater than 0 with at most two decimal places per participant and the percentages
  total exactly 100.00%; each share is the amount times that percentage rounded down to the cent,
  with leftover cents given to participants in listed order so the shares sum exactly to the
  amount. A split whose percentages do not total 100.00% MUST be refused, showing the current
  total.
- **FR-016** [MVP] (CR-03): System MUST accept only amounts from 0.01 to 100,000.00 in US dollars
  with at most two decimal places, and refuse any other amount (missing, zero, negative,
  non-numeric, too precise, or too large) with a message that names the problem.
- **FR-017** [MVP] (CR-03; amended in session 2026-11-05, receipts): System MUST let a member
  optionally attach one receipt image and view it later through an authorized expense. Only
  decodable JPEG or PNG content of at most 5,000,000 bytes is accepted; unsupported, oversized, or
  undecodable content MUST be refused with a receipt-specific message while other entries are
  retained. An expense without an attachment is valid. An unavailable stored receipt MUST be
  identified as unavailable while the expense remains viewable.
- **FR-018** [MVP] (CR-03): System MUST refuse an expense with a missing description or date.
- **FR-019** [MVP] (CR-03): System MUST show each participant's computed share before the expense
  is saved, so the member can check it.
- **FR-020** [MVP] (CR-04): System MUST record, for every saved expense, the share owed by each
  participant to the payer, which is what balance tracking uses once the expense is approved.
- **FR-048** [MVP] (CR-01, CR-03, CR-06; session 2026-11-05, A-D3): System MUST let a current
  group member list that group's saved expenses with identifier, date, description, payer, amount,
  and status, open an expense from that list, and reopen Pending, Approved, Rejected, and
  lifecycle-Cancelled expenses after restart. System MUST show an empty list when there are no
  expenses and refuse nonmember access.

#### Notification system (CR-05)

- **FR-021** [MVP] (CR-05; amended in session 2026-11-05, A-D2): System MUST create an in-app
  notification for the payer and every participant of a new expense, other than the member who
  recorded it; group members not involved in the expense MUST NOT be notified. System MUST also
  notify a member in-app when an expense they created is approved or rejected and when a payment
  is recorded to them. Lifecycle cancellation under FR-049 MUST notify an affected expense creator
  and affected payment parties who remain current group members, excluding the initiating actor;
  these notifications and the cancellation MUST be saved together. No cancelled-work notification
  may expose the group to a departed member.
- **FR-022** [MVP] (CR-05; amended in session 2026-11-05): System MUST NOT notify a member about
  their own expense-creation action. This exclusion MUST NOT suppress approval, rejection, or
  lifecycle-cancellation notifications about that expense when those events are caused by another
  actor.
- **FR-023** [MVP] (CR-05; amended in session 2026-11-05, A-D2): System MUST show each member their
  notifications with an unread count, and let them mark notifications read and open the related
  expense or payment. Notifications whose group is no longer accessible MUST expose no group
  content, contribute no accessible unread item, and yield a safe unavailable or no-access result if
  opened through an old link. Stored notification history is retained, but a notification MUST NOT
  be usable to bypass group membership.
- **FR-024** [Deferred] (CR-05): System MUST be able to deliver notifications outside the
  application (for example push notifications on mobile or email).

#### Approval workflow (CR-06)

- **FR-025** [MVP] (CR-06; amended in session 2026-11-05, A-D2): System MUST give every new expense
  the status Pending. Pending, Rejected, and lifecycle-Cancelled expenses MUST NOT change any
  balance.
- **FR-026** [MVP] (CR-06; amended in session 2026-11-05, A-D2): System MUST make the Approvers of
  an expense everyone involved in it (its payer and every participant) except the member who
  recorded it, and let only those Approvers approve or reject it while it is Pending. An expense
  with no Approver (its creator is its only payer and participant) MUST be refused. A required
  Approver MUST still hold active membership in the group to decide and MUST NOT decide the same
  expense twice; when a member departs, FR-049 cancels the affected pending work rather than
  changing its Approver set.
- **FR-027** [MVP] (CR-06): System MUST change an expense to Approved only when every one of its
  Approvers has approved it, and only then apply its shares to balances.
- **FR-028** [MVP] (CR-06; amended in session 2026-11-05, A-D2): System MUST change an expense to
  Rejected as soon as any one Approver rejects it, require a rejection reason, keep it out of
  balances, and show the reason to the expense creator. Lifecycle cancellation is a distinct
  terminal outcome under FR-049 and MUST NOT be recorded as any member's rejection.
- **FR-029** [MVP] (CR-06; amended in session 2026-11-05, A-D2): System MUST record who approved or
  rejected each expense and when. Lifecycle events MUST be shown separately, with their initiating
  actor, reason, and timestamp; prior decisions remain visible to authorized members.
- **FR-047** [MVP] (CR-06): System MUST NOT allow an Approved expense to be edited or deleted;
  corrections are made by recording a new expense.
- **FR-030** [Deferred] (CR-06): System MUST let a group choose between a single review and
  multiple levels of approval, as the customer described ("depending on the needs of the group").

#### Balance tracking (CR-07)

- **FR-031** [MVP] (CR-07; amended in session 2026-11-05, A-D1, A-D2): System MUST compute, for
  every pair of members, the net amount one owes the other from all Approved expenses and all
  confirmed payments, keeping balances pairwise (no simplification of debts across a group).
  Cancelled expenses, Cancelled payments, and all Awaiting Confirmation reservations MUST be
  excluded from balances.
- **FR-032** [MVP] (CR-07; amended in session 2026-11-05, A-D4): System MUST show each member one
  row per counterparty stating whether they owe or are owed and how much across their current
  groups, the contributing per-group amounts, and an overall signed net position equal to the sum
  of the counterparty rows. A zero result MUST be shown as settled, not as a directional debt.
- **FR-033** [MVP] (CR-07; amended in session 2026-11-05, A-D4): System MUST show per-group pairwise
  balances and the all-groups per-counterparty view of FR-032. A payment MUST be checked against
  its own group's pairwise debt, irrespective of the all-groups total.
- **FR-034** [MVP] (CR-07): System MUST keep balances exact to the cent: the sum of all members'
  balances in a group MUST always equal 0.00.

#### Payment tracking (CR-08)

- **FR-035** [MVP] (CR-08; amended in session 2026-11-05, A-D1): System MUST let a signed-in member
  record a payment from themselves to another current member of a group they both belong to, with
  amount, date, and optional note. The session identifies the payer; a member MUST NOT record a
  payment on behalf of a different payer.
- **FR-036** [MVP] (CR-08; amended in session 2026-11-05, A-D1, A-D2): System MUST give a recorded
  payment the status Awaiting Confirmation, let only the receiving member confirm or decline it,
  and change the balance between the two members only when it is confirmed. Cancelled is a
  separate terminal status used only by FR-049. Decline and cancellation MUST NOT change any
  balance; each terminal transition releases the payment's pending reservation, and a terminal
  payment cannot be applied again.
- **FR-037** [MVP] (CR-08; amended in session 2026-11-05, A-D1, D-3): System MUST apply FR-016's
  amount rules. At recording, System MUST refuse an amount exceeding
  `max(0.00, current debt from payer to receiver in the group - Awaiting Confirmation amounts in
  that same direction and group)`. At confirmation, System MUST re-read the current confirmed debt
  in that group and refuse an amount exceeding it, leaving payment status and balances unchanged
  and showing the current debt. The check and transition MUST be indivisible with respect to other
  balance-changing operations. Reservations limit recording only; confirmation MUST NOT subtract
  its own reservation from the debt being checked.
- **FR-038** [MVP] (CR-08; amended in session 2026-11-05, A-D2): System MUST show a member's
  payment history (sent and received), including Cancelled status and the separate lifecycle
  reason and time when applicable.

#### Reporting (CR-09)

- **FR-039** [MVP] (CR-09): System MUST provide a summary of a member's expenses, balances, and
  payments.
- **FR-040** [MVP] (CR-09): System MUST let a member build a custom report by start date, end date
  (inclusive), group, and item type (expenses, payments, or both).
- **FR-041** [MVP] (CR-09): System MUST refuse a report whose start date is after its end date and
  show an empty report with zero totals when nothing matches.
- **FR-042** [MVP] (CR-09): System MUST show report totals that equal the sum of the listed items.
- **FR-043** [Deferred] (CR-09): System MUST let a member save or export a report to a file.

#### Platforms (CR-10)

- **FR-044** [Deferred] (CR-10): System MUST be available as a web application, which is the
  primary client.
- **FR-045** [Deferred] (CR-10): System MUST be available as an Android app.
- **FR-046** [Deferred] (CR-10): System MUST be available as an iOS app, with the same account
  data on every client.

### Non-Functional Requirements

- **NFR-001** [MVP] Correctness of money: every amount, share, balance, and payment is exact to the
  cent; no rounding loss or gain is allowed (shares sum to the expense amount; group balances sum
  to zero). Source: CR-03, CR-07, constitution Principle IV. Verified by: US3-AS1 – US3-AS3,
  US5-AS3.
- **NFR-002** [MVP] Privacy: a member can never see data of a group they do not belong to. Source:
  CR-01. Verified by: US1-AS4, US2-AS4.
- **NFR-003** [MVP] Usability: a first-time member who is already signed in to a prepared group can
  record an equal-split expense in under one minute without help. This target is separate from
  SC-002's under-three-minute onboarding journey; both are team-set targets. Source: assumption
  (team-set target, not from the customer); amended in session 2026-11-05. Verified by: US3-AS15
  and SC-009 (manual timing), separately from SC-002.
- **NFR-004** [MVP] Responsiveness: balances and reports for a group of up to 20 members and 1,000
  expenses appear in under 2 seconds. Source: assumption (team-set target, not from the customer).
  Verified by: a timed test over generated data (US8-AS7).
- **NFR-005** [MVP] Validation feedback: every refused input shows a field-specific message that
  names the field and the problem, and the member's other entries are kept. These validation
  messages are distinct from operational errors (storage, startup, and unknown-outcome failures),
  which NFR-010 covers. Source: CR-03; amended in session 2026-11-05. Verified by: US3-AS4,
  US3-AS5, US3-AS10, US3-AS13, US6-AS3.
- **NFR-006** [MVP] Durability: recorded data, including persisted receipt images, approval and
  lifecycle histories, and payment states, survives closing and reopening the application, and can
  be restored from a coherent backup of the data directory taken while the application is closed.
  Source: CR-01 ("access their own expense and balance information"); the backup and restore
  procedure is an implementation decision (session 2026-11-05). Verified by: US1-AS7, US1-AS11,
  US3-AS14.
- **NFR-007** [MVP] Traceability: every requirement in this specification maps to at least one
  acceptance scenario, a design element, and a test that names its ID, and every MVP functional
  requirement has executed acceptance evidence before the MVP is accepted. Deferred requirements
  keep their future verification plans and make no passing claim. Source: constitution Principles
  II and V; amended in session 2026-11-05. Verified by: the requirement, scenario, design, and test
  matrix audit, and SC-008.
- **NFR-008** [Deferred] Availability: the web client is available 99.5% of each month. Source:
  CR-10; the 99.5% target is an assumption, not from the customer. Verified by: uptime monitoring
  after the web release.
- **NFR-009** [Deferred] Consistency across clients: a change made on one client appears on the
  others within 10 seconds. Source: CR-10; the 10-second target is an assumption, not from the
  customer. Verified by: US9-AS1, timed.
- **NFR-010** [MVP] Operational reliability. Source: CR-01, CR-03, CR-08 and session 2026-11-05;
  the outcome and recovery contract is an implementation decision. Startup, database, disk, and
  receipt failures MUST produce safe, actionable feedback without losing retained input, silently
  replacing stored data, or exposing internal details. A mutation result MUST distinguish saved,
  not saved, and unknown outcomes. An unknown outcome MUST be resolved by a status lookup before
  retry; recovery MUST NOT create duplicate source records, decisions, or notifications. A missing
  or unreadable receipt MUST NOT prevent viewing the expense's other details. Verified by: US1-AS8,
  US1-AS9, US1-AS11, US3-AS14, US7-AS7.
- **NFR-011** [MVP] Responsive operation feedback. Source: team-set implementation usability
  decision, session 2026-11-05, supporting CR-01, CR-03, CR-08, and CR-09. During password
  hashing, image processing, database, file system, or report work, the interface MUST remain
  responsive, show a loading state, prevent duplicate submission, and preserve entries on failure.
  Completion after sign-out MUST NOT reveal the previous member's data. The design MUST specify how
  slow work runs outside the presentation event thread. Verified by: US1-AS10, US3-AS13, US8-AS7.

### Requirement-to-Acceptance Traceability

Every FR and NFR row below lists its complete acceptance-scenario set. A row marked (Deferred)
records a future verification obligation, not a passing result. Where an NFR's "Verified by" entry
above names fewer scenarios, this table is the complete set.

| Requirement | Acceptance scenarios |
|-------------|----------------------|
| FR-001 | US1-AS1 |
| FR-002 | US1-AS2, US1-AS3 |
| FR-003 | US1-AS5 |
| FR-004 | US1-AS2, US1-AS4, US3-AS12, US7-AS8 |
| FR-005 | US1-AS6 |
| FR-006 | US1-AS7 |
| FR-007 | US2-AS1, US2-AS10, US2-AS11 |
| FR-008 | US2-AS2, US2-AS5, US2-AS6, US2-AS8, US2-AS10 |
| FR-009 | US2-AS7, US2-AS10 |
| FR-010 | US2-AS4 |
| FR-011 | US2-AS3, US2-AS6, US2-AS8, US2-AS9, US2-AS11, US2-AS12 |
| FR-012 | US3-AS1, US3-AS9 |
| FR-013 | US3-AS7, US3-AS8, US3-AS9 |
| FR-014 | US3-AS1, US3-AS2 |
| FR-015 | US3-AS3, US3-AS4 |
| FR-016 | US3-AS5 |
| FR-017 | US3-AS6, US3-AS13, US3-AS14, US7-AS8 |
| FR-018 | US3-AS10 |
| FR-019 | US3-AS11 |
| FR-020 | US3-AS8, US5-AS1 |
| FR-021 | US7-AS1, US7-AS4, US7-AS5, US6-AS4, US2-AS8, US2-AS9, US7-AS7 |
| FR-022 | US7-AS2, US7-AS7 |
| FR-023 | US7-AS3, US7-AS8 |
| FR-024 | US7-AS6 (Deferred) |
| FR-025 | US4-AS1, US4-AS9 |
| FR-026 | US4-AS2, US4-AS4, US4-AS8, US4-AS9, US4-AS10 |
| FR-027 | US4-AS2, US4-AS10 |
| FR-028 | US4-AS3, US4-AS9, US4-AS10 |
| FR-029 | US4-AS6, US4-AS9, US4-AS10 |
| FR-030 | US4-AS7 (Deferred) |
| FR-031 | US5-AS1, US5-AS2, US5-AS4, US4-AS9, US6-AS8 |
| FR-032 | US5-AS1, US5-AS4 |
| FR-033 | US5-AS4, US6-AS9 |
| FR-034 | US5-AS3, US6-AS9 |
| FR-035 | US6-AS1, US6-AS2, US6-AS9 |
| FR-036 | US6-AS1, US6-AS4, US6-AS5, US2-AS9, US6-AS8, US6-AS9 |
| FR-037 | US6-AS3, US6-AS7, US6-AS8, US6-AS9 |
| FR-038 | US6-AS6, US2-AS9 |
| FR-039 | US8-AS5 |
| FR-040 | US8-AS1, US8-AS2 |
| FR-041 | US8-AS3, US8-AS4 |
| FR-042 | US8-AS1 |
| FR-043 | US8-AS6 (Deferred) |
| FR-044 | US9-AS1 (Deferred) |
| FR-045 | US9-AS1 (Deferred) |
| FR-046 | US9-AS1 (Deferred) |
| FR-047 | US4-AS5 |
| FR-048 | US3-AS12 |
| FR-049 | US2-AS6, US2-AS8, US2-AS9, US2-AS10, US2-AS11, US2-AS12, US4-AS9 |
| NFR-001 | US3-AS1, US3-AS2, US3-AS3, US5-AS3, US6-AS7, US6-AS8, US6-AS9 |
| NFR-002 | US1-AS4, US2-AS4, US3-AS12, US7-AS8 |
| NFR-003 | US3-AS15; SC-009 manual timing |
| NFR-004 | US8-AS7 timed workload |
| NFR-005 | US3-AS4, US3-AS5, US3-AS10, US3-AS13, US6-AS3 |
| NFR-006 | US1-AS7, US1-AS11, US3-AS14 |
| NFR-007 | Requirement/scenario/design/test matrix audit; SC-008 |
| NFR-008 | Deferred web uptime monitoring; US9-AS1 alone does not verify 99.5% availability |
| NFR-009 | US9-AS1, future timed cross-client verification; Deferred |
| NFR-010 | US1-AS8, US1-AS9, US1-AS11, US3-AS14, US7-AS7 |
| NFR-011 | US1-AS10, US3-AS13, US8-AS7 |

US8-AS3 and US8-AS4 are retained; their tests MUST explicitly cover an invalid date order, an
authorized group filter, inclusive endpoints, each item-type filter, and empty results with 0.00
totals.

Success-criterion verification:

| Success criterion | Verification |
|-------------------|--------------|
| SC-001 | US3-AS1, US3-AS2, US3-AS3, US5-AS3 |
| SC-002 | Separate manual first-time-user journey (register, create a group, record an equal-split expense), timed without coaching; not satisfied by SC-009 |
| SC-003 | US3-AS4, US3-AS5, US6-AS3 |
| SC-004 | US4-AS1, US4-AS3, US4-AS9, US6-AS4, US6-AS5, US2-AS8, US2-AS9 |
| SC-005 | US7-AS1, US7-AS4 |
| SC-006 | US6-AS1 |
| SC-007 | US8-AS1, US8-AS2, US8-AS3, US8-AS4 |
| SC-008 | Complete MVP test inventory: every FR tagged [MVP] (43) has at least one passing test named with its ID |
| SC-009 | US3-AS15, manual one-minute timing, recorded separately from SC-002 |

### Key Entities *(include if feature involves data)*

- **User (Member)**: a person with an account; email address, display name, protected password.
  Belongs to zero or more groups.
- **Group**: a named set of members; owns its expenses and payments. Records its **original
  creator** (the member who created it, kept as attribution and never changed) separately from its
  **current Group Creator** (the active member who holds the management role, FR-007, FR-049).
  State is Active or Archived: an active group has exactly one current Group Creator, who is an
  active member; an archived group (its last active member departed) has no active member and no
  current Group Creator, and keeps its history.
- **Membership**: a member's membership of one group, with its current join time and, once ended,
  its departure time. An **active membership** grants access to the group; an ended membership is
  retained as history and grants no access.
- **Expense**: group, amount, date, description, payer, split method (equal or percentage), status
  (Pending, Approved, Rejected, Cancelled), creator, optional receipt image; has one Share per
  participant. Cancelled is a terminal status reached only from Pending through FR-049, and refers
  to the LifecycleEvent that caused it.
- **Share**: the portion of an expense owed by one participant; for percentage splits, also the
  entered percentage.
- **Approval**: a genuine approve or reject decision on an expense, by one Approver, with a
  timestamp and (for rejections) a reason. At most one per expense and Approver. A system
  cancellation is never recorded as an Approval.
- **Payment**: an amount paid from one member to another within one group, with a date, optional
  note, and status
  (Awaiting Confirmation, Confirmed, Declined, Cancelled). The payer is the member who recorded it.
  Confirmed, Declined, and Cancelled are terminal; Cancelled is reached only from Awaiting
  Confirmation through FR-049 and refers to its LifecycleEvent.
- **LifecycleEvent**: an append-only audit record of a membership lifecycle action in a group:
  departure (removal or leaving), expense cancellation, payment cancellation, creator succession,
  or group archive. Records the group, the affected member or record, the initiating actor, the
  reason, the timestamp, and the successor where applicable. It is distinct from genuine Approval
  decisions and receiver decisions, and it is not a monetary record.
- **Balance**: the derived net amount one member owes another (per group, per counterparty across
  the member's current groups, and as an overall position); computed only from Approved expense
  shares and Confirmed payments, never entered directly. Pending, Rejected, and Cancelled expenses,
  Awaiting Confirmation, Declined, and Cancelled payments, and reservations do not affect it.
- **Notification**: a message to one member about an event (such as a new expense, a decision, a
  payment, or a lifecycle cancellation), with read or unread state and a link to the related
  expense or payment. A notification grants no access to a group the member no longer belongs to.
- **Receipt Image**: one optional image attached to one expense, whose content decodes as JPEG or
  PNG and whose size is at most 5,000,000 bytes; identified as unavailable if the stored file
  cannot be read.
- **Report**: a derived view over expenses and payments for a member, defined by date range, group,
  and item type.

Terms used in this specification (session 2026-11-05):

- **Current Group Creator**: the active member who currently holds a group's creator role (FR-008,
  FR-009, FR-049).
- **Original creator**: the member who created the group, retained as attribution only (FR-007).
- **Active membership**: a membership that has not ended through removal or leaving; it is the
  only basis for group access (FR-004).
- **Settled for departure**: every pairwise balance between the member and each other member of
  the group is 0.00; an overall position of 0.00 alone is not enough (FR-011).
- **Cancelled**: the terminal status given by FR-049 to a Pending expense or an Awaiting
  Confirmation payment affected by a permitted departure. It is a system lifecycle outcome, not a
  rejection or decline, and changes no balance.
- **Confirmed debt**: the amount the payer owes the receiver in one group, derived from Approved
  expense shares and Confirmed payments only, and never less than 0.00 for that direction.
- **Reserved amount**: the sum of Awaiting Confirmation payments from the payer to the receiver in
  the same group and direction. It never changes balances.
- **Available to record**: `max(0.00, confirmed debt - reserved amount)`, the most a new payment
  in that group and direction may be (FR-037).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of acceptance test cases, every expense's shares sum exactly to its amount
  and every group's balances sum exactly to 0.00.
- **SC-002**: A first-time member can register, create a group, and record an equal-split expense
  in under 3 minutes (team-set target, not from the customer).
- **SC-003**: 100% of invalid amounts and percentage totals in the acceptance tests are refused
  with a message naming the problem.
- **SC-004**: Pending, Rejected, and Cancelled expenses, and Awaiting Confirmation, Declined, and
  Cancelled payments, change no balance in 100% of acceptance tests.
- **SC-005**: Every member involved in a new expense, other than its creator, has an unread
  notification about it the next time they view SplitSmart.
- **SC-006**: After a full settlement payment is confirmed by the receiver, the balance between the two members is
  shown as 0.00 in 100% of acceptance tests.
- **SC-007**: Report totals match hand-computed totals for every acceptance test date range.
- **SC-008**: Every MVP functional requirement (FR tagged [MVP]) has at least one passing acceptance
  test that names its ID.
- **SC-009**: A first-time member already signed in to a prepared group can record an equal-split
  expense in under one minute without help, measured independently of SC-002 (team-set target,
  not from the customer).

## Open Questions

These were customer decisions that had to be made by a person in `/speckit-clarify`, not invented.
OQ-001 – OQ-009 were resolved in the clarification session of 2026-10-28, and those resolution
dates are unchanged.

Later decisions are recorded separately and do not alter that history:

- **ADR-001 (2026-11-05)** selected the MVP architecture
  ([decision.md](../../docs/architecture/decision.md)). It is an implementation decision, not a
  customer clarification.
- **Session 2026-11-05** (architecture consolidation) resolved the lifecycle, payment, discovery,
  and balance questions raised by review defects A-D1 – A-D4: payment availability and
  confirmation-time revalidation (A-D1), the meaning of settled membership, pending work on
  departure, and creator succession (A-D2), expense discovery (A-D3), and all-groups
  per-counterparty balances (A-D4). The same session fixed the receipt limit at 5,000,000 bytes and
  defined operational-failure behaviour. These answers refine OQ-002, OQ-007, OQ-008, and OQ-009;
  they are recorded under [Session 2026-11-05](#session-2026-11-05) and realized by FR-048, FR-049,
  NFR-010, NFR-011, SC-009, and the amended requirements that cite that session.

Resolved on 2026-10-28 (see [Clarifications](#clarifications)):

- **OQ-001 Payer versus participants**: resolved; FR-013.
- **OQ-002 Group membership**: resolved; FR-008, FR-011, FR-013. Two individuals who want to share
  expenses do so in a two-person group.
- **OQ-003 Rounding**: resolved; FR-014, FR-015.
- **OQ-004 Invalid amounts**: resolved; FR-016, FR-037.
- **OQ-005 Percentage totals**: resolved; FR-015.
- **OQ-006 Authentication**: resolved; FR-001.
- **OQ-007 Notifications**: resolved; FR-021.
- **OQ-008 Balance settlement**: resolved; FR-031, FR-036, FR-037.
- **OQ-009 Approval rules**: resolved; FR-026 – FR-029, FR-047. Multiple approval levels chosen per group
  remain a deferred customer requirement (FR-030).

No open questions remain for the MVP subset.

## Assumptions

- The members involved in an expense are its payer and its participants; participants are the
  members who owe a share.
- An expense may be dated in the past or the future; the date is used for reports and does not
  delay when the expense affects balances.
- Payments are recorded in SplitSmart only; actual money moves outside the application (cash, bank
  transfer, and so on). SplitSmart does not process payments.
- The desktop MVP runs on one machine and stores its data locally; multi-device synchronization
  arrives with the web and mobile clients (FR-044 – FR-046).
- In the desktop MVP, notifications are shown inside the application when the member next signs in or
  while they are signed in.
- Reports are shown on screen in the MVP; exporting is deferred (FR-043).
- A receipt image is accepted only if its content decodes as JPEG or PNG and its size is at most
  5,000,000 bytes (5 MB), inclusive; a filename extension alone is not sufficient (session
  2026-11-05). This limit is an MVP planning clarification, not a quotation from the customer
  request.
- The desktop MVP serves one signed-in member at a time in one running application that owns its
  data directory (ADR-001). Concurrent remote users are out of MVP scope.
- Backup and restore of the local data are done by copying the whole data directory while the
  application is closed, and restoring into a separate directory (NFR-006).
- The lifecycle, payment, discovery, balance, receipt, and operational-failure rules of session
  2026-11-05 are MVP clarifications and implementation decisions made during architecture
  consolidation, not statements from `UserRequirement.md`.
