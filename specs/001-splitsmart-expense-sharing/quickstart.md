# Quickstart: Validating SplitSmart

**Phase 1 output of `/speckit-plan`** | **Date**: 2026-11-05

## Prerequisites

- Java 21 JDK, Maven 3.9+.

## Build and test

```bash
mvn verify          # compiles, runs all JUnit 5 tests; must be green
mvn package         # builds target/splitsmart.jar
java -jar target/splitsmart.jar
```

Data lives in `~/.splitsmart/`. Delete that folder to start fresh.

## End-to-end validation scenarios

| # | Steps | Expected | Verifies |
|---|-------|----------|----------|
| 1 | Register Alice, Bob, Carol; sign in as Alice | Dashboard shows no groups, net 0.00 | FR-001, FR-002 |
| 2 | Alice creates "Apartment 4B", adds Bob and Carol by email | All three are members | FR-007, FR-008 |
| 3 | Alice records 100.00, equal split, A/B/C | Preview 33.34 / 33.33 / 33.33; status Pending; balances unchanged | FR-014, FR-019, FR-025 |
| 4 | Sign in as Bob | Unread notification about Alice's expense | FR-021 |
| 5 | Bob approves; sign in as Carol, Carol approves | Status Approved; Bob owes Alice 33.33, Carol owes Alice 33.33; group sum 0.00 | FR-027, FR-031, FR-034 |
| 6 | Bob records a 33.33 payment to Alice; Alice confirms | Bob owes Alice 0.00 | FR-035, FR-036 |
| 7 | Try a 150% split, a 0.00 amount, a 100,000.01 amount | Each refused with the named problem | FR-015, FR-016 |
| 8 | Run a report for the current month | Lists the expense and payment; totals match | FR-040, FR-042 |
| 9 | Close and reopen the app, sign in as Alice | Same group, expense, payment | FR-006, NFR-006 |
