# Evaluation policy

Evaluation determines whether a specific, versioned build may support a narrow claim. It does not
convert a technical pass into evidence of player learning or business impact.

## Evaluation layers

1. **Proof correctness:** examples, near misses, property tests, metamorphic transformations,
   canonical ordering, stale-board cases, and corpus replay for supported techniques.
2. **Contract safety:** exact-key schema, range/size limits, malformed values, and compatibility.
3. **Coaching semantics:** every plan reference exists in the supplied proof; pacing, clue depth,
   answer branches, and factual rendering stay within policy.
4. **Model behavior:** frozen structured responses for deterministic CI plus protected live runs for
   schema acceptance, semantic rejection, refusals, latency, tokens, and estimated cost.
5. **Experience:** accessibility, board continuity, visible failure states, and truthful replay
   labeling.
6. **Reviewer evidence:** preregistered fixed-choice feedback and optional separately consented
   comments, reduced to aggregates with exact denominators.

## Dataset rules

- Public fixtures are independently generated and carry seed, generator/version, puzzle hash,
  uniqueness proof, intended techniques, and license/provenance.
- Transform-related cases stay in one partition to prevent train/eval leakage.
- Frozen, held-out, adversarial, and regression sets are distinct and versioned.
- A failure becomes a minimal synthetic regression case; never copy a production trace into Git.
- Changing a fixture, scorer, threshold, exclusion, or partition increments the suite version and
  states whether prior baselines remain comparable.

## Initial release gates

These are planned thresholds; no pass is claimed until a versioned report exists.

- Zero invalid proof placements or candidate eliminations in the claimed scope.
- Zero unsupported Sudoku claims displayed by the rendering pipeline.
- At least 98% full model-output validator acceptance overall and at least 95% in every technique
  subgroup and every player self-rating subgroup for the protected live suite. The denominator is
  every non-empty model output presented to validation. Acceptance requires both exact-key
  structural decoding and semantic proof/reference/freshness validation; structural acceptance may
  be reported separately but never satisfies this gate.
- Observer latency p95 no greater than four seconds, with a visible safe failure by five seconds.
- Every provider failure mode produces a typed visible pause without content leak or automatic
  fallback; deterministic clue recovery happens only after the player's explicit request.
- Aggregate reports account for every attempted case: pass, reject, refusal, timeout, error, or
  exclusion. Missing cases are never silently removed.
- Reviewer claims use exact n/N and limitations; a small invited cohort is not causal evidence.

Threshold changes require an accepted ADR or explicit amendment before the affected run. Do not
move a threshold after seeing results merely to create a pass.

## Reproducibility record

Every run records source commit, UTC start/end, environment, Node/package-lock hash, fixture and
suite hashes, contract versions, prompt/schema hashes, requested and returned model IDs, requested
and returned service tiers, inference settings, random seed when supported, counts, exclusions,
latency buckets, token totals, estimated cost basis, and evaluator version.

Credential-free replay is deterministic. A live model evaluation is a reproducible protocol, not a
promise that repeated remote sampling yields identical bytes.

## Publication

Machine-readable aggregate JSON is authoritative. Human Markdown is generated from it and states
scope, denominators, failures, limitations, and comparison validity. Raw live requests/responses,
identities, and production boards are not public evidence.
