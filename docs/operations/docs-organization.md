# Docs Organization Policy

## Goal

Keep Markdown centralized under `docs/` so the root of the repo stays readable and code navigation stays clean.

## Placement Rules

- Put product specs and feature requirement docs in `docs/product/`.
- Put architecture and implementation designs in `docs/architecture/`.
- Put research, market notes, and external analysis in `docs/research/`.
- Put workflow, repo hygiene, and operational guides in `docs/operations/`.

## Naming Rules

- Use kebab-case file names.
- Prefer descriptive names over generic names like `notes.md` or `ideas.md`.
- Version docs in content headings when needed, not in the filename unless multiple active versions must coexist.

## Root-Level Exceptions

- Keep machine-read instruction files such as `CLAUDE.md` at the repo root.
- Do not add new ad hoc product or research Markdown files at the root.
- If a new root-level Markdown file is required by tooling, add a short link to it from `docs/README.md`.

## Maintenance

- When new docs are added, update `docs/README.md`.
- When docs become obsolete, either archive them under the correct `docs/` section or delete them in the same change.
- If a doc is referenced from code comments or onboarding material, update those references when it moves.
