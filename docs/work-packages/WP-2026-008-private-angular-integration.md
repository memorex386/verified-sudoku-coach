---
id: WP-2026-008
title: Private Angular integration
status: Draft
depends_on: WP-2026-007
owner: Maintainer
base_branch: main
accepted_plan: VSC-PLAN-2026-09-04.2
data_classification: Public metadata only
acceptance: VSC-ARCH-006, VSC-UX-004
updated: 2026-09-04
---

# Private Angular integration

## Goal

Add an isolated Coach vertical slice, facade, anti-corruption mapping, session lifecycle seam,
guided teaching UI, self-rating, TTS, pause/recovery, recap/survey, and bounded analytics. Add the
public Coach information page whose replay link can activate only after separately authorized
publication and URL/hash verification.

## User value

Reviewers receive a calm, accessible coaching experience while ordinary Sudoku World progress and
economy behavior remain untouched.

## Non-goals

No AI orchestration inside `GameSessionService`, competing hint logic, normal-game persistence,
score/rank/reward/ad/Journey/race/challenge effects, microphone, deployment, or public private-source
copy. This package does not automatically activate or publish the replay link.

## Governing ADRs

Public ADR-0004 and ADR-0005; Sudoku World ADR-0015; private Coach architecture and change matrix;
accessibility, privacy, lifecycle, and public-artifact compatibility contracts.

## Allowed edit surface

The private Sudoku World work package owns dedicated Coach routes/components/facade/store,
interaction/lifecycle seams, public-value mappers, verified hint compatibility adapter, accessibility
and speech behavior, analytics vocabulary, the public information page and gated replay link, tests,
and private docs. This file receives metadata only.

## Affected interfaces

`CoachFacade`, board interaction/lifecycle port, mutable-game to immutable-public mapper, Coach HTTP
client, `HintEngine` compatibility adapter, dedicated session storage/routes, TTS/accessibility UI,
recap/survey, allowlisted analytics, and the information-page replay-link configuration.

## Architecture and privacy invariants

Angular owns presentation, optimistic input, accessibility, speech, and local UI state; it cannot
create proof facts, call a model provider, or authorize access. Coach sessions never invoke normal completion
or persistence. TTS is off by default. Paused coaching leaves the board playable and presents Retry,
uncoached continuation, and explicit deterministic clue choices. The hosted web client supplies the
server-issued web capability; Android/iOS bundles contain no Coach entry route, while the backend
remains authoritative if a client attempts to forge one.

## Acceptance criteria

Characterization preserves existing hint analytics while delegating factual authority to the public
proof engine. Dedicated Coach state survives expected lifecycle transitions without contaminating
normal games. Keyboard, touch, responsive, screen-reader, TTS-default, cadence, pause, and 8–15
canonical replay behavior pass. Native bundle inspection and Android/iOS route tests prove Coach is
not exposed, and private endpoint tests prove native App Check identities are denied. The
information page may ship without an active replay link;
enabling it requires explicit publication authorization plus verification of the public URL and
release hash.

## Validation

From the public repository root, run:

```powershell
npm ci
npm run pack:smoke
npm run release:verify
npm run verify
```

From private Sudoku World `web`, run:

```powershell
npm ci
npx ng build --configuration production
npx ng test --watch=false --browsers=ChromeHeadless
npx ng lint
```

During implementation, make the planned Coach-specific checks below executable in the private
repository and run them with the existing production-bundle and analytics checks before `Done`:

```powershell
node scripts/ops/verify-coach-release-parity.mjs
node scripts/ops/verify-coach-browser-boundary.mjs web/dist/sudoku/browser
node --test scripts/ops/verify-coach-platform-gates.test.mjs
node --test scripts/ops/verify-web-bundle.test.mjs
node scripts/ops/verify-web-bundle.mjs web/dist/sudoku/browser
node --test scripts/ops/verify-analytics-contract.test.mjs
node scripts/ops/verify-analytics-contract.mjs
node scripts/ops/verify-engineering-docs.mjs
git diff --check
```

From private Sudoku World `firebase`, extend the existing hosting test with the Coach information
route and run:

```powershell
npx --yes firebase-tools@15.28.1 emulators:exec --only hosting "node --test ../scripts/ops/integration/hosting-routing.test.mjs"
```

Together the suites cover mapper/contract negatives, facade/reducer integration, normal-game
characterization/isolation, lifecycle, accessibility, speech, analytics, pause recovery, native
route denial, and provider/key exclusion.

## Delivery evidence

No implementation evidence exists because this package has not started; only safe PR and version
compatibility identifiers will be referenced publicly.

## Known limitations and blockers

WP-2026-007 is incomplete. Native shells host the web bundle but Coach v1 remains web-only; store releases
and normal-game feature changes are outside this package.

## Next action

- Specify the CoachFacade and game-lifecycle seam contract against current private characterization tests.

## Checkpoints

Implementation has not begun; append dated public-safe checkpoints only after the package becomes In progress.
