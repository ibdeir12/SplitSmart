# Architecture Decision Record: ADR-001 SplitSmart MVP Architecture

**Date**: 2026-11-05 | **Status**: Accepted | **Decided by**: project owner (Ibrahim Bdeir)

## Context

Two candidate architectures were produced for the SplitSmart MVP:

- **A (base)**: layered Swing desktop monolith over embedded H2, from Spec Kit `/speckit-plan`
  ([plan.md at commit 44b2bbb](https://github.com/ibdeir12/SplitSmart/blob/44b2bbb/specs/001-splitsmart-expense-sharing/plan.md)).
- **B (alternative)**: hexagonal core, REST server with PostgreSQL ledger, Swing as an API
  client ([alternative-architecture.md](alternative-architecture.md)).

Both were reviewed ([A review](reviews/review-architecture-A-base.md),
[B review](reviews/review-architecture-B-alternative.md),
[comparison](reviews/comparison-and-recommendation.md)). Scores: A leads on simplicity (5 vs 2),
deployability (4 vs 2), timeline risk (4 vs 2), and requirement fit (4 vs 3); B leads only on
extensibility to web, Android, and iOS (5 vs 3).

## Decision

**Choose Architecture A** as the MVP architecture, and adopt these ideas from B:

| # | Adopted from B | Why |
|---|----------------|-----|
| D-1 | Ports for persistence, receipts, password hashing, and time (`Clock`), as packages inside one module | Rules and services testable with fakes; a future server can reuse the core unchanged |
| D-2 | Explicit transaction ownership: a status change, its derived records, and its notifications commit together | Closes the notification and receipt consistency gaps (A-D5, A-D6) |
| D-3 | Pending-payment reservation at recording time, **plus** re-validation at confirmation time | Closes A-D1 (two pending payments against one debt) and B-D2 |
| D-4 | Money as a decimal string at every text boundary (forms, files, a future API) | Never a binary float (Principle IV) |
| D-5 | Versioned schema (`schema_version` table, numbered SQL scripts) | Safe upgrades of the local database file |

Rejected from B, with reasons:

- **Client–server for the MVP**: changes the first release into a hosted system and the spec's
  local-MVP assumption (B-D10); web, Android, and iOS stay deferred (FR-044 – FR-046).
- **Ledger table**: its zero-sum check was wrong as written (B-D1), and a second representation of
  money must be reconciled with the first. Balances stay derived from Approved shares and
  Confirmed payments (research R-05).
- **Javalin, Jackson, PostgreSQL, Flyway, Testcontainers**: not needed without a server.

## Consequences

- A's review defects A-D1 – A-D9 are fixed in the consolidated documents.
- A membership-lifecycle rule (A-D2) is recorded as a dated clarification in the spec.
- The class model is reusable by a later server: the deferred clients would add a REST adapter
  around the existing services, which is B's design without its MVP cost.
- Consolidation instructions: [consolidation-instructions.md](consolidation-instructions.md).
