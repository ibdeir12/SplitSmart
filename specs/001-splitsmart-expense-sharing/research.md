# Research: SplitSmart Expense Sharing

**Phase 0 output of `/speckit-plan`** | **Date**: 2026-11-05 | **Plan**: [plan.md](plan.md)

The Technical Context in the plan had no `NEEDS CLARIFICATION` items left after Lab 6's
`/speckit-clarify` session, because the constitution fixed the language, build tool, UI toolkit,
and test framework. The decisions below cover the remaining open technical choices.

## R-01 Architecture style

- **Decision**: layered monolith (ui → service → domain, persistence behind repository
  interfaces) in one Maven module, MVC in the Swing layer.
- **Rationale**: smallest structure that satisfies Principle III (GUI separated from business
  logic) and keeps the domain testable without a GUI. One module keeps the build and the course
  submission simple.
- **Alternatives considered**: multi-module Maven (core / desktop) — cleaner boundary but more
  build configuration for one client; client–server — needed only when the deferred web and
  mobile clients arrive (FR-044 – FR-046).

## R-02 Persistence

- **Decision**: embedded H2 2.x database in file mode, accessed through plain JDBC behind
  repository interfaces; schema in `src/main/resources/db/schema.sql`.
- **Rationale**: NFR-006 needs data to survive restarts; the data is relational (groups ↔
  members, expenses ↔ shares ↔ approvals); transactions keep an expense and its shares
  consistent; `DECIMAL(12,2)` maps to `BigDecimal` exactly. H2 is a single JAR with no install
  step, so the desktop app stays self-contained. This is the one library added beyond the
  constitution's list.
- **Alternatives considered**: Java serialization or JSON files (no transactions, whole-file
  rewrites, harder queries for reports); SQLite via JDBC driver (native library per OS);
  JPA/Hibernate (large dependency, hides SQL the course wants visible).

## R-03 Password storage

- **Decision**: PBKDF2WithHmacSHA256 from the JDK, 210,000 iterations, 16-byte random salt per
  user, stored as `iterations:salt:hash` (Base64).
- **Rationale**: satisfies FR-005 with no extra dependency; iteration count follows current OWASP
  guidance for PBKDF2-SHA256.
- **Alternatives considered**: BCrypt/Argon2 libraries (extra dependency); plain SHA-256 (too fast,
  unsalted — rejected).

## R-04 Money representation and rounding

- **Decision**: `Money` value object wrapping `BigDecimal` with scale 2; amounts parsed with
  `new BigDecimal(String)`, never from `double`. `SplitCalculator` computes each share with
  `RoundingMode.DOWN` to the cent, then hands out the remainder one cent at a time in listed
  participant order (FR-014, FR-015).
- **Rationale**: Principle IV; the clarified rounding rule (100.00 / 3 = 33.34, 33.33, 33.33).
- **Alternatives considered**: storing cents as `long` (exact, but the constitution names
  `BigDecimal`); banker's rounding (does not guarantee the sum).

## R-05 Balances: stored or derived

- **Decision**: balances are derived on read from Approved expense shares and Confirmed payments;
  nothing stores a running balance.
- **Rationale**: the spec says a balance is "computed ..., never entered directly"; derivation
  cannot drift out of sync. At NFR-004 scale (1,000 expenses) a full fold is milliseconds.
- **Alternatives considered**: a stored balance table updated on approval (faster reads, but two
  sources of truth that can disagree).

## R-06 Receipt images

- **Decision**: JPEG or PNG only, at most 5 MB; the file is copied to
  `~/.splitsmart/receipts/<uuid>.<ext>` and the expense stores the reference; the image is
  checked by reading it with `ImageIO` before it is accepted.
- **Rationale**: the spec's assumption defers the size limit to planning; 5 MB covers phone
  photos. Files outside the database keep the database small.
- **Alternatives considered**: BLOB column (bloats the DB file and backups).

## R-07 Notifications in a single-machine MVP

- **Decision**: an in-app notification table; unread notifications are loaded at sign-in and
  after each action.
- **Rationale**: FR-021 – FR-023 are in-app only; one machine means no cross-device delivery is
  needed. FR-024 (push/email) stays deferred.

## R-08 Testing approach

- **Decision**: JUnit 5; rules tests are pure (no DB); service tests run against `jdbc:h2:mem:`
  with the real schema; one architecture test enforces the layer rule; test method names start
  with the requirement ID (`FR014_equalSplitGivesLeftoverCentsInListedOrder`).
- **Rationale**: Principle V and NFR-007 traceability.

## R-09 Swing structure

- **Decision**: one `MainFrame` with a `CardLayout` (Login, Dashboard), dialogs for forms; each
  panel has a controller that calls services and shows `JOptionPane` messages for
  `ValidationException`. Long operations (none expected at MVP scale) would use `SwingWorker`.
- **Rationale**: keeps views passive and the logic out of Swing (Principle III).
