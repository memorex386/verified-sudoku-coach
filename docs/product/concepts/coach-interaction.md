# Coach interaction concept: a visual story on the board

Design reference recorded 2026-09-05 at the maintainer's request. The maintainer positively
reviewed the interactive direction and asked that it be retained for future agents.
This captures a preferred experience, not an accepted implementation contract, completed work
package, measured learning result, or permission to expose Coach in ordinary games.

## Open the concept

Open [coach-walkthrough.html](coach-walkthrough.html) from a local checkout in a modern browser.
It is a self-contained, offline document: no build, account, provider key, server, external font,
image library, or conversation host is required. GitHub displays its source; download or clone to
interact with it. Choose **3 · Explore** for the latest visual-storytelling iteration, or
**Play walkthrough** for the full sequence. **Try a mistake** demonstrates a gentle invitation.

The saved document is the durable source of the concept. Future agents can also display its
body content using their own visualization tool; do not depend on the original conversation's
file location or host-specific controls. Update this reference and the HTML together.

## Preferred interaction

| Moment | Board and coach behavior |
| --- | --- |
| Playing | A small coach entry remains available; the board stays central. |
| Asking | Explicit help shows a brief checking state, then opens a bottom sheet with one nudge. |
| Exploring | The explanation appears gradually. Each named digit highlights its specific given clue, synchronized with the text. Previously mentioned clues retain a softer highlight. |
| Ruling digits out | A separate nine-digit teaching strip gains a diagonal slash for each ruled-out digit. Given clues on the board remain intact. |
| Choosing | Retain the example's **5**, **9**, and **A smaller hint** buttons. The player can answer, reconsider, or request less revealing guidance. |
| Progress | A successful response acknowledges the reasoning; **Keep playing** collapses the coach. |
| Conflict | A soft invitation offers help. On request, highlight the conflicting cells and offer undo plus a nudge. |

The goal is a short visual story, connecting words to exact cells rather than presenting a wall of
text. The slash belongs to the teaching strip, not the source clue: crossing out a given would
suggest deleting a valid clue. The strip is explanatory UI, not player notes or a replacement for
the immutable logical candidate state.

## Step 3 reference sequence

The selected cell is row 5, column 5. Coordinates below are one-based.

| Narration order | Digit | Source clue | Reason |
| --- | --- | --- | --- |
| 1 | 1 | r5c9 | Same row |
| 2 | 3 | r5c6 | Same row |
| 3 | 4 | r5c1 | Same row |
| 4 | 8 | r5c4 | Same row |
| 5 | 2 | r6c5 | Same column |
| 6 | 6 | r4c5 | Same column |
| 7 | 7 | r1c5 | Same column |
| 8 | 9 | r2c5 | Same column |

The script types at roughly 27 ms per character, dwelling about 650 ms at each named digit.
These are prototype timings, not accepted latency or accessibility thresholds. Keep pause,
continue, show-all, and replay available; reduced-motion preference shows the completed explanation
immediately. Navigating away cancels pending narration. The full walkthrough allows extra time
for this scene. Neither a timer nor a model should force a player to accept a move.

## Implementation handoff and boundaries

Read the [charter](../charter.md), [proof policy](../../architecture/proof-policy.md),
[WP-2026-004](../../work-packages/WP-2026-004-coach-application.md), and
[WP-2026-008](../../work-packages/WP-2026-008-private-angular-integration.md) before implementation.
Those authorities take precedence. The accepted [local tutor amendment](../plans/VSC-PLAN-2026-09-05.3.md)
now permits the minimal local interaction within WP-2026-003. Both later packages remain Draft;
the concept itself does not authorize broader implementation or private integration.

- Production narration and highlights must derive from validated, independently verified fact
  references for the current immutable state. Never parse untrusted streamed model prose to
  decide which clue to highlight or candidate to eliminate. Animate already validated content.
- Discard stale lessons and cancel their animations when the board revision changes. Preserve
  logical eliminations through proof-path replay; player notes never determine candidates.
- Keep scheduling and animation in presentation adapters. The core remains provider/framework
  neutral, and detectors/verifiers are not implemented by this mockup.
- The mockup's answer button directly inserts 5 for demonstration convenience. It does not settle
  the production answer-versus-placement contract: the real flow must retain explicit player
  placement/authorization and may not give AI permission to mutate the board.
- The mockup's ordinary-game chrome, Easy label, timer, and Journey/Friends labels are illustrative.
  Actual v1 is an isolated Coach session with no normal statistics, rank, rewards, or native
  exposure. This is not a pixel-accurate private-product screenshot or its source code.
- Real busy, paused, stale, failure, retry, and uncoached states still need their accepted tests.
  The brief scripted checking state is not evidence of model latency or a live provider call.
- Before shipping, validate keyboard focus, screen-reader announcements (no character-by-character
  chatter), contrast, touch targets, reduced motion, interruptions, and board visibility on actual
  phone viewports. Prototype browser checks are not an accessibility audit.

## Provenance and limits

The interface code and scripted dialogue were authored for this design exercise with AI assistance;
no private app source, account, production trace, puzzle corpus, credentials, screenshots, or chat
transcript was copied. The board is a model-authored illustrative example; independent generation,
uniqueness, and private collision clearance have not been established. It is not an approved
fixture, evaluation dataset, public showcase, or proof-engine acceptance artifact. Do not promote
it into those roles; use the governed generated-fixture pipeline for implementation.

The portable document uses system typography, text symbols, and original CSS/JavaScript under the
repository license. It intentionally omits the conversation host's icon and design-control helpers.
No new dependencies, hosted runtime, provider behavior, model prompts, or data collection are added.

## Review checklist

1. Open the HTML offline and select **3 · Explore**. Check that each digit highlights the table's
   exact clue and receives one slash in the teaching strip; only 5 remains uncrossed at completion.
2. Pause midway, continue, use show-all, then replay. Switch scenes midway and confirm that old
   narration does not overwrite the new scene.
3. Try 9, retry with 5, and return to play. Try a conflicting move, then undo and request a nudge.
4. Check light/dark appearance and narrow widths, plus immediate narration with reduced motion.
5. Treat changed content as a design revision. Record its intent here, retain truthful simulated
   labeling, and run the repository's normal validation before another review PR.
