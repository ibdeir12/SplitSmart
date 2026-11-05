# Quickstart: Validating SplitSmart

**Phase 1 output of `/speckit-plan`** | **Date**: 2026-11-05 | **Plan**: [plan.md](plan.md)

**Revision**: 2 (consolidated per [ADR-001](../../docs/architecture/decision.md))

This guide builds and runs SplitSmart and lists the end-to-end validation activities. It is a
**plan**: no scenario below has been executed for this revision. Record each executed result
(date, build commit, environment, outcome, and evidence) against its scenario ID in the acceptance
matrix of [design.md](../../docs/design/design.md); the complete requirement-to-scenario mapping is
the [traceability table in spec.md](spec.md#requirement-to-acceptance-traceability).

## Prerequisites

- Java 21 JDK, Maven 3.9+.
- A writable scratch location for isolated validation data directories.

## Build and test

```bash
mvn verify          # compiles and runs all JUnit 5 tests; must be green
mvn package         # builds target/splitsmart.jar
```

## Run with an isolated data directory

Every validation run uses its own, newly created data directory selected with `--data-dir`.
Never point validation at a real member's data directory, and never delete an existing data
directory to "start fresh": choose a new, empty directory instead.

```bash
# macOS / Linux
VALIDATION_DIR="$(mktemp -d)/splitsmart-validation"
java -jar target/splitsmart.jar --data-dir "$VALIDATION_DIR"
```

```powershell
# Windows PowerShell
$ValidationDir = Join-Path $env:TEMP ("splitsmart-validation-" + (Get-Date -Format yyyyMMddHHmmss))
java -jar target\splitsmart.jar --data-dir $ValidationDir
```

Without `--data-dir` the application uses `~/.splitsmart`. A selected directory contains
`splitsmart.mv.db`, `receipts/` (with `receipts/staging/`), `app.lock`, and `logs/`. The schema
version (from `schema_version`, starting at `V001__initial.sql`) is reported in the startup log.

## End-to-end validation scenarios

**Method**: *Manual* = performed through the Swing application in an isolated data directory.
*Automated* = a JUnit test (file-mode H2 where durability, files, or failures are involved), named
with the requirement ID and showing the scenario ID; failure injection is only possible in tests.
Scenarios 1 to 9 are the original smoke scenarios and are kept unchanged in substance.

| # | Steps | Expected | Verifies | Method |
|---|-------|----------|----------|--------|
| 1 | Register Alice, Bob, Carol; sign in as Alice | Dashboard shows no groups, net 0.00 shown as settled | FR-001, FR-002; US1-AS1, US1-AS2 | Manual |
| 2 | Alice creates "Apartment 4B", adds Bob and Carol by email | All three are members; Alice is current Group Creator | FR-007, FR-008; US2-AS1, US2-AS2 | Manual |
| 3 | Alice records 100.00, equal split, A/B/C | Preview 33.34 / 33.33 / 33.33; status Pending; balances unchanged | FR-014, FR-019, FR-025; US3-AS2, US4-AS1 | Manual |
| 4 | Sign in as Bob | Unread notification about Alice's expense | FR-021; US7-AS1 | Manual |
| 5 | Bob approves; sign in as Carol, Carol approves | Status Approved; Bob owes Alice 33.33, Carol owes Alice 33.33; group sum 0.00 | FR-027, FR-031, FR-034; US4-AS2, US5-AS3 | Manual |
| 6 | Bob records a 33.33 payment to Alice; Alice confirms | Bob owes Alice 0.00 | FR-035, FR-036; US6-AS1 | Manual |
| 7 | Try a 150% split, a 0.00 amount, a 100,000.01 amount | Each refused with the named problem; other entries kept | FR-015, FR-016; US3-AS4, US3-AS5 | Manual |
| 8 | Run a report for the current month | Lists the expense and payment; totals match | FR-040, FR-042; US8-AS1 | Manual |
| 9 | Close and reopen the app with the same `--data-dir`, sign in as Alice | Same group, expense, payment | FR-006, NFR-006; US1-AS7 | Manual + Automated |
| 10 | Expense discovery: in "Apartment 4B" create one Pending, one Approved, one Rejected, and (via scenario 16) one Cancelled expense; restart; Alice opens the group's expense list; open a new empty group; Dave (nonmember) requests the list and an expense ID | All four listed with stable IDs and reopen with correct details; empty group shows an empty list; Dave is refused for list and detail | FR-004, FR-048; US3-AS12 | Manual + Automated |
| 11 | Multiple counterparties: in G1 B owes A 30.00 and B owes C 5.00; in G2 A owes B 10.00 (all Approved); B opens the dashboard | A: owes 20.00 with G1 owes 30.00 / G2 is owed 10.00; C: owes 5.00; overall owes 25.00; per-group debts unchanged for payments | FR-032, FR-033; US5-AS4 | Manual + Automated |
| 12 | Reservations: B owes A 30.00 in G; B records 20.00 (Awaiting Confirmation); B tries 20.00 again, then 10.00 | Confirmed debt stays 30.00; available-to-record 10.00; second 20.00 refused; 10.00 accepted; payment form shows debt, reserved, available separately | FR-037; US6-AS4, US6-AS7 | Manual + Automated |
| 13 | Stale confirmation: B records 30.00 to A; an expense reducing B's debt to 20.00 is approved; A confirms; repeat with debt falling to 0.00 and reversing direction | Confirmation refused showing current debt; status stays Awaiting Confirmation; balances unchanged; A declines and the reservation is released | FR-036, FR-037; US6-AS5, US6-AS8 | Manual + Automated |
| 14 | Payment decisions: confirm, decline, and lifecycle-cancel separate pending payments; repeat a decision; decide as the payer; record a payment on behalf of another payer; race two decisions and an approval | Only the affected reservation is released; only confirmation changes balances; repeated, wrong-actor, and on-behalf actions refused; no reverse debt by overpayment | FR-035, FR-036, FR-037; US6-AS9 | Automated |
| 15 | Settled check: in G, B owes A 10.00 and C owes B 10.00 (B's overall position 0.00); Alice removes B, then B tries to leave | Both refused; outstanding counterparties and amounts shown | FR-011; US2-AS3 | Manual + Automated |
| 16 | Departure with pending work: settle B, leave B as creator, payer, participant, or approver on Pending expenses and as sender or receiver of Awaiting payments; Alice removes B | Removal succeeds; affected expenses and payments become Cancelled with separate lifecycle history; prior decisions kept; reservations released; remaining affected creators and payment parties notified; balances unchanged; B no longer sees the group | FR-008, FR-011, FR-021, FR-049; US2-AS6, US2-AS8, US2-AS9 | Manual + Automated |
| 17 | Creator succession: settled Alice (current Group Creator) leaves; Bob joined before Carol | Bob becomes current Group Creator and can add, remove, and rename; original creator attribution remains Alice; Alice loses access | FR-007, FR-008, FR-009, FR-049; US2-AS7, US2-AS10 | Manual + Automated |
| 18 | Archive: the last settled active member leaves | Group archived; history retained; no management action available; balances unchanged | FR-049; US2-AS11 | Automated |
| 19 | Departure rollback: inject a failure in a cancellation, role, or notification write during departure | All departure, cancellation, reservation, role, and notification changes roll back; access unchanged | FR-011, FR-049, NFR-010; US2-AS12 | Automated |
| 20 | Unauthorized IDs: as a former member, open an old notification, an old expense ID, a payment, a receipt, the group, and a report filtered to the group; as a nonmember, request the group | No group content exposed; inaccessible notifications excluded from the inbox and unread count; each request refused safely | FR-004, FR-023, NFR-002; US1-AS4, US2-AS4, US7-AS3, US7-AS8 | Manual + Automated |
| 21 | Sign-out: start a slow report or save, sign out before it completes, sign in as another member | No member data visible after sign-out; the late result is not rendered | FR-003; US1-AS5, US1-AS10 | Manual + Automated |
| 22 | Invalid inputs: missing, negative, non-numeric, three-decimal, and above-cap amounts; percentages totalling 99.99 and 100.01; no participant; missing description and date; payment of 0.00 and above the debt | Each refused with a message naming the field and problem; other entries kept | FR-013, FR-015, FR-016, FR-018, FR-037, NFR-005; US3-AS4, US3-AS5, US3-AS7, US3-AS10, US6-AS3 | Manual + Automated |
| 23 | Approval guards: save an expense whose creator is its only payer and participant; approve or reject a Cancelled expense; decide twice | No-approver expense refused with nothing saved; actions on the Cancelled expense refused with history kept; no second decision or notification | FR-026, FR-028, FR-029; US4-AS8, US4-AS9, US4-AS10 | Automated |
| 24 | Reports: start after end; group filter for a group the member does not belong to; inclusive start and end dates; each item type (expenses, payments, both); a range with no activity | Invalid order and unauthorized filter refused; endpoint items included; type filters exact; empty result with 0.00 totals | FR-040, FR-041, FR-042; US8-AS2, US8-AS3, US8-AS4 | Manual + Automated |
| 25 | Receipt bounds: attach a valid PNG of exactly 5,000,000 bytes, one of 5,000,001 bytes, a GIF, a truncated JPEG, and a text file renamed `.png` | 5,000,000 bytes accepted and viewable later; the others refused with a receipt-specific message; other entries kept | FR-017; US3-AS6, US3-AS13 | Automated (fixtures generated by the test; a valid PNG padded with a private ancillary chunk) + Manual (one accepted image) |
| 26 | Receipt failures: inject failures between staging, final placement, and reference commit; stop between steps and restart; with the app closed, remove one referenced receipt from a copy of the data directory and reopen | No committed reference to an unfinalized file; committed files retained; unreferenced files removed only after reconciliation; missing file shows receipt-unavailable while the expense stays viewable | FR-017, NFR-006, NFR-010; US3-AS14 | Automated + Manual (missing-file case) |
| 27 | Notification write failure on expense recording, terminal decision, and payment recording; then retry | Command rolls back fully; successful retry leaves exactly the specified recipients | FR-021, FR-022, NFR-010; US7-AS7 | Automated |
| 28 | Startup failures: `--data-dir` pointing at an unreadable directory, at a regular file, and at a directory already locked by a running instance | Safe actionable message; no member data shown; existing store not replaced; second instance refused | NFR-010; US1-AS8 | Manual + Automated |
| 29 | Uncertain outcomes: inject failure before commit, after commit before display, and with uncertain commit; retry with the same operation ID; uncertain registration followed by sign-in | Not saved, saved, and unknown reported respectively; input kept; status check resolves unknown; retry yields one source result and its notifications; registration resolved by ordinary sign-in with generic errors | NFR-010; US1-AS9 | Automated |
| 30 | Slow work: run sign-in, receipt validation, save, and a report with an artificial delay; click submit repeatedly | Loading visible; window responds; one action only | NFR-011; US1-AS10 | Automated + Manual |
| 31 | Migrations: first launch in a new directory; reopen; a database with an unknown future version; a modified applied-script checksum; an interrupted migration (marker present); an interrupted first initialization | V001 applied and recorded; reopen validates; future version and checksum mismatch refused without writing; interrupted migration blocks startup and points to the pre-upgrade backup; interrupted first initialization restarts only in a verified empty directory | NFR-006, NFR-010 (D-5) | Automated (file mode) |
| 32 | Stopped-application backup and restore (procedure below) | Restored copy matches the backup; original directory unchanged | NFR-006, NFR-010; US1-AS11 | Manual + Automated |
| 33 | NFR-004 timed workload (method below) | Balances and reports each complete in under 2 seconds | NFR-004, NFR-011; US8-AS7 | Automated, timed |
| 34 | Expense-entry timing (protocol below) | Under one minute without help | NFR-003, SC-009; US3-AS15 | Manual, timed |
| 35 | Onboarding timing (protocol below) | Under three minutes without help | SC-002 | Manual, timed |

## NFR-004 fixture timing method (US8-AS7)

**Fixture** (repeatable; generated by a planned test-scope fixture builder with fixed seed 285, all
amounts produced as decimal strings):

- one group of 20 members, plus each member's account;
- 1,000 expenses persisted through the service layer, so shares, decisions, notifications, and
  operation results have their real shape: 800 Approved, 100 Pending, 50 Rejected, 50 Cancelled;
  equal and percentage splits in roughly equal numbers; 2 to 20 participants each with persisted
  ordered shares; amounts from 0.01 to 100,000.00; expense dates spread evenly from 2026-01-01 to
  2026-12-31;
- 200 payments: 150 Confirmed, 30 Awaiting Confirmation, 20 Declined, dated across the same year;
- a file-mode H2 data directory created fresh for each measurement session.

**Environment record**: CPU model and core count, RAM, operating system and version, disk type,
JDK vendor and version, JVM options, H2 version, build commit, and whether the machine was on
battery power.

**Measured boundaries**: from the controller receiving the screen request on the event dispatch
thread to the result applied to the screen on the event dispatch thread, through the full
controller -> worker -> service -> H2 file-mode path. Timestamps use `System.nanoTime()`.

**Measurements, each recorded separately**:

1. Group pairwise balances for the fixture group.
2. Dashboard all-groups counterparty balances for one fixture member.
3. Custom report for the full year, item type BOTH, filtered to the fixture group.
4. Member summary.

**Warm-up policy**: start the application, sign in, and run each measured request once; discard
these warm-up results. Then run each request 5 times. Record every elapsed time; the requirement is
met for a request only when **every** measured run is under 2.000 seconds. Cold-start time is
recorded once for information and is not part of the pass criterion.

## Usability timing protocols (NFR-003/SC-009 and SC-002)

The two protocols are separate tasks with separate participants. A person who has completed one
protocol is no longer a first-time member for the other. Neither result is marked passed because
the other passed.

**Common rules**: at least three participants per protocol who have never used SplitSmart; a fixed
printed task card; the facilitator reads the card, then gives no coaching and answers no questions
about the interface. A request for help ends the attempt, recorded as "needed help". Timing uses a
stopwatch or screen recording. For each attempt record: participant code, date, build commit,
elapsed time, outcome (completed, completed with errors, needed help, abandoned), and observed
errors. Each target is met only if every participant completes without help within the limit; any
other result is reported as not met, with the data.

**NFR-003 / SC-009 / US3-AS15 (expense entry, under one minute)**:

- Setup: an isolated data directory with a prepared group "Apartment 4B" of three members; the
  participant's account is already a member and signed in, on the dashboard.
- Task card: "In Apartment 4B, record a 45.00 grocery expense dated today, paid by you, split
  equally among all three members."
- Start: when the facilitator says "start" after reading the card. Stop: when the saved expense
  appears as Pending in the group's expense list.

**SC-002 (onboarding, under three minutes)**:

- Setup: an isolated data directory in which one other account (Bob) already exists; the
  application is open at the sign-in screen.
- Task card: "Create your own account, create a group called Ski Trip, add Bob by email, and record
  a 60.00 lift-ticket expense dated today, paid by you, split equally between you and Bob."
- Start: when the facilitator says "start". Stop: when the saved expense appears as Pending in the
  group's expense list.

## Stopped-application backup and restore (US1-AS11)

1. **Note the expected state** in the source data directory: accounts, group memberships, approval
   decisions, lifecycle events, payment statuses, derived balances, schema version from the startup
   log, and the expenses with receipts.
2. **Stop cleanly**: exit SplitSmart from its window and wait until the Java process has ended.
   Never copy a data directory while the application is running.
3. **Copy the entire directory** to the backup location:

   ```bash
   cp -R "$VALIDATION_DIR" "$BACKUP_DIR"
   ```

   On Windows: `robocopy $ValidationDir $BackupDir /E`.
4. **Restore into a separate directory**, never over the original:

   ```bash
   cp -R "$BACKUP_DIR" "$RESTORE_DIR"
   java -jar target/splitsmart.jar --data-dir "$RESTORE_DIR"
   ```

5. **Verify before adopting** the restored copy: every account signs in; memberships match; genuine
   approval history and lifecycle history match; payment statuses match; derived balances match the
   noted values; the startup log reports the same schema version; every referenced receipt opens.
6. **Confirm the original is unchanged**: after closing the restored instance, compare the original
   with the backup (for example `diff -r "$VALIDATION_DIR" "$BACKUP_DIR"` on macOS or Linux) and
   expect no differences.
7. **Adopt** the restored directory only after steps 5 and 6 succeed, by starting with
   `--data-dir` pointing at it. Keep the original until the restored copy has been used
   successfully.
