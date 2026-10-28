# SplitSmart Constitution

This constitution governs how SplitSmart is specified, designed, built, and reviewed. It
separates two kinds of statements and every downstream artifact MUST keep them separate:

- **Customer requirements** come only from `UserRequirement.md` (the original SplitSmart
  customer request). They describe WHAT the customer wants: user accounts, group management,
  expense creation (amount, date, description, equal or percentage split, optional receipt
  image, involved users), notifications, an approval workflow, balance tracking, payment
  tracking, reporting, and web-first delivery with Android and iOS apps.
- **Implementation decisions** are the team's choices about HOW to build a course-scoped
  minimum viable product (MVP): Java 21, Maven, Java Swing, JUnit 5, PlantUML, and the design
  rules below. They are not customer requirements and MUST NOT be presented as such.

Where an implementation decision narrows a customer requirement (for example, a desktop Java
Swing MVP instead of web, Android, and iOS clients), the narrowing MUST be stated explicitly and
the original customer requirement MUST stay in the requirements inventory.

## Core Principles

### I. Customer Requirements Are the Source of Truth

- `UserRequirement.md` is the authoritative, unmodified customer request. No person or AI tool
  may edit it; changes in customer intent are recorded as new, dated clarifications in the
  feature specification, never as edits to that file.
- Every specified requirement MUST trace back to a feature in `UserRequirement.md` or to a
  recorded clarification. Requirements with no customer source MUST be labelled as
  implementation decisions or assumptions.
- Customer features that the MVP does not deliver MUST remain in the requirements inventory,
  marked as deferred, so scope reductions are visible rather than silent.

Rationale: the course deliverable is judged against the customer's request; silent scope loss
or invented features are the most common requirements defects.

### II. Requirement Traceability

- Every functional requirement carries a stable ID (`FR-001`, `FR-002`, ...), every
  non-functional requirement a stable ID (`NFR-001`, ...), and every success criterion a stable
  ID (`SC-001`, ...). IDs are never reused or renumbered once published; retired requirements
  are marked as withdrawn.
- Each requirement MUST name its customer source (the `UserRequirement.md` feature it comes
  from) and be linked to at least one acceptance scenario.
- Design artifacts (PlantUML diagrams), source classes, and JUnit tests MUST reference the
  requirement IDs they realize or verify, so any requirement can be followed from customer
  request to test.

Rationale: traceability is what makes a specification reviewable and testable, and it is the
core skill this project exercises.

### III. Object-Oriented Design With Separated GUI and Business Logic

- The system MUST be organized as an object-oriented domain model (users, groups, expenses,
  splits, approvals, payments, balances) with clear responsibilities and encapsulated state.
- Business logic (split calculation, approval rules, balance and settlement computation,
  report aggregation) MUST live in plain Java classes with no dependency on Java Swing or any
  other GUI package.
- The Java Swing layer is a thin presentation layer: it collects input, calls the business
  layer, and renders results. It MUST NOT compute balances, splits, or approval outcomes itself.
- Business logic MUST be testable with JUnit 5 without starting a GUI.

Rationale: the customer ultimately wants web, Android, and iOS clients; a GUI-independent core
keeps the MVP's logic reusable when other front ends are built, and keeps it testable.

### IV. Exact Money Arithmetic With BigDecimal

- All monetary amounts, shares, balances, and payments MUST be represented with
  `java.math.BigDecimal`. `float` and `double` MUST NOT be used for money anywhere, including
  intermediate calculations and tests.
- Every division or percentage calculation MUST state its scale and `RoundingMode` explicitly;
  the rounding policy (including how leftover cents are assigned) is defined in the
  specification and applied in one place in the business layer.
- The shares of an expense MUST always sum exactly to the expense amount, and the sum of all
  balances in a group MUST always be exactly zero. These invariants MUST be covered by tests.

Rationale: binary floating point cannot represent cents exactly; expense-sharing software that
loses or invents a cent destroys user trust.

### V. Test-Verified Behavior With JUnit 5

- Every functional requirement in the MVP subset MUST have at least one JUnit 5 test that
  verifies its acceptance criteria, named or annotated with the requirement ID.
- Business-rule edge cases named in the specification (invalid amounts, percentages that do not
  total 100%, rounding remainders, settlement of balances) MUST each have a test.
- The Maven build (`mvn verify`) MUST pass with all tests green before work is considered
  complete.

Rationale: acceptance criteria are only meaningful when they are executed.

### VI. Human Review of AI Output

- AI tools (including GitHub Copilot and Spec Kit agents) may draft specifications, diagrams,
  code, and tests, but every AI-generated artifact MUST be reviewed by a human team member
  before it is committed or treated as accepted.
- AI tools MUST NOT silently invent answers to open customer questions. Ambiguities are
  recorded as open questions or clarifications and resolved by a human (and, where needed, the
  customer) before they become requirements.
- The reviewer is responsible for checking AI output against `UserRequirement.md`, this
  constitution, and the specification, and for correcting errors rather than accepting them.

Rationale: AI tools produce plausible but unverified content; accountability for correctness
stays with people.

## Technology and Design Constraints (Implementation Decisions)

These are implementation decisions for the course MVP, not customer requirements:

- **Language and runtime**: Java 21 (LTS).
- **Build tool**: Maven, with a standard `src/main/java` and `src/test/java` layout; the build
  MUST run from a clean checkout with `mvn verify`.
- **User interface**: Java Swing desktop application for the MVP. The customer's web, Android,
  and iOS clients are deferred and MUST remain listed as deferred customer requirements.
- **Testing**: JUnit 5 (Jupiter).
- **Modeling**: PlantUML for use case, class, sequence, and activity diagrams; diagram sources
  (`.puml`) are versioned alongside the code and kept consistent with it.
- **Money**: `BigDecimal` only (Principle IV).
- **Architecture**: GUI and business logic separated (Principle III); dependencies point from the
  GUI layer to the business layer, never the reverse.
- New libraries or frameworks beyond this list require a documented justification in the plan.

## Development Workflow and Quality Gates

1. **Specify**: write or update the feature specification from `UserRequirement.md`, with
   requirement IDs, acceptance criteria, and open questions.
2. **Clarify**: resolve open questions with a human decision; record each decision with its date
   in the specification. Do not proceed to design with unresolved scope or money-rule questions.
3. **Plan and model**: produce the implementation plan and PlantUML models; check them against
   this constitution.
4. **Implement and test**: write business logic and JUnit 5 tests first-class; keep the Swing
   layer thin.
5. **Review**: a human reviews every change (including AI-generated content) against the
   constitution, the specification, and `UserRequirement.md` before it is committed.

Quality gates before a change is accepted:

- `UserRequirement.md` is unchanged.
- Every new or changed requirement has an ID, a customer source, and acceptance criteria.
- No `float`/`double` money; all rounding explicit.
- No business logic in Swing classes.
- `mvn verify` passes.

## Governance

- This constitution supersedes other project practices. When a practice conflicts with it, the
  constitution wins until it is amended.
- **Amendments**: proposed in writing with the reason, reviewed and approved by a human team
  member, and recorded with an updated version and amendment date. Dependent artifacts (spec,
  plan, diagrams) MUST be checked for consistency after an amendment.
- **Versioning**: semantic versioning. MAJOR for removing or redefining a principle; MINOR for
  adding a principle or section or materially expanding guidance; PATCH for clarifications and
  wording fixes.
- **Compliance review**: every specification, plan, and code review MUST confirm compliance with
  the principles above; any justified exception MUST be documented in the plan's complexity or
  exceptions section.

**Version**: 1.0.0 | **Ratified**: 2026-10-28 | **Last Amended**: 2026-10-28
