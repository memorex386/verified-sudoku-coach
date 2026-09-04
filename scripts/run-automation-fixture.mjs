#!/usr/bin/env node

import fs from "node:fs";
import {
  recordLineageAttempts,
  startDependencyAutomationWithStores,
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
  const event = {
    schemaVersion: 1,
    type: "classification-evaluated",
    source: "deterministic-controller",
    trustedEvent: fixture.trustedEvent,
    evidence: fixture.evidence,
  };
  const first = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    lineageStore,
    new Map(),
  );
  const candidate = classification.candidate;
  if (candidate === null) {
    throw new Error("automation fixture did not produce a normalized replay identity");
  }
  const replay = startDependencyAutomationWithStores(
    policy,
    fixture.workOrder,
    event,
    first.lineageStore,
    first.resultStore,
  );
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
    terminalOutcome: first.result?.terminalOutcome ?? null,
    modelAttempts:
      first.result?.attempts.cheapAssessments +
      first.result?.attempts.strongEscalations,
    repairAttempts: first.result?.attempts.repairAttempts ?? null,
    mutationAttempts:
      first.result?.attempts.patchPublications +
      first.result?.attempts.mergeAttempts,
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
