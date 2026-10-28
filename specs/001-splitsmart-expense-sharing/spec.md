# Feature Specification: SplitSmart Expense Sharing

**Feature Branch**: `001-splitsmart-expense-sharing`

**Created**: 2026-10-28

**Status**: Draft

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
  in `.specify/memory/constitution.md`, not a customer requirement.

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

## Actors

| Actor | Description | Customer source |
|-------|-------------|-----------------|
| **Visitor** | A person without a signed-in session; can register or sign in only. | User accounts |
| **Member** (registered user) | A person with a SplitSmart account who belongs to zero or more groups, records expenses, approves expenses, records payments, and views balances and reports. | User accounts, all features |
| **Group Creator** | The member who created a group; manages the group's membership and settings. | Group management |
| **Expense Creator** | The member who records an expense (may differ from the payer). | Expense creation |
| **Payer** | The member who actually paid for an expense; is owed money by the participants. | Expense creation, Balance tracking |
| **Participant** | A member involved in an expense who owes a share of it. | Expense creation ("specify which other users were involved") |
| **Approver** | A member entitled to review a pending expense and approve or reject it. | Approval workflow |
| **System** | SplitSmart itself: computes shares and balances, sends notifications, produces reports. | Balance tracking, Notification system, Reporting |

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
3. **US2-AS3** **Given** a group member whose balance within the group is not zero, **When** the
   Group Creator tries to remove them or they try to leave, **Then** the action is refused with a
   message showing the outstanding balance.
4. **US2-AS4** **Given** a member who is not in a group, **When** they try to view or change it,
   **Then** access is refused.
5. **US2-AS5** **Given** a group member who is not the Group Creator, **When** they try to add or
   remove a member, **Then** the action is refused.
6. **US2-AS6** **Given** a group member whose balance within the group is 0.00, **When** the Group
   Creator removes them, **Then** they no longer see the group and the group's balances are
   unchanged.
7. **US2-AS7** **Given** a group, **When** the Group Creator renames it, **Then** every member sees
   the new name; **When** another member tries to rename it, **Then** the action is refused.

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
6. **US3-AS6** **Given** an expense form, **When** the member attaches a receipt image of a
   supported type, **Then** the image is stored with the expense and can be viewed later; **When**
   no image is attached, **Then** the expense is still valid.
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
6. **US4-AS6** **Given** an expense that has been approved or rejected, **When** a member involved in
   it views the expense, **Then** each decision is listed with who made it and when.
7. **US4-AS7** *[Deferred]* **Given** a group configured for two approval levels, **When** an
   expense passes the first level, **Then** it stays Pending until the second level approves it.

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
4. **US5-AS4** **Given** B owes A 30.00 in group G1 and A owes B 10.00 in group G2, **When** B views
   balances, **Then** B sees owing A 30.00 in G1, being owed 10.00 by A in G2, and an overall net
   position of owing A 20.00.

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
   **Then** its status is Awaiting Confirmation, B still owes A 30.00, and A is notified.
5. **US6-AS5** **Given** a payment awaiting A's confirmation, **When** A declines it, **Then** its
   status becomes Declined and the balance is unchanged.
6. **US6-AS6** **Given** a member who has sent and received payments, **When** they view their
   payment history, **Then** every payment is listed with its group, other member, amount, date,
   and status.

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
3. **US7-AS3** **Given** an unread notification, **When** B opens it, **Then** it is marked read
   and B is taken to the expense.
4. **US7-AS4** **Given** A records an expense in group G that does not involve member D, **When** D
   views notifications, **Then** D has no notification about it.
5. **US7-AS5** **Given** B created an expense, **When** it is approved or rejected, **Then** B
   receives an in-app notification of the decision.
6. **US7-AS6** *[Deferred]* **Given** a member with push or email notifications turned on, **When**
   another member records an expense involving them, **Then** they also receive the notification
   outside the application.

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
- Removing a member, or a member leaving, while they still have a non-zero balance: refused.
- A payment larger than the amount owed, or a payment between two members who owe each other
  nothing: refused.
- A payment the receiver never confirms: it stays Awaiting Confirmation and does not change the
  balance.
- An expense that is rejected after balances were displayed as pending.
- Editing or deleting an expense after it has been approved: refused; a correcting expense is
  recorded instead.
- An expense whose only payer and participant is its own creator: there is nobody to approve it
  and it cannot change any balance, so it is refused.
- An expense dated in the future: accepted (assumption; see Assumptions).
- A receipt image of an unsupported type or very large size.
- A report date range with no activity, or with start after end.
- A member who belongs to no groups: sees zero balances and no expenses, and can create a group.

## Requirements *(mandatory)*

### Requirements Inventory

Every customer feature in `UserRequirement.md` is listed below with the requirements that realize
it and its scope. Nothing from the customer request has been dropped.

| ID | Customer feature (from `UserRequirement.md`) | Requirements | Scope |
|----|----------------------------------------------|--------------|-------|
| CR-01 | User accounts: own account, log in, access own expense and balance information | FR-001 – FR-006 | MVP |
| CR-02 | Group management: create and manage groups of people | FR-007 – FR-011 | MVP |
| CR-03 | Expense creation: amount, date, description, shared manner (equal or %), optional receipt image | FR-012, FR-014 – FR-019 | MVP |
| CR-04 | Expense creation: specify which other users were involved, for balance adjustments | FR-013, FR-020 | MVP |
| CR-05 | Notification system: notify users when other group members create a new expense | FR-021 – FR-023 (in-app, MVP); FR-024 (push/email, Deferred) | MVP (partial) |
| CR-06 | Approval workflow: review and approve expenses before they adjust balances; single or multiple levels per group | FR-025 – FR-029, FR-047 (single level, MVP); FR-030 (multi-level, Deferred) | MVP (partial) |
| CR-07 | Balance tracking: balance owed by each user to every other user across all expenses | FR-031 – FR-034 | MVP |
| CR-08 | Payment tracking: record payments that settle balances | FR-035 – FR-038 | MVP |
| CR-09 | Reporting: reports and summaries of expenses, balances, payments; custom reports by date range and other parameters | FR-039 – FR-042 (MVP); FR-043 (export, Deferred) | MVP (partial) |
| CR-10 | OS supported: primarily web-based, plus Android and iOS apps | FR-044 – FR-046 | Deferred |

### Functional Requirements

Each requirement lists its customer source (CR-xx) and its scope tag. **[MVP]** = in the desktop
MVP subset. **[Deferred]** = a customer requirement kept for a later release.

#### User accounts (CR-01)

- **FR-001** [MVP] (CR-01): System MUST let a visitor register an account with a unique email
  address, a display name, and a password of at least 8 characters containing at least one letter
  and one digit; registration with an email already in use MUST be refused.
- **FR-002** [MVP] (CR-01): System MUST let a registered member sign in with their credentials
  and refuse sign-in for incorrect credentials without revealing which credential was wrong.
- **FR-003** [MVP] (CR-01): System MUST let a signed-in member sign out.
- **FR-004** [MVP] (CR-01): System MUST show a signed-in member only their own expenses,
  balances, payments, notifications, and the groups they belong to.
- **FR-005** [MVP] (CR-01): System MUST store passwords only in a non-reversible protected form,
  never as readable text.
- **FR-006** [MVP] (CR-01): System MUST keep each account's data between sessions, so a member who
  signs out and back in sees the same data.

#### Group management (CR-02)

- **FR-007** [MVP] (CR-02): System MUST let a member create a group with a name; the creator
  becomes the Group Creator and the first member.
- **FR-008** [MVP] (CR-02): System MUST let only the Group Creator add registered users (by email)
  to a group and remove members from it; other members MUST be refused.
- **FR-009** [MVP] (CR-02): System MUST let a member rename a group they created.
- **FR-010** [MVP] (CR-02): System MUST show each group's member list to its members only.
- **FR-011** [MVP] (CR-02): System MUST refuse to remove a member from a group, or let a member
  leave it, while that member's balance in the group is not 0.00, and MUST show the outstanding
  balance in the refusal message.

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
- **FR-017** [MVP] (CR-03): System MUST let the member optionally attach one receipt image to an
  expense and view it later; an expense without an image is valid.
- **FR-018** [MVP] (CR-03): System MUST refuse an expense with a missing description or date.
- **FR-019** [MVP] (CR-03): System MUST show each participant's computed share before the expense
  is saved, so the member can check it.
- **FR-020** [MVP] (CR-04): System MUST record, for every saved expense, the share owed by each
  participant to the payer, which is what balance tracking uses once the expense is approved.

#### Notification system (CR-05)

- **FR-021** [MVP] (CR-05): System MUST create an in-app notification for the payer and every
  participant of a new expense, other than the member who recorded it; group members not involved
  in the expense MUST NOT be notified. System MUST also notify a member in-app when an expense they
  created is approved or rejected and when a payment is recorded to them.
- **FR-022** [MVP] (CR-05): System MUST NOT notify a member about an expense they recorded
  themselves.
- **FR-023** [MVP] (CR-05): System MUST show each member their notifications with an unread count,
  and let them mark notifications read and open the related expense.
- **FR-024** [Deferred] (CR-05): System MUST be able to deliver notifications outside the
  application (for example push notifications on mobile or email).

#### Approval workflow (CR-06)

- **FR-025** [MVP] (CR-06): System MUST give every new expense the status Pending, and Pending
  expenses MUST NOT change any balance.
- **FR-026** [MVP] (CR-06): System MUST make the Approvers of an expense everyone involved in it
  (its payer and every participant) except the member who recorded it, and let only those
  Approvers approve or reject it while it is Pending. An expense with no Approver (its creator is
  its only payer and participant) MUST be refused.
- **FR-027** [MVP] (CR-06): System MUST change an expense to Approved only when every one of its
  Approvers has approved it, and only then apply its shares to balances.
- **FR-028** [MVP] (CR-06): System MUST change an expense to Rejected as soon as any one Approver
  rejects it, require a rejection reason, keep it out of balances, and show the reason to the
  expense creator.
- **FR-029** [MVP] (CR-06): System MUST record who approved or rejected each expense and when.
- **FR-047** [MVP] (CR-06): System MUST NOT allow an Approved expense to be edited or deleted;
  corrections are made by recording a new expense.
- **FR-030** [Deferred] (CR-06): System MUST let a group choose between a single review and
  multiple levels of approval, as the customer described ("depending on the needs of the group").

#### Balance tracking (CR-07)

- **FR-031** [MVP] (CR-07): System MUST compute, for every pair of members, the net amount one owes
  the other from all Approved expenses and all confirmed payments, keeping balances pairwise (no
  simplification of debts across a group).
- **FR-032** [MVP] (CR-07): System MUST show each member, for every other member, whether they owe
  or are owed and how much, and their overall net position.
- **FR-033** [MVP] (CR-07): System MUST show balances per group and across all groups.
- **FR-034** [MVP] (CR-07): System MUST keep balances exact to the cent: the sum of all members'
  balances in a group MUST always equal 0.00.

#### Payment tracking (CR-08)

- **FR-035** [MVP] (CR-08): System MUST let a member record a payment from one member to another
  in a group they both belong to, with an amount, a date, and an optional note.
- **FR-036** [MVP] (CR-08): System MUST give a recorded payment the status Awaiting Confirmation,
  let only the receiving member confirm or decline it, and change the balance between the two
  members only when it is confirmed; a declined payment MUST NOT change any balance.
- **FR-037** [MVP] (CR-08): System MUST validate payment amounts by the same rules as expense
  amounts (FR-016) and MUST refuse a payment larger than the amount the payer currently owes the
  receiver in that group.
- **FR-038** [MVP] (CR-08): System MUST show a member's payment history (sent and received).

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
- **NFR-003** [MVP] Usability: a first-time member can record an equal-split expense in under one
  minute without help. Source: assumption (team-set target, not from the customer). Verified by:
  SC-002.
- **NFR-004** [MVP] Responsiveness: balances and reports for a group of up to 20 members and 1,000
  expenses appear in under 2 seconds. Source: assumption (team-set target, not from the customer).
  Verified by: a timed test over generated data.
- **NFR-005** [MVP] Validation feedback: every refused input shows a message that names the field
  and the problem, and the member's other entries are kept. Source: CR-03. Verified by: US3-AS4,
  US3-AS5, US3-AS10, US6-AS3.
- **NFR-006** [MVP] Durability: recorded data survives closing and reopening the application.
  Source: CR-01 ("access their own expense and balance information"). Verified by: US1-AS7.
- **NFR-007** [MVP] Traceability: every requirement in this specification is verified by at least
  one acceptance test that names its ID. Source: constitution Principles II and V. Verified by: the
  traceability table below.
- **NFR-008** [Deferred] Availability: the web client is available 99.5% of each month. Source:
  CR-10; the 99.5% target is an assumption, not from the customer. Verified by: uptime monitoring
  after the web release.
- **NFR-009** [Deferred] Consistency across clients: a change made on one client appears on the
  others within 10 seconds. Source: CR-10; the 10-second target is an assumption, not from the
  customer. Verified by: US9-AS1, timed.

### Requirement-to-Acceptance Traceability

| Requirement | Acceptance scenarios |
|-------------|----------------------|
| FR-001 | US1-AS1 |
| FR-002 | US1-AS2, US1-AS3 |
| FR-003 | US1-AS5 |
| FR-004 | US1-AS2, US1-AS4 |
| FR-005 | US1-AS6 |
| FR-006 | US1-AS7 |
| FR-007 | US2-AS1 |
| FR-008 | US2-AS2, US2-AS5, US2-AS6 |
| FR-009 | US2-AS7 |
| FR-010 | US2-AS4 |
| FR-011 | US2-AS3 |
| FR-012 | US3-AS1, US3-AS9 |
| FR-013 | US3-AS7, US3-AS8, US3-AS9 |
| FR-014 | US3-AS1, US3-AS2 |
| FR-015 | US3-AS3, US3-AS4 |
| FR-016 | US3-AS5 |
| FR-017 | US3-AS6 |
| FR-018 | US3-AS10 |
| FR-019 | US3-AS11 |
| FR-020 | US3-AS8, US5-AS1 |
| FR-021 | US7-AS1, US7-AS4, US7-AS5, US6-AS4 |
| FR-022 | US7-AS2 |
| FR-023 | US7-AS3 |
| FR-024 | US7-AS6 (Deferred) |
| FR-025 | US4-AS1 |
| FR-026 | US4-AS2, US4-AS4 |
| FR-027 | US4-AS2 |
| FR-028 | US4-AS3 |
| FR-029 | US4-AS6 |
| FR-030 | US4-AS7 (Deferred) |
| FR-031 | US5-AS1, US5-AS2 |
| FR-032 | US5-AS1, US5-AS4 |
| FR-033 | US5-AS4 |
| FR-034 | US5-AS3 |
| FR-035 | US6-AS1, US6-AS2 |
| FR-036 | US6-AS1, US6-AS4, US6-AS5 |
| FR-037 | US6-AS3 |
| FR-038 | US6-AS6 |
| FR-039 | US8-AS5 |
| FR-040 | US8-AS1, US8-AS2 |
| FR-041 | US8-AS3, US8-AS4 |
| FR-042 | US8-AS1 |
| FR-043 | US8-AS6 (Deferred) |
| FR-044 | US9-AS1 (Deferred) |
| FR-045 | US9-AS1 (Deferred) |
| FR-046 | US9-AS1 (Deferred) |
| FR-047 | US4-AS5 |

### Key Entities *(include if feature involves data)*

- **User (Member)**: a person with an account; email address, display name, protected password.
  Belongs to zero or more groups.
- **Group**: a named set of members with one Group Creator; owns its expenses and payments.
- **Expense**: group, amount, date, description, payer, split method (equal or percentage), status
  (Pending, Approved, Rejected), creator, optional receipt image; has one Share per participant.
- **Share**: the portion of an expense owed by one participant; for percentage splits, also the
  entered percentage.
- **Approval**: an approve or reject decision on an expense, by one Approver, with a timestamp and
  (for rejections) a reason.
- **Payment**: an amount paid from one member to another within one group, with a date, optional
  note, and status
  (Awaiting Confirmation, Confirmed, Declined).
- **Balance**: the derived net amount one member owes another (per group and overall); computed
  from Approved expenses and confirmed payments, never entered directly.
- **Notification**: a message to one member about an event (such as a new expense), with read or
  unread state and a link to the related item.
- **Receipt Image**: an image file attached to one expense.
- **Report**: a derived view over expenses and payments for a member, defined by date range, group,
  and item type.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of acceptance test cases, every expense's shares sum exactly to its amount
  and every group's balances sum exactly to 0.00.
- **SC-002**: A first-time member can register, create a group, and record an equal-split expense
  in under 3 minutes (team-set target, not from the customer).
- **SC-003**: 100% of invalid amounts and percentage totals in the acceptance tests are refused
  with a message naming the problem.
- **SC-004**: Pending and Rejected expenses change no balance in 100% of acceptance tests.
- **SC-005**: Every member involved in a new expense, other than its creator, has an unread
  notification about it the next time they view SplitSmart.
- **SC-006**: After a full settlement payment is confirmed by the receiver, the balance between the two members is
  shown as 0.00 in 100% of acceptance tests.
- **SC-007**: Report totals match hand-computed totals for every acceptance test date range.
- **SC-008**: Every MVP functional requirement (FR tagged [MVP]) has at least one passing acceptance
  test that names its ID.

## Open Questions

These were customer decisions that had to be made by a person in `/speckit-clarify`, not invented.
All of them were resolved on 2026-10-28, and no requirement depends on an open question.

Resolved (see [Clarifications](#clarifications)):

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
- Receipt images are limited to common image types (JPEG, PNG) and a reasonable size limit set during
  planning.
