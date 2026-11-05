# SplitSmart

CIS 285 Software Engineering Tools.

SplitSmart is an expense-sharing application for friends, roommates, family members, and
coworkers. This repository holds its requirements (Lab 6) and its architecture and design
(Lab 7), developed with the GitHub Spec Kit CLI (`specify`). No application code has been
written yet.

## Lab 7: Architecture and Design

| Step | What was done | Deliverable |
|------|---------------|-------------|
| 1. Base architecture | Spec Kit `/speckit-plan` on the Lab 6 specification ([commit 44b2bbb](https://github.com/ibdeir12/SplitSmart/commit/44b2bbb)) | Architecture A: layered Swing desktop monolith over embedded H2. [`plan.md` as generated](https://github.com/ibdeir12/SplitSmart/blob/44b2bbb/specs/001-splitsmart-expense-sharing/plan.md), with `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| 2. Alternative architecture | Independent alternative design ([commit d898040](https://github.com/ibdeir12/SplitSmart/commit/d898040)) | Architecture B: hexagonal core, REST server, PostgreSQL ledger. [`docs/architecture/alternative-architecture.md`](docs/architecture/alternative-architecture.md) |
| 3. Review of both | Requirement coverage, constitution check, defects, scores ([commit 87e947f](https://github.com/ibdeir12/SplitSmart/commit/87e947f)) | [Review of A](docs/architecture/reviews/review-architecture-A-base.md), [Review of B](docs/architecture/reviews/review-architecture-B-alternative.md), [Comparison and recommendation](docs/architecture/reviews/comparison-and-recommendation.md) |
| 4. Decision | Architecture A chosen, five ideas adopted from B ([commit 2961a7b](https://github.com/ibdeir12/SplitSmart/commit/2961a7b)) | [`docs/architecture/decision.md`](docs/architecture/decision.md) (ADR-001) |
| 5. Consolidation instructions | Ordered instructions to update requirements, architecture, design | [`docs/architecture/consolidation-instructions.md`](docs/architecture/consolidation-instructions.md) |
| 6. Consolidated documents | Instructions applied | Updated requirements: [`spec.md`](specs/001-splitsmart-expense-sharing/spec.md). Updated architecture: [`plan.md`](specs/001-splitsmart-expense-sharing/plan.md), [`research.md`](specs/001-splitsmart-expense-sharing/research.md), [`quickstart.md`](specs/001-splitsmart-expense-sharing/quickstart.md). Updated design: [`data-model.md`](specs/001-splitsmart-expense-sharing/data-model.md), [`contracts/`](specs/001-splitsmart-expense-sharing/contracts/), [`docs/design/design.md`](docs/design/design.md) |

### UML diagrams (PlantUML sources and rendered PNGs in [`docs/design/diagrams/`](docs/design/diagrams/))

| Diagram | Source |
|---------|--------|
| Class diagram: domain model | [`class-domain.puml`](docs/design/diagrams/class-domain.puml) |
| Class diagram: services and ports | [`class-services-ports.puml`](docs/design/diagrams/class-services-ports.puml) |
| Component diagram | [`component.puml`](docs/design/diagrams/component.puml) |
| Deployment diagram | [`deployment.puml`](docs/design/diagrams/deployment.puml) |
| Activity: record an expense | [`activity-record-expense.puml`](docs/design/diagrams/activity-record-expense.puml) |
| Activity: approve or reject an expense | [`activity-approve-expense.puml`](docs/design/diagrams/activity-approve-expense.puml) |
| Activity: record and confirm a payment | [`activity-record-payment.puml`](docs/design/diagrams/activity-record-payment.puml) |
| Activity: remove a member or leave a group | [`activity-remove-member.puml`](docs/design/diagrams/activity-remove-member.puml) |
| Sequence: approve an expense | [`sequence-approve-expense.puml`](docs/design/diagrams/sequence-approve-expense.puml) |

Render: `java -jar plantuml.jar -tpng docs/design/diagrams/*.puml` (PlantUML 1.2025.4, Graphviz).

## Lab 6: Requirements

| Step | Command | Deliverable |
|------|---------|-------------|
| Setup | `uv tool install specify-cli`, `specify init . --integration copilot` | Spec Kit project |
| Customer input | n/a | [`UserRequirement.md`](UserRequirement.md): the original customer request (never edited) |
| Step 1 | `/speckit-constitution` | [`.specify/memory/constitution.md`](.specify/memory/constitution.md): engineering principles |
| Step 2 | `/speckit-specify` | [`specs/001-splitsmart-expense-sharing/spec.md`](specs/001-splitsmart-expense-sharing/spec.md): feature specification |
| Step 2 | `/speckit-specify` | [`specs/001-splitsmart-expense-sharing/checklists/requirements.md`](specs/001-splitsmart-expense-sharing/checklists/requirements.md): spec quality checklist |
| Step 3 | `/speckit-clarify` | The `Clarifications` section of the spec: 9 decisions, each confirmed by a person |

The specification keeps every customer feature in its Requirements Inventory (CR-01 to CR-10) and
tags each functional requirement either **[MVP]** (the Java Swing desktop subset) or **[Deferred]**
(for example the web, Android, and iOS clients).
