---
id: ADR-0002
status: Accepted
date: 2026-09-03
---

# Enforce inward package dependencies

## Context

Provider, browser, Firebase, and product-specific types can easily leak into core logic, making
tests fragile and a public/private split dishonest.

## Decision

Use explicit domain, proof-engine, coach-core, contracts, boundary-codecs, provider-adapter,
testing, replay, gateway, and eval workspaces. Domain has no dependencies; proof engine depends
only on domain; wire contracts never import domain. Codecs are the anti-corruption layer where
untrusted DTOs become trusted values.
Dependencies follow the graph in `config/architecture.json`: core packages have no outward
dependency; applications and adapters compose them. CI compares manifests and source imports with
that graph and rejects cycles. Exceptions require an accepted ADR and policy update first.

## Rejected alternatives

- A single package with folder conventions but no automated boundary.
- A framework-owned domain model shared through UI components.
- Copying core behavior into each host to avoid package versioning.

## Consequences

There is modest workspace overhead and explicit mapping at boundaries. In exchange, deterministic
logic can run without network/framework dependencies, the static browser cannot reach live
inference, and the private host can upgrade against a documented public contract.

## Verification

`VSC-ARCH-001`, `VSC-ARCH-002`, and `npm run architecture:check` on every pull request.
