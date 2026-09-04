#!/usr/bin/env node

import fs from "node:fs";
import {
  createAutomationStateFromLedger,
  recordAutomationResult,
  recordLineageAttempts,
  transitionAutomationWithLedger,
} from "./lib/automation-controller.mjs";
import { classifyDependencyPullRequest } from "./lib/dependency-pr-normalizer.mjs";
import { fromRoot, isEntrypoint } from "./lib/project.mjs";

const fixturePath = "scripts/fixtures/automation/dependabot-typescript-7-pr-2.json";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(fromRoot(relativePath), "utf8"));
}

export function runAutomationFixture() {
  const policy = readJson("config/automation-policy.json");
  const fixture = readJson(fixturePath);
  const classification = classifyDependencyPullRequest(
    policy,
    fixture.trustedEvent,
    fixture.evidence,
  );
  const lineageStore = recordLineageAttempts(
    new Map(),
    fixture.workOrder.lineageKey,
    Object.fromEntries(Object.keys(policy.attemptCaps).map((name) => [name, 0])),
  );
  const initialState = createAutomationStateFromLedger(policy, fixture.workOrder, lineageStore);
  const transition = transitionAutomationWithLedger(policy, fixture.workOrder, initialState, {
    schemaVersion: 1,
    type: "classification-evaluated",
    source: "deterministic-controller",
    trustedEvent: fixture.trustedEvent,
    evidence: fixture.evidence,
  }, lineageStore);
  const recorded = recordAutomationResult(new Map(), {
    idempotencyKey: fixture.workOrder.idempotencyKey,
    inputEvidenceSha256: classification.candidate?.inputEvidenceSha256 ??
      "0".repeat(64),
    result: {
      terminalOutcome: transition.state.outcome,
      attempts: transition.state.attempts,
    },
  });
  const replay = recordAutomationResult(recorded.store, {
    idempotencyKey: fixture.workOrder.idempotencyKey,
    inputEvidenceSha256: classification.candidate?.inputEvidenceSha256 ??
      "0".repeat(64),
    result: { terminalOutcome: "must-not-replace-recorded-result" },
  });
  const candidate = classification.candidate;
  const aggregate = {
    schemaVersion: 1,
    fixtureId: fixture.fixtureId,
    fixtureClassification: fixture.classification,
    policyVersion: policy.policyVersion,
    policySha256: policy.policySha256,
    repository: fixture.trustedEvent.repository,
    pullRequestNumber: fixture.trustedEvent.pullRequestNumber,
    baseSha: fixture.trustedEvent.currentBaseSha,
    headSha: fixture.trustedEvent.currentHeadSha,
    dependencyName: candidate?.dependencyName ?? null,
    currentVersion: candidate?.currentVersion ?? null,
    proposedVersion: candidate?.proposedVersion ?? null,
    riskCodes: candidate?.riskCodes ?? [],
    failureFingerprint: candidate?.failureFingerprint ?? null,
    inputEvidenceSha256: candidate?.inputEvidenceSha256 ?? null,
    idempotencyKey: candidate?.idempotencyKey ?? null,
    lineageKey: candidate?.lineageKey ?? null,
    eligible: classification.eligible,
    nextStage: classification.nextStage,
    terminalOutcome: transition.state.outcome,
    modelAttempts:
      transition.state.attempts.cheapAssessments +
      transition.state.attempts.strongEscalations,
    repairAttempts: transition.state.attempts.repairAttempts,
    mutationAttempts:
      transition.state.attempts.patchPublications +
      transition.state.attempts.mergeAttempts,
    replayed: replay.replayed,
    networkCalls: 0,
  };

  const expected = fixture.expected;
  const matchesExpected = aggregate.terminalOutcome === expected.terminalOutcome &&
    aggregate.nextStage === expected.nextStage &&
    aggregate.modelAttempts === expected.modelAttempts &&
    aggregate.repairAttempts === expected.repairAttempts &&
    JSON.stringify(aggregate.riskCodes) === JSON.stringify(expected.riskCodes) &&
    aggregate.replayed === true && aggregate.networkCalls === 0;
  if (!matchesExpected) {
    throw new Error("automation fixture did not produce its reviewed aggregate outcome");
  }
  return aggregate;
}

if (isEntrypoint(import.meta.url)) {
  try {
    console.log(JSON.stringify(runAutomationFixture(), null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Automation fixture failed: ${message}`);
    process.exitCode = 1;
  }
}
