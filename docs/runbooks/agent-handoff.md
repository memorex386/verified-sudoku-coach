# Agent handoff

The repository, not a conversation transcript, is the handoff.

1. Append a checkpoint to the active work package after implementation begins. Record scope
   completed, files/interfaces changed, exact commands and results, decisions, limitations, and
   evidence links without private reasoning.
2. Leave exactly one concrete, unblocked next action. If blocked, name the external decision or
   state change and the last safe verification performed.
3. Regenerate the work-package registry and run `npm run verify`. Keep the worktree and branch until
   its PR is merged; never clean another task's state.
4. For a continuity exercise, give a fresh agent only the repository URL and WP ID. Record whether
   it found the authorities, explained the trust boundary, ran credential-free checks, and chose
   the correct action. Record the checklist outcome, not its reasoning transcript.

`Done` requires linked merged/released evidence and one structural `PASS` evidence row for every
deduplicated command in the package's Validation blocks; prose such as “completed” is not evidence.
