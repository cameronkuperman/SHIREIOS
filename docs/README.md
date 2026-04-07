# Docs Index

This repository keeps human-facing project docs under `docs/` so the repo root stays reserved for code, tool entrypoints, and agent instruction files.

## Structure

- `docs/product/`: product requirements, feature sets, and roadmap-facing specs.
- `docs/architecture/`: implementation designs, system diagrams, and technical decisions.
- `docs/research/`: research notes, market analysis, and external synthesis.
- `docs/operations/`: repo/process conventions and operational runbooks.

## Current Docs

- [Shire Product Requirements](product/shire-product-requirements.md)
- [Restaurant Ops Data Pipeline](product/restaurant-ops-data-pipeline.md)
- [Realtime Floor State](architecture/realtime-floor-state.md)
- [Host Backend Contract](architecture/host-backend-contract.md)
- [Docs Organization Policy](operations/docs-organization.md)
- [Host Backend Readiness Checklist](operations/host-backend-readiness-checklist.md)
- [Mobile Supabase Setup](operations/mobile-supabase-setup.md)
- [Restaurant Manager Research](research/restaurant-manager-research.md)

## Root-Level Exceptions

- [CLAUDE.md](../CLAUDE.md) stays at the repo root because it is a tool-discovered instruction file.
- Workspace-level `AGENTS.md` instructions may exist outside this repo and should not be copied into `docs/`.
