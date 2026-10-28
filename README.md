# SplitSmart

CIS 285 Software Engineering Tools, Lab 6: UML Modeling, Use Case, Requirements.

Requirements for SplitSmart, an expense-sharing application, developed with the GitHub Spec Kit
CLI (`specify`, Copilot integration). This repository contains requirements only; no application
code has been written yet.

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
