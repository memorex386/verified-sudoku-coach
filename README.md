# Verified Sudoku Coach

Verified Sudoku Coach is an open engineering project exploring a specific AI product question:
can a language model make Sudoku coaching feel adaptive while deterministic software remains the
sole authority for every Sudoku fact?

> **Authoritative project status lives only in the generated
> [work-package registry](docs/work-packages/). Feature behavior, model quality, player outcomes,
> latency, cost, and all other results are Planned / unmeasured.** The current source entrypoints are
> foundation boundaries; no production coach or live hosted AI experience exists here.

## The 90-second path

1. Read the [product charter](docs/product/charter.md) for the problem and honest claim boundary.
2. See the [system design](docs/architecture/system.md) and
   [trust boundaries](docs/architecture/trust-boundaries.md).
3. Inspect the [architecture decisions](docs/decisions/) behind deterministic truth, bounded model
   output, privacy, and public/private separation.
4. Follow the [work package registry](docs/work-packages/) to see what is complete, active, or
   still planned.
5. Review the [acceptance catalog](docs/acceptance/catalog.md) and
   [evaluation policy](docs/evaluation/policy.md) for the evidence required before any claim ships.
6. Read [how AI assists development](docs/provenance/ai-assisted-development.md) without publishing
   private reasoning or noisy transcripts.
7. See the [interoperability design](docs/architecture/interoperability.md) and
   [bounded dependency steward](docs/playbooks/dependency-pr-steward.md) for the portable engineering
   control plane and finite automation policy.

## Intended architecture

```text
verified board state
        |
        v
deterministic proof engine -----> verified facts
                                      |
                                      v
                               bounded AI plan
                                      |
                                      v
                         schema + semantic validation
                                      |
                                      v
                         deterministic factual renderer
```

The model may eventually choose when and how to teach a fact. It may not invent a candidate,
elimination, placement, proof, score, or learner outcome. Invalid, stale, unavailable, or
over-budget model output must fail closed.

## Evidence status

| Claim | Status | Required evidence |
| --- | --- | --- |
| Supported Sudoku deductions are mechanically correct | Planned / unmeasured | Proof, property, metamorphic, and corpus tests |
| Model plans remain within verified facts | Planned / unmeasured | Frozen and live structured-output evals |
| Coaching helps reviewers reason | Planned / unmeasured | Preregistered, aggregate reviewer feedback |
| Runtime meets latency and cost budgets | Planned / unmeasured | Versioned aggregate operational report |
| A public replay is accessible and reproducible | Planned / unmeasured | Release manifest, accessibility review, and artifact hashes |

Reports will retain exact denominators, failures, exclusions, versions, and limitations. A passing
test will not be represented as proof of player learning or business impact.

## Repository layout

- `packages/domain`: immutable Sudoku and coaching values with no dependencies.
- `packages/proof-engine`: deterministic proof generation and verification; depends only on domain.
- `packages/coach-core`: pure state transitions, provider ports, teaching policy, and rendering.
- `packages/contracts`: strict, versioned wire and model schemas with no domain imports.
- `packages/boundary-codecs`: anti-corruption mapping between untrusted DTOs and trusted values.
- `packages/adapter-openai`: first Node-only provider adapter; product ports remain provider-neutral.
- `packages/testing`: generated fixtures, fakes, conformance tests, and adversarial responses.
- `apps/replay-web`: static React replay with no provider dependency.
- `apps/local-gateway`: local Node proxy for explicit BYOK development.
- `tools/eval-cli`: frozen, adversarial, comparative, and guarded live evaluation tooling.
- `docs`: product authority, architecture, decisions, work packages, evaluation, provenance, and
  operating procedures.

These directories currently contain boundaries only, not feature implementations.

Canonical repository instructions and skills are open-format, with checked thin adapters for the
Claude and Gemini discovery formats. Product inference uses registered capability/data-handling profiles;
engineering automation uses bounded work orders and separate mutation brokers. Structural
portability is tested, while compatibility or quality claims for a named agent/provider require
their own conformance and measured evidence.

## Local foundation checks

Use Node 22 and npm 10:

```powershell
npm ci
npm run doctor
npm run eval:replay
npm run verify
```

All pull-request checks are credential-free. A future live-provider evaluation will be explicit,
protected, and aggregate-only; it will never run for an untrusted pull request.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and
[SECURITY.md](SECURITY.md) before changing the project. The code is licensed under the
[Apache License 2.0](LICENSE).
