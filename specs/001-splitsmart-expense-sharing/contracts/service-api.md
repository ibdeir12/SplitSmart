# Contract: Application Service API

**Phase 1 output of `/speckit-plan`** | **Date**: 2026-11-05

The Swing layer talks to the business layer only through these interfaces. Every method takes
the current `Session` (except register and sign in), runs in one transaction, and throws
`ValidationException(field, message)` for invalid input or `AccessDeniedException` for a
permission failure.

## AccountService (CR-01)

| Method | Realises | Notes |
|--------|----------|-------|
| `User register(String email, String displayName, char[] password)` | FR-001, FR-005 | refuses a duplicate email or a weak password |
| `Session signIn(String email, char[] password)` | FR-002 | generic "email or password is incorrect" on failure |
| `void signOut(Session s)` | FR-003 | |

## GroupService (CR-02)

| Method | Realises |
|--------|----------|
| `Group createGroup(Session s, String name)` | FR-007 |
| `void addMember(Session s, UUID groupId, String email)` | FR-008 |
| `void removeMember(Session s, UUID groupId, UUID userId)` | FR-008, FR-011 |
| `void leaveGroup(Session s, UUID groupId)` | FR-011 |
| `void renameGroup(Session s, UUID groupId, String name)` | FR-009 |
| `List<Group> myGroups(Session s)` / `List<User> members(Session s, UUID groupId)` | FR-004, FR-010 |

## ExpenseService (CR-03, CR-04)

| Method | Realises |
|--------|----------|
| `List<ShareView> previewShares(Session s, ExpenseDraft d)` | FR-014, FR-015, FR-019 |
| `Expense recordExpense(Session s, ExpenseDraft d)` | FR-012 – FR-018, FR-020, FR-025, FR-026 |
| `ExpenseDetails getExpense(Session s, UUID expenseId)` | FR-004, FR-029 |
| `void deleteExpense(Session s, UUID expenseId)` | FR-047 (refused unless Pending and by creator) |
| `byte[] getReceipt(Session s, UUID expenseId)` | FR-017 |

`ExpenseDraft`: groupId, amount (String as typed), date, description, payerId, splitMethod,
ordered participants with optional percentages, optional receipt file path.

## ApprovalService (CR-06)

| Method | Realises |
|--------|----------|
| `List<Expense> awaitingMyDecision(Session s)` | FR-026 |
| `void approve(Session s, UUID expenseId)` | FR-026, FR-027, FR-029 |
| `void reject(Session s, UUID expenseId, String reason)` | FR-026, FR-028, FR-029 |

## BalanceService (CR-07)

| Method | Realises |
|--------|----------|
| `List<PairBalance> myBalances(Session s, UUID groupId)` | FR-031, FR-032, FR-033 |
| `NetPosition myOverallPosition(Session s)` | FR-032, FR-033 |

## PaymentService (CR-08)

| Method | Realises |
|--------|----------|
| `Payment recordPayment(Session s, UUID groupId, UUID toUserId, String amount, LocalDate date, String note)` | FR-035, FR-037 |
| `void confirm(Session s, UUID paymentId)` / `void decline(Session s, UUID paymentId)` | FR-036 |
| `List<Payment> history(Session s)` | FR-038 |

## NotificationService (CR-05)

| Method | Realises |
|--------|----------|
| `List<Notification> inbox(Session s)` / `int unreadCount(Session s)` | FR-023 |
| `void markRead(Session s, UUID notificationId)` | FR-023 |
| internal: `notifyExpenseRecorded`, `notifyDecision`, `notifyPaymentRecorded` | FR-021, FR-022 |

## ReportService (CR-09)

| Method | Realises |
|--------|----------|
| `Summary summary(Session s)` | FR-039 |
| `Report customReport(Session s, ReportQuery q)` | FR-040 – FR-042 |
