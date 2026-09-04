import {
  automationIdentityKey,
  automationAttemptNames,
  automationTerminalOutcomes,
  canonicalSha256,
  checkedInAutomationPolicyRegistry,
  dependencyPullRequestIdempotencyKey,
  exactObjectErrors,
  fullLowercaseSha1,
  fullLowercaseSha256,
  githubRepository,
  isExactObject,
  validateAutomationPolicyAdmission,
  validateAutomationWorkOrder,
} from "./automation-policy.mjs";
import {
  classifyDependencyPullRequest,
  comparePullRequestCas,
} from "./dependency-pr-normalizer.mjs";

const stateKeys = [
  "schemaVersion",
  "workflow",
  "idempotencyKey",
  "lineageKey",
  "policyVersion",
  "policySha256",
  "identity",
  "initialIdentity",
  "phase",
  "resumePhase",
  "attempts",
  "lineageBaselineAttempts",
  "consumedGrantRefs",
  "history",
  "historySha256",
  "outcome",
  "reasonCodes",
  "revision",
];
const identityKeys = [
  "workOrderId",
  "workOrderAuthoritySha256",
  "repository",
  "pullRequestNumber",
  "baseSha",
  "headSha",
  "failureFingerprint",
  "inputEvidenceSha256",
  "dependencyIntentSha256",
];
const grantKeys = [
  "schemaVersion",
  "grantRef",
  "grantId",
  "credentialClass",
  "authorizationRef",
  "issuerClass",
  "repository",
  "pullRequestNumber",
  "baseSha",
  "headSha",
  "policyVersion",
  "policySha256",
  "idempotencyKey",
  "inputEvidenceSha256",
  "dependencyIntentSha256",
];
const simpleEventKeys = ["schemaVersion", "type", "source"];
const classificationEventKeys = [
  "schemaVersion",
  "type",
  "source",
  "trustedEvent",
  "evidence",
];
const renewalEventKeys = classificationEventKeys;
const grantEventKeys = [
  "schemaVersion",
  "type",
  "source",
  "authorityName",
  "currentBaseSha",
  "currentHeadSha",
  "grant",
];
const patchReceiptKeys = [
  "schemaVersion",
  "type",
  "source",
  "expectedBaseSha",
  "expectedHeadSha",
  "currentBaseSha",
  "currentHeadSha",
  "publishedHeadSha",
];
const mergeReceiptKeys = [
  "schemaVersion",
  "type",
  "source",
  "expectedBaseSha",
  "expectedHeadSha",
  "currentBaseSha",
  "currentHeadSha",
  "mergedCommitSha",
];
const historyRecordKeys = [
  "schemaVersion",
  "revision",
  "fromPhase",
  "toPhase",
  "eventType",
  "eventSource",
  "eventSha256",
  "attemptDeltas",
  "grantProof",
  "identityBefore",
  "identityAfter",
];
const grantProofKeys = ["authorityName", ...grantKeys];
const replayRecordKeys = [
  "idempotencyKey",
  "inputEvidenceSha256",
  "replayIdentity",
  "result",
  "terminalState",
];
const replayIdentityKeys = [
  "repository",
  "pullRequestNumber",
  "baseSha",
  "headSha",
  "failureFingerprint",
  "policyVersion",
];
const replayResultKeys = ["schemaVersion", "terminalOutcome", "attempts", "reasonCodes"];
const persistedTerminalOutcomes = new Set(
  automationTerminalOutcomes.filter((outcome) => outcome !== "awaiting-approval"),
);

const dependencyPhases = new Set([
  "deterministic-classification",
  "cheap-model-assessment",
  "strong-model-assessment",
  "repair",
  "patch-authorization",
  "patch-publication",
  "work-order-renewal",
  "ci-validation",
  "ci-rerun",
  "merge-authorization",
  "merge",
  "post-merge-verification",
]);
const releasePhases = new Set([
  "release-promotion-authorization",
  "release-promotion",
  "deploy-authorization",
  "deploy",
  "deploy-verification",
  "rollback-authorization",
  "rollback",
  "rollback-verification",
]);

function emptyAttempts() {
  return Object.fromEntries(automationAttemptNames.map((name) => [name, 0]));
}

function normalizeAttempts(policy, priorAttempts) {
  const errors = exactObjectErrors(priorAttempts, "lineage attempts", automationAttemptNames);
  const attempts = emptyAttempts();
  if (!isExactObject(priorAttempts)) {
    return { attempts, errors };
  }
  for (const name of automationAttemptNames) {
    const value = priorAttempts[name];
    if (!Number.isSafeInteger(value) || value < 0 || value > (policy?.attemptCaps?.[name] ?? -1)) {
      errors.push(`lineage attempts ${name} must be within the policy cap`);
    } else {
      attempts[name] = value;
    }
  }
  return { attempts, errors };
}

function terminalize(state, outcome, reasonCode) {
  const safeState = isExactObject(state) ? state : {};
  const priorReasonCodes = Array.isArray(safeState.reasonCodes)
    ? safeState.reasonCodes.filter((value) => typeof value === "string")
    : [];
  const priorRevision = Number.isSafeInteger(safeState.revision) && safeState.revision >= 0
    ? safeState.revision
    : -1;
  return {
    ...safeState,
    phase: outcome,
    resumePhase: null,
    outcome,
    reasonCodes: [...new Set([...priorReasonCodes, reasonCode])].sort(),
    revision: priorRevision + 1,
  };
}

function transitionResult(state, effects = [], accepted = true, errors = []) {
  return { state, effects, accepted, errors };
}

function advance(state, phase, effect = null) {
  return transitionResult({
    ...state,
    phase,
    resumePhase: null,
    outcome: null,
    revision: state.revision + 1,
  }, effect ? [effect] : []);
}

function advanceWithAttempt(policy, state, attemptName, phase, effect, exhaustedOutcome) {
  if (state.attempts[attemptName] >= policy.attemptCaps[attemptName]) {
    return transitionResult(terminalize(
      state,
      exhaustedOutcome,
      `${attemptName}-exhausted`,
    ));
  }
  const next = {
    ...state,
    attempts: { ...state.attempts, [attemptName]: state.attempts[attemptName] + 1 },
  };
  return advance(next, phase, effect);
}

function safeProperty(value, key) {
  try {
    return value?.[key];
  } catch {
    return undefined;
  }
}

function workOrderAuthorityDigest(workOrder) {
  try {
    return canonicalSha256({
      schemaVersion: 1,
      workflow: workOrder?.workflow,
      capabilities: workOrder?.capabilities,
      authorizedGrantIds: workOrder?.authorizedGrantIds,
      modelEscalationAuthority: workOrder?.modelEscalationAuthority,
    });
  } catch {
    return "invalid";
  }
}

function failedCreation(policy, workOrder, errors) {
  const attempts = emptyAttempts();
  const repository = safeProperty(workOrder, "repository");
  const pullRequestNumber = safeProperty(workOrder, "pullRequestNumber");
  const baseSha = safeProperty(workOrder, "baseSha");
  const headSha = safeProperty(workOrder, "headSha");
  const failureFingerprint = safeProperty(workOrder, "failureFingerprint");
  const inputEvidenceSha256 = safeProperty(workOrder, "inputEvidenceSha256");
  const dependencyIntentSha256 = safeProperty(workOrder, "dependencyIntentSha256");
  const workOrderId = safeProperty(workOrder, "workOrderId");
  const identity = {
    workOrderId: typeof workOrderId === "string" ? workOrderId : "invalid",
    workOrderAuthoritySha256: workOrderAuthorityDigest(workOrder),
    repository: typeof repository === "string" ? repository : "invalid/invalid",
    pullRequestNumber: Number.isSafeInteger(pullRequestNumber)
      ? pullRequestNumber
      : 0,
    baseSha: typeof baseSha === "string" ? baseSha : "invalid",
    headSha: typeof headSha === "string" ? headSha : "invalid",
    failureFingerprint: typeof failureFingerprint === "string"
      ? failureFingerprint
      : "invalid",
    inputEvidenceSha256: typeof inputEvidenceSha256 === "string"
      ? inputEvidenceSha256
      : "invalid",
    dependencyIntentSha256: typeof dependencyIntentSha256 === "string"
      ? dependencyIntentSha256
      : "invalid",
  };
  const workflow = safeProperty(workOrder, "workflow");
  const idempotencyKey = safeProperty(workOrder, "idempotencyKey");
  const lineageKey = safeProperty(workOrder, "lineageKey");
  const policyVersion = safeProperty(policy, "policyVersion");
  const policySha256 = safeProperty(policy, "policySha256");
  return {
    schemaVersion: 1,
    workflow: workflow === "release" ? "release" : "dependency-pr",
    idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : "invalid",
    lineageKey: typeof lineageKey === "string" ? lineageKey : "invalid",
    policyVersion: typeof policyVersion === "string" ? policyVersion : "invalid",
    policySha256: typeof policySha256 === "string" ? policySha256 : "invalid",
    identity,
    initialIdentity: structuredClone(identity),
    phase: "failed-terminal",
    resumePhase: null,
    attempts,
    lineageBaselineAttempts: emptyAttempts(),
    consumedGrantRefs: [],
    history: [],
    historySha256: canonicalSha256([]),
    outcome: "failed-terminal",
    reasonCodes: Array.isArray(errors) && errors.length > 0
      ? ["invalid-controller-input"]
      : ["controller-failed"],
    revision: 0,
  };
}

function createAutomationStateWithAttempts(
  policy,
  workOrder,
  priorLineageAttempts,
  policyRegistry,
) {
  try {
    const errors = validateAutomationWorkOrder(policy, workOrder, policyRegistry);
    const normalized = normalizeAttempts(policy, priorLineageAttempts);
    errors.push(...normalized.errors);
    if (errors.length > 0) {
      return failedCreation(policy, workOrder, errors);
    }
    const identity = {
      workOrderId: workOrder.workOrderId,
      workOrderAuthoritySha256: workOrderAuthorityDigest(workOrder),
      repository: workOrder.repository,
      pullRequestNumber: workOrder.pullRequestNumber,
      baseSha: workOrder.baseSha,
      headSha: workOrder.headSha,
      failureFingerprint: workOrder.failureFingerprint,
      inputEvidenceSha256: workOrder.inputEvidenceSha256,
      dependencyIntentSha256: workOrder.dependencyIntentSha256,
    };
    return {
      schemaVersion: 1,
      workflow: workOrder.workflow,
      idempotencyKey: workOrder.idempotencyKey,
      lineageKey: workOrder.lineageKey,
      policyVersion: workOrder.policyVersion,
      policySha256: workOrder.policySha256,
      identity,
      initialIdentity: structuredClone(identity),
      phase: workOrder.workflow === "dependency-pr"
        ? "deterministic-classification"
        : "release-promotion-authorization",
      resumePhase: null,
      attempts: normalized.attempts,
      lineageBaselineAttempts: structuredClone(normalized.attempts),
      consumedGrantRefs: [],
      history: [],
      historySha256: canonicalSha256([]),
      outcome: null,
      reasonCodes: [],
      revision: 0,
    };
  } catch {
    return failedCreation(policy, workOrder, ["controller creation failed closed"]);
  }
}

export function createAutomationState(
  policy,
  workOrder,
  policyRegistry = checkedInAutomationPolicyRegistry(),
) {
  return createAutomationStateWithAttempts(policy, workOrder, emptyAttempts(), policyRegistry);
}

const historyRules = new Map();

function addHistoryRule(fromPhase, toPhase, eventTypes, options = {}) {
  historyRules.set(`${fromPhase}>${toPhase}`, {
    eventTypes,
    eventSource: options.eventSource ?? null,
    attemptName: options.attemptName ?? null,
    authorityName: options.authorityName ?? null,
    identityChange: options.identityChange ?? "same",
  });
}

addHistoryRule("deterministic-classification", "cheap-model-assessment", ["classification-evaluated"], {
  eventSource: "deterministic-controller", attemptName: "cheapAssessments",
});
addHistoryRule("deterministic-classification", "deferred", ["classification-evaluated"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("deterministic-classification", "stale", ["classification-evaluated"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("deterministic-classification", "escalated", ["classification-evaluated"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("cheap-model-assessment", "verified", ["assessment-no-repair"], {
  eventSource: "model-adapter",
});
addHistoryRule("cheap-model-assessment", "repair", ["assessment-repair-proposed"], {
  eventSource: "model-adapter", attemptName: "repairAttempts",
});
addHistoryRule("cheap-model-assessment", "strong-model-assessment", ["assessment-needs-escalation"], {
  eventSource: "model-adapter", attemptName: "strongEscalations",
});
addHistoryRule("cheap-model-assessment", "escalated", [
  "assessment-needs-escalation", "stage-error", "stage-timeout",
], { eventSource: "model-adapter" });
addHistoryRule("strong-model-assessment", "verified", ["assessment-no-repair"], {
  eventSource: "model-adapter",
});
addHistoryRule("strong-model-assessment", "repair", ["assessment-repair-proposed"], {
  eventSource: "model-adapter", attemptName: "repairAttempts",
});
addHistoryRule("strong-model-assessment", "escalated", ["stage-error", "stage-timeout"], {
  eventSource: "model-adapter",
});
addHistoryRule("repair", "patch-authorization", ["repair-produced"], {
  eventSource: "repair-worker",
});
addHistoryRule("patch-authorization", "awaiting-approval", ["authorization-missing"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("patch-authorization", "patch-publication", ["authorization-granted"], {
  eventSource: "authorization-broker", attemptName: "patchPublications", authorityName: "patchPublication",
});
addHistoryRule("patch-publication", "work-order-renewal", ["patch-publication-succeeded"], {
  eventSource: "source-control-broker", identityChange: "published-head",
});
addHistoryRule("work-order-renewal", "ci-validation", ["work-order-renewed"], {
  eventSource: "deterministic-controller", identityChange: "renewed-evidence",
});
addHistoryRule("ci-validation", "ci-rerun", ["ci-infra-flake"], {
  eventSource: "ci-adapter", attemptName: "ciFlakeReruns",
});
for (const fromPhase of ["ci-validation", "ci-rerun"]) {
  addHistoryRule(fromPhase, "merge-authorization", ["ci-passed"], { eventSource: "ci-adapter" });
}
addHistoryRule("merge-authorization", "awaiting-approval", ["authorization-missing"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("merge-authorization", "merge", ["authorization-granted"], {
  eventSource: "authorization-broker", attemptName: "mergeAttempts", authorityName: "pullRequestMerge",
});
addHistoryRule("merge", "post-merge-verification", ["merge-succeeded"], {
  eventSource: "source-control-broker",
});
addHistoryRule("post-merge-verification", "completed", ["post-merge-passed"], {
  eventSource: "ci-adapter",
});
addHistoryRule("release-promotion-authorization", "awaiting-approval", ["authorization-missing"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("release-promotion-authorization", "release-promotion", ["authorization-granted"], {
  eventSource: "authorization-broker", attemptName: "releasePromotions", authorityName: "releasePromotion",
});
addHistoryRule("release-promotion", "deploy-authorization", ["release-promotion-succeeded"], {
  eventSource: "release-broker",
});
addHistoryRule("deploy-authorization", "awaiting-approval", ["authorization-missing"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("deploy-authorization", "deploy", ["authorization-granted"], {
  eventSource: "authorization-broker", attemptName: "deployAttempts", authorityName: "productionDeploy",
});
addHistoryRule("deploy", "deploy-verification", ["deploy-succeeded"], {
  eventSource: "deploy-broker",
});
addHistoryRule("deploy", "rollback-authorization", ["deploy-failed", "stage-error", "stage-timeout"], {
  eventSource: "deploy-broker",
});
addHistoryRule("deploy-verification", "completed", ["deploy-verification-passed"], {
  eventSource: "deploy-broker",
});
addHistoryRule("deploy-verification", "rollback-authorization", [
  "deploy-verification-failed", "stage-error", "stage-timeout",
], { eventSource: "deploy-broker" });
addHistoryRule("rollback-authorization", "awaiting-approval", ["authorization-missing"], {
  eventSource: "deterministic-controller",
});
addHistoryRule("rollback-authorization", "rollback", ["authorization-granted"], {
  eventSource: "authorization-broker", attemptName: "rollbackAttempts", authorityName: "productionRollback",
});
addHistoryRule("rollback", "rollback-verification", ["rollback-succeeded"], {
  eventSource: "rollback-broker",
});
addHistoryRule("rollback-verification", "reverted", ["rollback-verification-passed"], {
  eventSource: "rollback-broker",
});
for (const [toPhase, authorityName, attemptName] of [
  ["patch-publication", "patchPublication", "patchPublications"],
  ["merge", "pullRequestMerge", "mergeAttempts"],
  ["release-promotion", "releasePromotion", "releasePromotions"],
  ["deploy", "productionDeploy", "deployAttempts"],
  ["rollback", "productionRollback", "rollbackAttempts"],
]) {
  addHistoryRule("awaiting-approval", toPhase, ["authorization-granted"], {
    eventSource: "authorization-broker", attemptName, authorityName,
  });
}
for (const fromPhase of [
  "patch-authorization",
  "merge-authorization",
  "release-promotion-authorization",
  "deploy-authorization",
  "rollback-authorization",
  "awaiting-approval",
]) {
  addHistoryRule(fromPhase, "deferred", ["authorization-granted"], {
    eventSource: "authorization-broker",
  });
}

function historyRuleFor(record, awaitingResumePhase) {
  const exactRule = historyRules.get(`${record.fromPhase}>${record.toPhase}`);
  if (exactRule) return exactRule;
  if (record.toPhase === "failed-terminal") {
    const grantPhase = record.fromPhase === "awaiting-approval"
      ? awaitingResumePhase
      : record.fromPhase;
    const authorityName = ({
      "patch-authorization": "patchPublication",
      "merge-authorization": "pullRequestMerge",
      "release-promotion-authorization": "releasePromotion",
      "deploy-authorization": "productionDeploy",
      "rollback-authorization": "productionRollback",
    })[grantPhase] ?? null;
    return {
      eventTypes: null,
      eventSource: null,
      attemptName: null,
      authorityName: record.eventType === "authorization-granted" ? authorityName : null,
      identityChange: "same",
      grantOptional: true,
    };
  }
  if (record.toPhase === "stale") {
    return {
      eventTypes: null,
      eventSource: null,
      attemptName: null,
      authorityName: null,
      identityChange: "same",
    };
  }
  return null;
}

function validateHistoryGrant(policy, workOrder, proof, record, seenGrantRefs, authorityName) {
  const errors = exactObjectErrors(proof, "automation history grant proof", grantProofKeys);
  if (!isExactObject(proof)) return errors;
  const authority = policy.authority?.[authorityName];
  if (!authority || proof.authorityName !== authorityName ||
      proof.grantId !== authority.grantId ||
      proof.credentialClass !== authority.credentialClass) {
    errors.push("automation history grant proof must match the exact workflow edge authority");
  }
  if (!Array.isArray(workOrder?.authorizedGrantIds) ||
      !workOrder.authorizedGrantIds.includes(proof.grantId)) {
    errors.push("automation history grant proof must be authorized by the current work order");
  }
  if (proof.schemaVersion !== 1 || proof.issuerClass !== "human-authorization" ||
      typeof proof.authorizationRef !== "string" || proof.authorizationRef.length === 0 ||
      typeof proof.grantRef !== "string" || proof.grantRef.length === 0) {
    errors.push("automation history grant proof must carry human authorization evidence");
  }
  if (seenGrantRefs.has(proof.grantRef)) {
    errors.push("automation history grant proof must be consumed once");
  }
  seenGrantRefs.add(proof.grantRef);
  const expected = {
    repository: record.identityBefore.repository,
    pullRequestNumber: record.identityBefore.pullRequestNumber,
    baseSha: record.identityBefore.baseSha,
    headSha: record.identityBefore.headSha,
    inputEvidenceSha256: record.identityBefore.inputEvidenceSha256,
    dependencyIntentSha256: record.identityBefore.dependencyIntentSha256,
    policyVersion: policy.policyVersion,
    policySha256: policy.policySha256,
    idempotencyKey: dependencyPullRequestIdempotencyKey({
      ...record.identityBefore,
      policyVersion: policy.policyVersion,
    }),
  };
  if (workOrder?.workflow === "release") {
    expected.idempotencyKey = workOrder.idempotencyKey;
  }
  for (const [key, value] of Object.entries(expected)) {
    if (proof[key] !== value) {
      errors.push(`automation history grant proof ${key} must match its transition identity`);
    }
  }
  return errors;
}

function validateHistoryIdentity(identity, label) {
  const errors = exactObjectErrors(identity, label, identityKeys);
  if (!isExactObject(identity)) return errors;
  if (typeof identity.workOrderId !== "string" ||
      !/^[a-z0-9][a-z0-9._:-]{0,127}$/.test(identity.workOrderId)) {
    errors.push(`${label}.workOrderId must be a bounded canonical ID`);
  }
  if (typeof identity.repository !== "string" || !githubRepository.test(identity.repository)) {
    errors.push(`${label}.repository must be canonical`);
  }
  if (!Number.isSafeInteger(identity.pullRequestNumber) || identity.pullRequestNumber < 1) {
    errors.push(`${label}.pullRequestNumber must be positive`);
  }
  for (const key of ["baseSha", "headSha"]) {
    if (!fullLowercaseSha1.test(identity[key] ?? "")) {
      errors.push(`${label}.${key} must be an exact SHA-1`);
    }
  }
  for (const key of [
    "workOrderAuthoritySha256",
    "failureFingerprint",
    "inputEvidenceSha256",
    "dependencyIntentSha256",
  ]) {
    if (!fullLowercaseSha256.test(identity[key] ?? "")) {
      errors.push(`${label}.${key} must be an exact SHA-256`);
    }
  }
  return errors;
}

function validateHistoryIdentityChange(record, rule) {
  const errors = [];
  const before = record.identityBefore;
  const after = record.identityAfter;
  if (!isExactObject(before) || !isExactObject(after)) return errors;
  const changed = identityKeys.filter((key) => before[key] !== after[key]);
  if (rule.identityChange === "same" && changed.length > 0) {
    errors.push("automation history identity may not change on this edge");
  }
  if (rule.identityChange === "published-head") {
    if (changed.length !== 1 || changed[0] !== "headSha") {
      errors.push("patch publication history may change only the exact head SHA");
    }
  }
  if (rule.identityChange === "renewed-evidence") {
    if (changed.some((key) => ![
      "workOrderId",
      "failureFingerprint",
      "inputEvidenceSha256",
    ].includes(key)) || before.workOrderId === after.workOrderId ||
        before.inputEvidenceSha256 === after.inputEvidenceSha256) {
      errors.push("work-order renewal requires a new ID and may change only freshly derived evidence identity");
    }
  }
  return errors;
}

function validateAutomationHistory(policy, workOrder, state) {
  const errors = [];
  const baseline = normalizeAttempts(policy, state.lineageBaselineAttempts);
  errors.push(...baseline.errors);
  if (!Array.isArray(state.history) || state.history.length > 64) {
    errors.push("automation state history must be a bounded array");
    return errors;
  }
  if (!fullLowercaseSha256.test(state.historySha256 ?? "") ||
      state.historySha256 !== canonicalSha256(state.history)) {
    errors.push("automation state historySha256 must match its canonical history");
  }
  errors.push(...validateHistoryIdentity(state.initialIdentity, "automation initial identity"));
  if (!isExactObject(state.initialIdentity)) return errors;

  const attempts = { ...baseline.attempts };
  let expectedPhase = state.workflow === "release"
    ? "release-promotion-authorization"
    : "deterministic-classification";
  let expectedIdentity = state.initialIdentity;
  const seenGrantRefs = new Set();
  const derivedGrantRefs = [];
  let awaitingResumePhase = null;
  for (const [index, record] of state.history.entries()) {
    const label = `automation state history[${index}]`;
    errors.push(...exactObjectErrors(record, label, historyRecordKeys));
    if (!isExactObject(record)) continue;
    if (record.schemaVersion !== 1 || record.revision !== index + 1) {
      errors.push(`${label} must carry its exact one-based revision`);
    }
    const rule = historyRuleFor(record, awaitingResumePhase);
    if (record.fromPhase !== expectedPhase || rule === null) {
      errors.push(`${label} must follow an exact controller phase edge`);
    }
    if (typeof record.eventType !== "string" || typeof record.eventSource !== "string" ||
        !fullLowercaseSha256.test(record.eventSha256 ?? "")) {
      errors.push(`${label} must identify a hashed event`);
    }
    if (rule?.eventTypes !== null && !rule?.eventTypes.includes(record.eventType)) {
      errors.push(`${label}.eventType is not valid for its phase edge`);
    }
    if (rule?.eventSource !== null && record.eventSource !== rule?.eventSource) {
      errors.push(`${label}.eventSource is not valid for its phase edge`);
    }
    if (record.fromPhase === "awaiting-approval") {
      const expectedTarget = ({
        "patch-authorization": "patch-publication",
        "merge-authorization": "merge",
        "release-promotion-authorization": "release-promotion",
        "deploy-authorization": "deploy",
        "rollback-authorization": "rollback",
      })[awaitingResumePhase];
      if (record.toPhase !== "failed-terminal" && record.toPhase !== "stale" &&
          record.toPhase !== expectedTarget) {
        errors.push(`${label} must resume the authorization phase that entered awaiting approval`);
      }
    }
    errors.push(...exactObjectErrors(record.attemptDeltas, `${label}.attemptDeltas`, automationAttemptNames));
    if (isExactObject(record.attemptDeltas)) {
      for (const name of automationAttemptNames) {
        const delta = record.attemptDeltas[name];
        const expectedDelta = rule?.attemptName === name ? 1 : 0;
        if (delta !== expectedDelta) {
          errors.push(`${label}.attemptDeltas.${name} must match the exact phase edge`);
        } else {
          attempts[name] += delta;
          if (attempts[name] > policy.attemptCaps[name]) {
            errors.push(`${label} exceeds attempt cap ${name}`);
          }
        }
      }
    }
    errors.push(...validateHistoryIdentity(record.identityBefore, `${label}.identityBefore`));
    errors.push(...validateHistoryIdentity(record.identityAfter, `${label}.identityAfter`));
    if (JSON.stringify(record.identityBefore) !== JSON.stringify(expectedIdentity)) {
      errors.push(`${label}.identityBefore must continue the identity chain`);
    }
    if (rule !== null) {
      errors.push(...validateHistoryIdentityChange(record, rule).map((error) => `${label}: ${error}`));
    }
    if (record.grantProof === null) {
      if (rule?.authorityName !== null && rule?.grantOptional !== true) {
        errors.push(`${label} authority edge must carry its exact grant proof`);
      }
    } else {
      if (rule?.authorityName === null) {
        errors.push(`${label} grant proof is forbidden on a non-authority edge`);
      } else {
        errors.push(...validateHistoryGrant(
          policy,
          workOrder,
          record.grantProof,
          record,
          seenGrantRefs,
          rule.authorityName,
        ));
      }
      derivedGrantRefs.push(record.grantProof.grantRef);
      if (record.eventType !== "authorization-granted") {
        errors.push(`${label} grant proof is allowed only for an authorization event`);
      }
    }
    if (record.toPhase === "awaiting-approval") {
      awaitingResumePhase = record.fromPhase;
    } else if (record.fromPhase === "awaiting-approval") {
      awaitingResumePhase = null;
    }
    expectedPhase = record.toPhase;
    expectedIdentity = record.identityAfter;
  }
  if (expectedPhase !== state.phase) {
    errors.push("automation state phase must equal the last validated history phase");
  }
  if (JSON.stringify(expectedIdentity) !== JSON.stringify(state.identity)) {
    errors.push("automation state identity must equal the last validated history identity");
  }
  if (JSON.stringify(attempts) !== JSON.stringify(state.attempts)) {
    errors.push("automation state attempts must equal baseline plus history deltas");
  }
  if (JSON.stringify([...derivedGrantRefs].sort()) !==
      JSON.stringify([...state.consumedGrantRefs].sort())) {
    errors.push("automation state consumed grants must come from typed history proofs");
  }
  if (state.revision !== state.history.length) {
    errors.push("automation state revision must equal its history length");
  }
  if (state.phase === "awaiting-approval" && state.resumePhase !== awaitingResumePhase) {
    errors.push("automation state resumePhase must come from its exact history edge");
  }
  return errors;
}

function validateState(policy, workOrder, state, options = {}) {
  const errors = [
    ...validateAutomationWorkOrder(policy, workOrder, options.policyRegistry),
    ...exactObjectErrors(state, "automation state", stateKeys),
  ];
  if (!isExactObject(state)) {
    return errors;
  }
  if (state.schemaVersion !== 1) {
    errors.push("automation state schemaVersion must be 1");
  }
  errors.push(...exactObjectErrors(state.identity, "automation state identity", identityKeys));
  const attempts = normalizeAttempts(policy, state.attempts);
  errors.push(...attempts.errors);
  errors.push(...validateAutomationHistory(policy, workOrder, state));
  if (!Array.isArray(state.consumedGrantRefs) ||
      state.consumedGrantRefs.some((value) => typeof value !== "string") ||
      new Set(state.consumedGrantRefs).size !== state.consumedGrantRefs.length) {
    errors.push("automation state consumedGrantRefs must be unique strings");
  }
  if (!Array.isArray(state.reasonCodes) ||
      state.reasonCodes.some((value) => typeof value !== "string")) {
    errors.push("automation state reasonCodes must be strings");
  }
  if (!Number.isSafeInteger(state.revision) || state.revision < 0) {
    errors.push("automation state revision must be non-negative");
  }
  const allowedPhases = new Set([
    ...dependencyPhases,
    ...releasePhases,
    ...automationTerminalOutcomes,
  ]);
  if (!allowedPhases.has(state.phase)) {
    errors.push("automation state phase is unknown");
  }
  const workflowPhases = state.workflow === "release" ? releasePhases : dependencyPhases;
  const terminalPhase = automationTerminalOutcomes.includes(state.phase);
  if (!terminalPhase && !workflowPhases.has(state.phase)) {
    errors.push("automation state phase does not belong to its workflow");
  }
  if (policy.mode === "shadow") {
    const mutationPhases = new Set([
      "patch-publication",
      "work-order-renewal",
      "ci-validation",
      "ci-rerun",
      "merge-authorization",
      "merge",
      "post-merge-verification",
      "release-promotion",
      "deploy-authorization",
      "deploy",
      "deploy-verification",
      "rollback-authorization",
      "rollback",
      "rollback-verification",
    ]);
    if (mutationPhases.has(state.phase) || (Array.isArray(state.history) && state.history.some(
      (record) => mutationPhases.has(record?.toPhase),
    ))) {
      errors.push("shadow automation state cannot enter an external mutation phase");
    }
  }
  if (state.outcome === null && terminalPhase) {
    errors.push("automation state terminal phase must carry its outcome");
  }
  if (state.outcome !== null && state.phase !== state.outcome) {
    errors.push("automation state outcome must equal its terminal phase");
  }
  if (state.outcome === "awaiting-approval") {
    const authorizationPhases = new Set([
      "patch-authorization",
      "merge-authorization",
      "release-promotion-authorization",
      "deploy-authorization",
      "rollback-authorization",
    ]);
    if (!authorizationPhases.has(state.resumePhase) || !workflowPhases.has(state.resumePhase)) {
      errors.push("awaiting approval must resume a workflow-specific authorization phase");
    }
  } else if (state.resumePhase !== null) {
    errors.push("only awaiting approval may carry a resume phase");
  }

  if (!terminalPhase) {
    const requiresAttempt = (name, phases) => {
      if (phases.includes(state.phase) && state.attempts[name] < 1) {
        errors.push(`automation state phase ${state.phase} requires ${name}`);
      }
    };
    requiresAttempt("cheapAssessments", [
      "cheap-model-assessment",
      "strong-model-assessment",
      "repair",
      "patch-authorization",
      "patch-publication",
      "work-order-renewal",
      "ci-validation",
      "ci-rerun",
      "merge-authorization",
      "merge",
      "post-merge-verification",
    ]);
    requiresAttempt("strongEscalations", ["strong-model-assessment"]);
    requiresAttempt("repairAttempts", [
      "repair",
      "patch-authorization",
      "patch-publication",
      "work-order-renewal",
      "ci-validation",
      "ci-rerun",
      "merge-authorization",
      "merge",
      "post-merge-verification",
    ]);
    requiresAttempt("patchPublications", [
      "patch-publication",
      "work-order-renewal",
      "ci-validation",
      "ci-rerun",
      "merge-authorization",
      "merge",
      "post-merge-verification",
    ]);
    requiresAttempt("ciFlakeReruns", ["ci-rerun"]);
    requiresAttempt("mergeAttempts", ["merge", "post-merge-verification"]);
    requiresAttempt("releasePromotions", [
      "release-promotion",
      "deploy-authorization",
      "deploy",
      "deploy-verification",
      "rollback-authorization",
      "rollback",
      "rollback-verification",
    ]);
    requiresAttempt("deployAttempts", [
      "deploy",
      "deploy-verification",
      "rollback-authorization",
      "rollback",
      "rollback-verification",
    ]);
    requiresAttempt("rollbackAttempts", ["rollback", "rollback-verification"]);
    const requiredGrantCount = state.workflow === "dependency-pr"
      ? ({
        "patch-publication": 1,
        "work-order-renewal": 1,
        "ci-validation": 1,
        "ci-rerun": 1,
        "merge-authorization": 1,
        merge: 2,
        "post-merge-verification": 2,
      }[state.phase] ?? 0)
      : ({
        "release-promotion": 1,
        "deploy-authorization": 1,
        deploy: 2,
        "deploy-verification": 2,
        "rollback-authorization": 2,
        rollback: 3,
        "rollback-verification": 3,
      }[state.phase] ?? 0);
    if (state.consumedGrantRefs.length < requiredGrantCount) {
      errors.push(`automation state phase ${state.phase} lacks required authority history`);
    }
  }
  const stableWorkOrderMatch = state.workflow === workOrder?.workflow &&
    state.policyVersion === workOrder?.policyVersion &&
    state.policySha256 === workOrder?.policySha256 &&
    state.lineageKey === workOrder?.lineageKey &&
    state.identity?.repository === workOrder?.repository &&
    state.identity?.pullRequestNumber === workOrder?.pullRequestNumber &&
    state.identity?.baseSha === workOrder?.baseSha &&
    state.identity?.headSha === workOrder?.headSha &&
    state.identity?.dependencyIntentSha256 === workOrder?.dependencyIntentSha256 &&
    state.identity?.workOrderAuthoritySha256 === workOrderAuthorityDigest(workOrder);
  const exactWorkOrderMatch = stableWorkOrderMatch &&
    state.identity?.workOrderId === workOrder?.workOrderId &&
    state.idempotencyKey === workOrder?.idempotencyKey &&
    state.identity?.failureFingerprint === workOrder?.failureFingerprint &&
    state.identity?.inputEvidenceSha256 === workOrder?.inputEvidenceSha256;
  const renewalIdentityChangeAllowed = options.allowRenewalIdentityChange === true &&
    state.phase === "work-order-renewal" && stableWorkOrderMatch;
  if (!exactWorkOrderMatch && !renewalIdentityChangeAllowed) {
    errors.push("automation state must match the current exact work order identity");
  }
  return errors;
}

function validateSimpleEvent(event, expectedSource) {
  const errors = exactObjectErrors(event, "automation event", simpleEventKeys);
  if (!isExactObject(event)) {
    return errors;
  }
  if (event.schemaVersion !== 1) {
    errors.push("automation event schemaVersion must be 1");
  }
  if (event.source !== expectedSource) {
    errors.push(`automation event source must be ${expectedSource}`);
  }
  return errors;
}

function currentIdentity(state, baseSha = state.identity.baseSha, headSha = state.identity.headSha) {
  return {
    repository: state.identity.repository,
    pullRequestNumber: state.identity.pullRequestNumber,
    baseSha,
    headSha,
  };
}

function validateGrant(policy, workOrder, state, event, authorityName) {
  const errors = exactObjectErrors(event, "authorization event", grantEventKeys);
  if (!isExactObject(event)) {
    return errors;
  }
  if (event.schemaVersion !== 1 || event.type !== "authorization-granted" ||
      event.source !== "authorization-broker" || event.authorityName !== authorityName) {
    errors.push("authorization event type, source, and authority must match the controller phase");
  }
  errors.push(...exactObjectErrors(event.grant, "authorization grant", grantKeys));
  if (!isExactObject(event.grant)) {
    return errors;
  }
  const grant = event.grant;
  const authority = policy.authority?.[authorityName];
  if (grant.schemaVersion !== 1 || grant.grantId !== authority?.grantId ||
      grant.credentialClass !== authority?.credentialClass) {
    errors.push("authorization grant must match the single expected authority");
  }
  if (grant.issuerClass !== "human-authorization" ||
      typeof grant.authorizationRef !== "string" || grant.authorizationRef.length === 0 ||
      grant.authorizationRef.length > 512 ||
      typeof grant.grantRef !== "string" || grant.grantRef.length === 0 ||
      grant.grantRef.length > 512) {
    errors.push("authorization grant must carry bounded human approval evidence");
  }
  if (!workOrder.authorizedGrantIds.includes(grant.grantId)) {
    errors.push("authorization grant is not enabled by the current work order");
  }
  if (state.consumedGrantRefs.includes(grant.grantRef)) {
    errors.push("authorization grant has already been consumed");
  }
  const expectedValues = {
    repository: state.identity.repository,
    pullRequestNumber: state.identity.pullRequestNumber,
    baseSha: state.identity.baseSha,
    headSha: state.identity.headSha,
    policyVersion: state.policyVersion,
    policySha256: state.policySha256,
    idempotencyKey: state.idempotencyKey,
    inputEvidenceSha256: state.identity.inputEvidenceSha256,
    dependencyIntentSha256: state.identity.dependencyIntentSha256,
  };
  for (const [key, expected] of Object.entries(expectedValues)) {
    if (grant[key] !== expected) {
      errors.push(`authorization grant ${key} must match the exact controller identity`);
    }
  }
  const cas = comparePullRequestCas(
    currentIdentity(state),
    currentIdentity(state, event.currentBaseSha, event.currentHeadSha),
  );
  errors.push(...cas.reasons);
  return errors;
}

function grantTransition(policy, workOrder, state, event, authorityName, attemptName, phase, effectType) {
  const errors = validateGrant(policy, workOrder, state, event, authorityName);
  if (errors.some((error) => error.includes("changed"))) {
    return transitionResult(terminalize(state, "stale", "authorization-cas-stale"), [], false, errors);
  }
  if (errors.length > 0) {
    return transitionResult(terminalize(state, "failed-terminal", "invalid-authorization"), [], false, errors);
  }
  if (policy.mode === "shadow") {
    return transitionResult(terminalize(state, "deferred", "shadow-mode-mutation-forbidden"));
  }
  const consumed = {
    ...state,
    consumedGrantRefs: [...state.consumedGrantRefs, event.grant.grantRef].sort(),
  };
  return advanceWithAttempt(
    policy,
    consumed,
    attemptName,
    phase,
    { type: effectType, grantRef: event.grant.grantRef },
    "failed-terminal",
  );
}

function expectedSimpleSource(phase, type) {
  if (type === "model-escalation-requested") return "model-adapter";
  if (type.startsWith("assessment-")) return "model-adapter";
  if (type.startsWith("repair-")) return "repair-worker";
  if (type === "authorization-missing") return "deterministic-controller";
  if (type.startsWith("ci-") || type.startsWith("post-merge-")) return "ci-adapter";
  if (type.startsWith("release-promotion-")) return "release-broker";
  if (type.startsWith("deploy-")) return "deploy-broker";
  if (type.startsWith("rollback-")) return "rollback-broker";
  if (["stage-error", "stage-timeout"].includes(type)) {
    if (["cheap-model-assessment", "strong-model-assessment"].includes(phase)) {
      return "model-adapter";
    }
    if (phase === "repair") return "repair-worker";
    if (["ci-validation", "ci-rerun", "post-merge-verification"].includes(phase)) {
      return "ci-adapter";
    }
    if (phase === "release-promotion") return "release-broker";
    if (["deploy", "deploy-verification"].includes(phase)) return "deploy-broker";
    if (["rollback", "rollback-verification"].includes(phase)) return "rollback-broker";
    return "source-control-broker";
  }
  return null;
}

function terminalForError(state, eventType) {
  if (["cheap-model-assessment", "strong-model-assessment"].includes(state.phase)) {
    return terminalize(state, "escalated", eventType);
  }
  if (["deploy", "deploy-verification"].includes(state.phase)) {
    return {
      ...state,
      phase: "rollback-authorization",
      outcome: null,
      reasonCodes: [...new Set([...state.reasonCodes, eventType])].sort(),
      revision: state.revision + 1,
    };
  }
  return terminalize(state, "failed-terminal", eventType);
}

function validateReceipt(event, expectedKeys, expectedType, expectedSource, state) {
  const errors = exactObjectErrors(event, "mutation receipt", expectedKeys);
  if (!isExactObject(event)) return errors;
  if (event.schemaVersion !== 1 || event.type !== expectedType || event.source !== expectedSource) {
    errors.push("mutation receipt type and source must match the controller phase");
  }
  for (const key of ["expectedBaseSha", "expectedHeadSha", "currentBaseSha", "currentHeadSha"]) {
    if (!fullLowercaseSha1.test(event[key] ?? "")) {
      errors.push(`mutation receipt ${key} must be an exact SHA-1`);
    }
  }
  if (event.expectedBaseSha !== state.identity.baseSha ||
      event.expectedHeadSha !== state.identity.headSha) {
    errors.push("mutation receipt expected identity must match controller state");
  }
  const cas = comparePullRequestCas(
    currentIdentity(state),
    currentIdentity(state, event.currentBaseSha, event.currentHeadSha),
  );
  errors.push(...cas.reasons);
  return errors;
}

function applyClassification(policy, workOrder, state, event, policyRegistry) {
  const errors = exactObjectErrors(event, "classification event", classificationEventKeys);
  if (!isExactObject(event)) {
    return transitionResult(terminalize(state, "failed-terminal", "invalid-classification-event"), [], false, errors);
  }
  if (event.schemaVersion !== 1 || event.type !== "classification-evaluated" ||
      event.source !== "deterministic-controller") {
    errors.push("classification event type and source must be deterministic-controller evaluation");
  }
  if (errors.length > 0) {
    return transitionResult(terminalize(state, "failed-terminal", "invalid-classification-event"), [], false, errors);
  }
  const classification = classifyDependencyPullRequest(
    policy,
    event.trustedEvent,
    event.evidence,
    policyRegistry,
  );
  if (classification.terminalOutcome !== null) {
    return transitionResult(terminalize(
      state,
      classification.terminalOutcome,
      `classification-${classification.terminalOutcome}`,
    ));
  }
  const candidate = classification.candidate;
  const boundValues = {
    repository: state.identity.repository,
    pullRequestNumber: state.identity.pullRequestNumber,
    baseSha: state.identity.baseSha,
    headSha: state.identity.headSha,
    failureFingerprint: state.identity.failureFingerprint,
    inputEvidenceSha256: state.identity.inputEvidenceSha256,
    dependencyIntentSha256: state.identity.dependencyIntentSha256,
    policyVersion: state.policyVersion,
    policySha256: state.policySha256,
    idempotencyKey: state.idempotencyKey,
    lineageKey: state.lineageKey,
  };
  if (!isExactObject(candidate) || Object.entries(boundValues).some(
    ([key, expected]) => candidate[key] !== expected,
  )) {
    return transitionResult(terminalize(state, "stale", "classification-work-order-mismatch"));
  }
  if (!["model-assessment", "repo-read", "sanitized-evidence-read"].every(
    (capability) => workOrder.capabilities.includes(capability),
  )) {
    return transitionResult(terminalize(state, "failed-terminal", "model-capability-set-incomplete"));
  }
  return advanceWithAttempt(
    policy,
    state,
    "cheapAssessments",
    "cheap-model-assessment",
    {
      type: "invoke-model",
      profileClass: policy.modelRoute.cheapProfileClass,
      inputEvidenceSha256: candidate.inputEvidenceSha256,
      failureFingerprint: candidate.failureFingerprint,
    },
    "escalated",
  );
}

function candidateMatchesWorkOrder(candidate, workOrder) {
  if (!isExactObject(candidate)) return false;
  const expected = {
    repository: workOrder.repository,
    pullRequestNumber: workOrder.pullRequestNumber,
    baseSha: workOrder.baseSha,
    headSha: workOrder.headSha,
    failureFingerprint: workOrder.failureFingerprint,
    inputEvidenceSha256: workOrder.inputEvidenceSha256,
    dependencyIntentSha256: workOrder.dependencyIntentSha256,
    policyVersion: workOrder.policyVersion,
    policySha256: workOrder.policySha256,
    idempotencyKey: workOrder.idempotencyKey,
    lineageKey: workOrder.lineageKey,
  };
  return Object.entries(expected).every(([key, value]) => candidate[key] === value);
}

function applyWorkOrderRenewal(policy, workOrder, state, event, policyRegistry) {
  const errors = exactObjectErrors(event, "work-order renewal event", renewalEventKeys);
  if (!isExactObject(event)) {
    return transitionResult(terminalize(state, "failed-terminal", "invalid-work-order-renewal"), [], false, errors);
  }
  if (event.schemaVersion !== 1 || event.type !== "work-order-renewed" ||
      event.source !== "deterministic-controller") {
    errors.push("work-order renewal must carry deterministic authenticated evidence");
  }
  if (errors.length > 0) {
    return transitionResult(terminalize(state, "failed-terminal", "invalid-work-order-renewal"), [], false, errors);
  }
  const classification = classifyDependencyPullRequest(
    policy,
    event.trustedEvent,
    event.evidence,
    policyRegistry,
  );
  if (classification.terminalOutcome !== null) {
    return transitionResult(terminalize(
      state,
      classification.terminalOutcome,
      `work-order-renewal-${classification.terminalOutcome}`,
    ));
  }
  if (!candidateMatchesWorkOrder(classification.candidate, workOrder) ||
      workOrder.repository !== state.identity.repository ||
      workOrder.pullRequestNumber !== state.identity.pullRequestNumber ||
      workOrder.baseSha !== state.identity.baseSha ||
      workOrder.headSha !== state.identity.headSha ||
      workOrder.dependencyIntentSha256 !== state.identity.dependencyIntentSha256 ||
      workOrder.lineageKey !== state.lineageKey) {
    return transitionResult(terminalize(state, "stale", "work-order-renewal-identity-stale"));
  }
  if (workOrder.workOrderId === state.identity.workOrderId ||
      workOrder.inputEvidenceSha256 === state.identity.inputEvidenceSha256) {
    return transitionResult(terminalize(state, "failed-terminal", "invalid-work-order-renewal"));
  }
  const renewed = {
    ...state,
    idempotencyKey: workOrder.idempotencyKey,
    identity: {
      ...state.identity,
      workOrderId: workOrder.workOrderId,
      failureFingerprint: workOrder.failureFingerprint,
      inputEvidenceSha256: workOrder.inputEvidenceSha256,
    },
  };
  return advance(renewed, "ci-validation", {
    type: "verify-ci",
    repository: workOrder.repository,
    pullRequestNumber: workOrder.pullRequestNumber,
    baseSha: workOrder.baseSha,
    headSha: workOrder.headSha,
    inputEvidenceSha256: workOrder.inputEvidenceSha256,
  });
}

function applyPatchPublicationReceipt(activeState, event) {
  const errors = validateReceipt(
    event,
    patchReceiptKeys,
    "patch-publication-succeeded",
    "source-control-broker",
    activeState,
  );
  if (!fullLowercaseSha1.test(event.publishedHeadSha ?? "")) {
    errors.push("mutation receipt publishedHeadSha must be an exact SHA-1");
  }
  if (event.publishedHeadSha === activeState.identity.headSha) {
    errors.push("mutation receipt publishedHeadSha must identify a changed head");
  }
  if (errors.some((error) => error.includes("changed"))) {
    return transitionResult(terminalize(activeState, "stale", "publication-cas-stale"), [], false, errors);
  }
  if (errors.length > 0) {
    return transitionResult(terminalize(activeState, "failed-terminal", "invalid-publication-receipt"), [], false, errors);
  }
  const identity = { ...activeState.identity, headSha: event.publishedHeadSha };
  const next = {
    ...activeState,
    identity,
    idempotencyKey: dependencyPullRequestIdempotencyKey({
      ...identity,
      policyVersion: activeState.policyVersion,
    }),
  };
  return advance(next, "work-order-renewal", {
    type: "renew-work-order",
    requiredIdentity: {
      repository: identity.repository,
      pullRequestNumber: identity.pullRequestNumber,
      baseSha: identity.baseSha,
      headSha: identity.headSha,
      policyVersion: activeState.policyVersion,
      policySha256: activeState.policySha256,
      lineageKey: activeState.lineageKey,
    },
  });
}

function applyMergeReceipt(activeState, event) {
  const errors = validateReceipt(
    event,
    mergeReceiptKeys,
    "merge-succeeded",
    "source-control-broker",
    activeState,
  );
  if (!fullLowercaseSha1.test(event.mergedCommitSha ?? "")) {
    errors.push("mutation receipt mergedCommitSha must be an exact SHA-1");
  }
  if (errors.some((error) => error.includes("changed"))) {
    return transitionResult(terminalize(activeState, "stale", "merge-cas-stale"), [], false, errors);
  }
  if (errors.length > 0) {
    return transitionResult(terminalize(activeState, "failed-terminal", "invalid-merge-receipt"), [], false, errors);
  }
  return advance(activeState, "post-merge-verification", {
    type: "verify-post-merge",
    mergedCommitSha: event.mergedCommitSha,
  });
}

function transitionAutomationCore(policy, workOrder, state, event, policyRegistry) {
  try {
    if (validateAutomationPolicyAdmission(policy, policyRegistry).length > 0 ||
        !isExactObject(state)) {
      const failed = failedCreation(policy, workOrder, ["invalid transition context"]);
      return transitionResult(failed, [], false, ["invalid transition context"]);
    }
    const renewalTransition = state.phase === "work-order-renewal" &&
      event?.type === "work-order-renewed";
    const stateErrors = validateState(policy, workOrder, state, {
      allowRenewalIdentityChange: renewalTransition,
      policyRegistry,
    });
    if (stateErrors.length > 0) {
      const workOrderErrors = validateAutomationWorkOrder(policy, workOrder, policyRegistry);
      const staleIdentity = workOrderErrors.length === 0 && stateErrors.includes(
        "automation state must match the current exact work order identity",
      );
      return transitionResult(
        terminalize(
          state,
          staleIdentity ? "stale" : "failed-terminal",
          staleIdentity ? "work-order-identity-stale" : "invalid-controller-state",
        ),
        [],
        false,
        stateErrors,
      );
    }
    if (automationTerminalOutcomes.includes(state.outcome) && state.outcome !== "awaiting-approval") {
      return transitionResult(state, [], false, ["terminal automation state is absorbing"]);
    }
    if (!isExactObject(event) || typeof event.type !== "string") {
      return transitionResult(
        terminalize(state, "failed-terminal", "malformed-event"),
        [],
        false,
        ["automation event must be an exact typed object"],
      );
    }

    let activeState = state;
    if (state.outcome === "awaiting-approval") {
      if (event.type !== "authorization-granted" || state.resumePhase === null) {
        return transitionResult(state, [], false, ["awaiting approval accepts only a new grant"]);
      }
      activeState = { ...state, phase: state.resumePhase, outcome: null, resumePhase: null };
    }

    if (activeState.phase === "deterministic-classification") {
      if (event.type !== "classification-evaluated") {
        return transitionResult(
          terminalize(activeState, "failed-terminal", "classification-bypass-forbidden"),
          [],
          false,
          ["deterministic classification accepts only bound event and evidence"],
        );
      }
      return applyClassification(policy, workOrder, activeState, event, policyRegistry);
    }

    const grantPhases = {
      "patch-authorization": [
        "patchPublication", "patchPublications", "patch-publication", "publish-patch",
      ],
      "merge-authorization": [
        "pullRequestMerge", "mergeAttempts", "merge", "merge-pull-request",
      ],
      "release-promotion-authorization": [
        "releasePromotion", "releasePromotions", "release-promotion", "promote-release",
      ],
      "deploy-authorization": [
        "productionDeploy", "deployAttempts", "deploy", "deploy-production",
      ],
      "rollback-authorization": [
        "productionRollback", "rollbackAttempts", "rollback", "rollback-production",
      ],
    };
    if (Object.hasOwn(grantPhases, activeState.phase) && event.type === "authorization-granted") {
      return grantTransition(
        policy,
        workOrder,
        activeState,
        event,
        ...grantPhases[activeState.phase],
      );
    }

    if (activeState.phase === "patch-publication" && event.type === "patch-publication-succeeded") {
      return applyPatchPublicationReceipt(activeState, event);
    }
    if (activeState.phase === "merge" && event.type === "merge-succeeded") {
      return applyMergeReceipt(activeState, event);
    }
    if (activeState.phase === "work-order-renewal" && event.type === "work-order-renewed") {
      return applyWorkOrderRenewal(policy, workOrder, activeState, event, policyRegistry);
    }

    const expectedSource = expectedSimpleSource(activeState.phase, event.type);
    const eventErrors = validateSimpleEvent(event, expectedSource);
    if (eventErrors.length > 0) {
      return transitionResult(
        terminalize(activeState, "failed-terminal", "invalid-event"),
        [],
        false,
        eventErrors,
      );
    }
    if (event.type === "stage-error" || event.type === "stage-timeout") {
      return transitionResult(terminalForError(activeState, event.type));
    }
    if (event.type === "authorization-missing" && Object.hasOwn(grantPhases, activeState.phase)) {
      return transitionResult({
        ...activeState,
        phase: "awaiting-approval",
        resumePhase: activeState.phase,
        outcome: "awaiting-approval",
        reasonCodes: [...new Set([...activeState.reasonCodes, "authorization-required"])].sort(),
        revision: activeState.revision + 1,
      });
    }

    if (activeState.phase === "cheap-model-assessment") {
      if (event.type === "assessment-no-repair") {
        return transitionResult(terminalize(activeState, "verified", "no-repair-required"));
      }
      if (event.type === "assessment-repair-proposed") {
        if (!["repair-proposal", "repo-read", "sanitized-evidence-read"].every(
          (capability) => workOrder.capabilities.includes(capability),
        )) {
          return transitionResult(terminalize(activeState, "failed-terminal", "repair-capability-set-incomplete"));
        }
        return advanceWithAttempt(
          policy,
          activeState,
          "repairAttempts",
          "repair",
          { type: "request-repair" },
          "failed-terminal",
        );
      }
      if (event.type === "assessment-needs-escalation") {
        if (!["model-assessment", "repo-read", "sanitized-evidence-read"].every(
          (capability) => workOrder.capabilities.includes(capability),
        )) {
          return transitionResult(terminalize(activeState, "failed-terminal", "model-capability-set-incomplete"));
        }
        return advanceWithAttempt(
          policy,
          activeState,
          "strongEscalations",
          "strong-model-assessment",
          { type: "invoke-model", profileClass: policy.modelRoute.strongProfileClass },
          "escalated",
        );
      }
      if (event.type === "model-escalation-requested") {
        return transitionResult(terminalize(activeState, "failed-terminal", "model-self-escalation-forbidden"));
      }
    }
    if (activeState.phase === "strong-model-assessment") {
      if (event.type === "assessment-no-repair") {
        return transitionResult(terminalize(activeState, "verified", "no-repair-required"));
      }
      if (event.type === "assessment-repair-proposed") {
        if (!["repair-proposal", "repo-read", "sanitized-evidence-read"].every(
          (capability) => workOrder.capabilities.includes(capability),
        )) {
          return transitionResult(terminalize(activeState, "failed-terminal", "repair-capability-set-incomplete"));
        }
        return advanceWithAttempt(
          policy,
          activeState,
          "repairAttempts",
          "repair",
          { type: "request-repair" },
          "failed-terminal",
        );
      }
    }
    if (activeState.phase === "repair" && event.type === "repair-produced") {
      return advance(activeState, "patch-authorization", { type: "request-authorization", authorityName: "patchPublication" });
    }
    if ((activeState.phase === "ci-validation" || activeState.phase === "ci-rerun") &&
        event.type === "ci-passed") {
      return advance(activeState, "merge-authorization", { type: "request-authorization", authorityName: "pullRequestMerge" });
    }
    if (activeState.phase === "ci-validation" && event.type === "ci-infra-flake") {
      return advanceWithAttempt(
        policy,
        activeState,
        "ciFlakeReruns",
        "ci-rerun",
        { type: "rerun-ci" },
        "failed-terminal",
      );
    }
    if ((activeState.phase === "ci-validation" || activeState.phase === "ci-rerun") &&
        event.type === "ci-failed") {
      return transitionResult(terminalize(activeState, "failed-terminal", "ci-failed"));
    }
    if (activeState.phase === "post-merge-verification") {
      if (event.type === "post-merge-passed") {
        return transitionResult(terminalize(activeState, "completed", "post-merge-verified"));
      }
      if (event.type === "post-merge-failed") {
        return transitionResult(terminalize(activeState, "failed-terminal", "post-merge-failed"));
      }
    }
    if (activeState.phase === "release-promotion" && event.type === "release-promotion-succeeded") {
      return advance(activeState, "deploy-authorization", { type: "request-authorization", authorityName: "productionDeploy" });
    }
    if (activeState.phase === "release-promotion" && event.type === "release-promotion-failed") {
      return transitionResult(terminalize(activeState, "failed-terminal", "release-promotion-failed"));
    }
    if (activeState.phase === "deploy" && event.type === "deploy-succeeded") {
      return advance(activeState, "deploy-verification", { type: "verify-deployment" });
    }
    if (activeState.phase === "deploy" && event.type === "deploy-failed") {
      return advance(activeState, "rollback-authorization", { type: "request-authorization", authorityName: "productionRollback" });
    }
    if (activeState.phase === "deploy-verification" && event.type === "deploy-verification-passed") {
      return transitionResult(terminalize(activeState, "completed", "deployment-verified"));
    }
    if (activeState.phase === "deploy-verification" && event.type === "deploy-verification-failed") {
      return advance(activeState, "rollback-authorization", { type: "request-authorization", authorityName: "productionRollback" });
    }
    if (activeState.phase === "rollback" && event.type === "rollback-succeeded") {
      return advance(activeState, "rollback-verification", { type: "verify-rollback" });
    }
    if (activeState.phase === "rollback-verification" && event.type === "rollback-verification-passed") {
      return transitionResult(terminalize(activeState, "reverted", "rollback-verified"));
    }
    if (activeState.phase === "rollback-verification" && event.type === "rollback-verification-failed") {
      return transitionResult(terminalize(activeState, "failed-terminal", "rollback-verification-failed"));
    }

    return transitionResult(
      terminalize(activeState, "failed-terminal", "invalid-transition"),
      [],
      false,
      [`event ${event.type} is invalid from ${activeState.phase}`],
    );
  } catch {
    return transitionResult(
      failedCreation(policy, workOrder, ["controller exception"]),
      [],
      false,
      ["controller transition failed closed"],
    );
  }
}

function grantProofFromEvent(previousState, resultState, event) {
  if (!isExactObject(event) || event.type !== "authorization-granted" ||
      !isExactObject(event.grant) ||
      !Array.isArray(resultState?.consumedGrantRefs) ||
      !resultState.consumedGrantRefs.includes(event.grant.grantRef) ||
      !Array.isArray(previousState?.consumedGrantRefs) ||
      previousState.consumedGrantRefs.includes(event.grant.grantRef)) {
    return null;
  }
  return {
    authorityName: event.authorityName,
    ...structuredClone(event.grant),
  };
}

function appendTransitionHistory(previousState, result, event) {
  try {
    if (!isExactObject(previousState) || !Array.isArray(previousState.history) ||
        result.state === previousState || result.state.revision === previousState.revision) {
      return result;
    }
    const attemptDeltas = Object.fromEntries(automationAttemptNames.map((name) => [
      name,
      (result.state.attempts?.[name] ?? 0) - (previousState.attempts?.[name] ?? 0),
    ]));
    const record = {
      schemaVersion: 1,
      revision: previousState.history.length + 1,
      fromPhase: previousState.phase,
      toPhase: result.state.phase,
      eventType: typeof event?.type === "string" ? event.type : "malformed-event",
      eventSource: typeof event?.source === "string" ? event.source : "malformed-source",
      eventSha256: canonicalSha256(event ?? null),
      attemptDeltas,
      grantProof: grantProofFromEvent(previousState, result.state, event),
      identityBefore: structuredClone(previousState.identity),
      identityAfter: structuredClone(result.state.identity),
    };
    const history = [...previousState.history, record];
    return {
      ...result,
      state: {
        ...result.state,
        history,
        historySha256: canonicalSha256(history),
        revision: history.length,
      },
    };
  } catch {
    return transitionResult(
      failedCreation(null, null, ["automation history append failed closed"]),
      [],
      false,
      ["automation history append failed closed"],
    );
  }
}

function transitionAutomation(policy, workOrder, state, event, policyRegistry) {
  return appendTransitionHistory(
    state,
    transitionAutomationCore(policy, workOrder, state, event, policyRegistry),
    event,
  );
}

function cloneRecord(value) {
  try {
    return value === undefined ? undefined : structuredClone(value);
  } catch {
    return undefined;
  }
}

function copyMap(store) {
  try {
    return store instanceof Map ? new Map(store) : null;
  } catch {
    return null;
  }
}

function replayRecordErrors(record, expectedMapKey = null) {
  const errors = exactObjectErrors(record, "automation replay record", replayRecordKeys);
  if (!isExactObject(record)) return errors;
  errors.push(...exactObjectErrors(
    record.replayIdentity,
    "automation replay identity",
    replayIdentityKeys,
  ));
  const identity = record.replayIdentity;
  if (isExactObject(identity)) {
    if (typeof identity.repository !== "string" || !githubRepository.test(identity.repository)) {
      errors.push("automation replay identity repository must be canonical");
    }
    if (!Number.isSafeInteger(identity.pullRequestNumber) || identity.pullRequestNumber < 1) {
      errors.push("automation replay identity pullRequestNumber must be positive");
    }
    for (const key of ["baseSha", "headSha"]) {
      if (!fullLowercaseSha1.test(identity[key] ?? "")) {
        errors.push(`automation replay identity ${key} must be an exact SHA-1`);
      }
    }
    if (!fullLowercaseSha256.test(identity.failureFingerprint ?? "")) {
      errors.push("automation replay identity failureFingerprint must be an exact SHA-256");
    }
    if (typeof identity.policyVersion !== "string" ||
        !/^VSC-AUTOMATION-(?:[1-9]\d*)$/.test(identity.policyVersion)) {
      errors.push("automation replay identity policyVersion must be canonical");
    }
    if (record.idempotencyKey !== dependencyPullRequestIdempotencyKey(identity)) {
      errors.push("automation replay idempotencyKey must match its canonical identity");
    }
  }
  if (expectedMapKey !== null && record.idempotencyKey !== expectedMapKey) {
    errors.push("stored automation replay idempotencyKey must equal its Map key");
  }
  if (!fullLowercaseSha256.test(record.inputEvidenceSha256 ?? "")) {
    errors.push("automation replay inputEvidenceSha256 must be an exact SHA-256");
  }
  errors.push(...exactObjectErrors(record.result, "automation replay result", replayResultKeys));
  const result = record.result;
  if (isExactObject(result)) {
    if (result.schemaVersion !== 1) {
      errors.push("automation replay result schemaVersion must be 1");
    }
    if (!persistedTerminalOutcomes.has(result.terminalOutcome)) {
      errors.push("automation replay result must contain a persistable terminal outcome");
    }
    const normalizedAttempts = exactObjectErrors(
      result.attempts,
      "automation replay result attempts",
      automationAttemptNames,
    );
    errors.push(...normalizedAttempts);
    if (isExactObject(result.attempts)) {
      for (const name of automationAttemptNames) {
        if (!Number.isSafeInteger(result.attempts[name]) || result.attempts[name] < 0) {
          errors.push(`automation replay result attempts.${name} must be non-negative`);
        }
      }
    }
    if (!Array.isArray(result.reasonCodes) || result.reasonCodes.length > 32 ||
        result.reasonCodes.some((code) => typeof code !== "string" || code.length > 128) ||
        new Set(result.reasonCodes).size !== result.reasonCodes.length) {
      errors.push("automation replay result reasonCodes must be bounded unique strings");
    }
  }
  errors.push(...exactObjectErrors(
    record.terminalState,
    "automation replay terminal state",
    stateKeys,
  ));
  const terminalState = record.terminalState;
  if (isExactObject(terminalState)) {
    errors.push(...validateHistoryIdentity(
      terminalState.identity,
      "automation replay terminal state identity",
    ));
    if (terminalState.workflow !== "dependency-pr") {
      errors.push("automation replay terminal state must belong to dependency-pr");
    }
    if (!persistedTerminalOutcomes.has(terminalState.outcome) ||
        terminalState.phase !== terminalState.outcome) {
      errors.push("automation replay terminal state must carry a persistable terminal outcome");
    }
    if (terminalState.idempotencyKey !== record.idempotencyKey ||
        terminalState.identity?.inputEvidenceSha256 !== record.inputEvidenceSha256) {
      errors.push("automation replay terminal state must match the record identity");
    }
    if (isExactObject(identity) && (
      terminalState.identity?.repository !== identity.repository ||
      terminalState.identity?.pullRequestNumber !== identity.pullRequestNumber ||
      terminalState.identity?.baseSha !== identity.baseSha ||
      terminalState.identity?.headSha !== identity.headSha ||
      terminalState.identity?.failureFingerprint !== identity.failureFingerprint
    )) {
      errors.push("automation replay terminal state must match the replay identity");
    }
    if (!Array.isArray(terminalState.history) ||
        terminalState.historySha256 !== canonicalSha256(terminalState.history)) {
      errors.push("automation replay terminal state history digest must be canonical");
    }
    if (isExactObject(result) && (
      result.terminalOutcome !== terminalState.outcome ||
      JSON.stringify(result.attempts) !== JSON.stringify(terminalState.attempts) ||
      JSON.stringify(result.reasonCodes) !== JSON.stringify(terminalState.reasonCodes)
    )) {
      errors.push("automation replay result must be an exact projection of terminal state");
    }
  }
  return errors;
}

export function recordAutomationResult(store, record) {
  const nextStore = copyMap(store);
  if (nextStore === null) {
    return {
      store: null,
      replayed: false,
      conflict: true,
      result: { terminalOutcome: "failed-terminal", reason: "invalid-dedupe-store" },
    };
  }
  try {
    if (replayRecordErrors(record).length > 0) {
      return {
        store: nextStore,
        replayed: false,
        conflict: true,
        result: { terminalOutcome: "failed-terminal", reason: "invalid-dedupe-record" },
      };
    }
    const existing = nextStore.get(record.idempotencyKey);
    if (existing !== undefined) {
      const existingResult = cloneRecord(existing?.result);
      if (replayRecordErrors(existing, record.idempotencyKey).length > 0 ||
          existingResult === undefined) {
        return {
          store: nextStore,
          replayed: false,
          conflict: true,
          result: { terminalOutcome: "failed-terminal", reason: "invalid-stored-dedupe-record" },
        };
      }
      if (existing.inputEvidenceSha256 !== record.inputEvidenceSha256) {
        return {
          store: nextStore,
          replayed: false,
          conflict: true,
          result: { terminalOutcome: "failed-terminal", reason: "dedupe-input-conflict" },
        };
      }
      return {
        store: nextStore,
        replayed: true,
        conflict: false,
        result: existingResult,
      };
    }
    const clonedRecord = cloneRecord(record);
    const clonedResult = cloneRecord(record.result);
    if (!isExactObject(clonedRecord) || clonedResult === undefined) {
      return {
        store: nextStore,
        replayed: false,
        conflict: true,
        result: { terminalOutcome: "failed-terminal", reason: "unclonable-dedupe-record" },
      };
    }
    nextStore.set(record.idempotencyKey, clonedRecord);
    return {
      store: nextStore,
      replayed: false,
      conflict: false,
      result: clonedResult,
    };
  } catch {
    return {
      store: nextStore,
      replayed: false,
      conflict: true,
      result: { terminalOutcome: "failed-terminal", reason: "dedupe-operation-failed-closed" },
    };
  }
}

export function readAutomationResult(store, idempotencyKey) {
  try {
    if (!(store instanceof Map)) return undefined;
    const record = store.get(idempotencyKey);
    return replayRecordErrors(record, idempotencyKey).length === 0
      ? cloneRecord(record)
      : undefined;
  } catch {
    return undefined;
  }
}

function replayIdentityFromCandidate(candidate) {
  return {
    repository: candidate.repository,
    pullRequestNumber: candidate.pullRequestNumber,
    baseSha: candidate.baseSha,
    headSha: candidate.headSha,
    failureFingerprint: candidate.failureFingerprint,
    policyVersion: candidate.policyVersion,
  };
}

function replayResultFromState(state) {
  return {
    schemaVersion: 1,
    terminalOutcome: state.outcome,
    attempts: cloneRecord(state.attempts),
    reasonCodes: cloneRecord(state.reasonCodes),
  };
}

function failedStartResult(policy, workOrder, lineageStore, resultStore, reason) {
  const state = failedCreation(policy, workOrder, [reason]);
  return {
    accepted: false,
    replayed: false,
    conflict: true,
    state,
    effects: [],
    errors: [reason],
    result: replayResultFromState(state),
    lineageStore: copyMap(lineageStore),
    resultStore: copyMap(resultStore),
  };
}

export function startDependencyAutomationWithStores(
  policy,
  workOrder,
  event,
  lineageStore,
  resultStore,
  policyRegistry = checkedInAutomationPolicyRegistry(),
) {
  try {
    const safeResultStore = copyMap(resultStore);
    if (safeResultStore === null) {
      return failedStartResult(
        policy,
        workOrder,
        lineageStore,
        resultStore,
        "result store must be an explicit Map",
      );
    }

    const wrapperErrors = exactObjectErrors(
      event,
      "classification event",
      classificationEventKeys,
    );
    const validWrapper = isExactObject(event) && wrapperErrors.length === 0 &&
      event.schemaVersion === 1 && event.type === "classification-evaluated" &&
      event.source === "deterministic-controller";
    const classification = validWrapper
      ? classifyDependencyPullRequest(
        policy,
        event.trustedEvent,
        event.evidence,
        policyRegistry,
      )
      : null;
    const candidate = classification?.candidate ?? null;
    const workOrderErrors = validateAutomationWorkOrder(policy, workOrder, policyRegistry);
    const boundCandidate = workOrderErrors.length === 0 &&
      candidateMatchesWorkOrder(candidate, workOrder);

    if (boundCandidate && safeResultStore.has(workOrder.idempotencyKey)) {
      const existing = readAutomationResult(safeResultStore, workOrder.idempotencyKey);
      if (existing === undefined) {
        return failedStartResult(
          policy,
          workOrder,
          lineageStore,
          safeResultStore,
          "stored automation replay record is malformed",
        );
      }
      if (existing.inputEvidenceSha256 !== candidate.inputEvidenceSha256) {
        return failedStartResult(
          policy,
          workOrder,
          lineageStore,
          safeResultStore,
          "stored automation replay evidence does not match the derived identity",
        );
      }
      const semanticErrors = validateState(policy, workOrder, existing.terminalState, {
        policyRegistry,
      });
      if (classification.terminalOutcome !== null &&
          existing.terminalState.outcome !== classification.terminalOutcome) {
        semanticErrors.push(
          "stored automation replay outcome contradicts deterministic classification",
        );
      }
      if (classification.terminalOutcome === null &&
          existing.terminalState.outcome === "reverted") {
        semanticErrors.push("dependency automation replay cannot contain a release rollback");
      }
      const expectedInitialPhase = classification.terminalOutcome ?? classification.nextStage;
      const initialHistory = existing.terminalState.history?.[0];
      if (initialHistory?.fromPhase !== "deterministic-classification" ||
          initialHistory?.toPhase !== expectedInitialPhase) {
        semanticErrors.push(
          "stored automation replay history contradicts deterministic classification",
        );
      }
      if (semanticErrors.length > 0) {
        return failedStartResult(
          policy,
          workOrder,
          lineageStore,
          safeResultStore,
          "stored automation replay state is not a valid terminal controller history",
        );
      }
      return {
        accepted: true,
        replayed: true,
        conflict: false,
        state: null,
        effects: [],
        errors: [],
        result: cloneRecord(existing.result),
        lineageStore: copyMap(lineageStore),
        resultStore: safeResultStore,
      };
    }

    const initialState = createAutomationStateFromLedger(
      policy,
      workOrder,
      lineageStore,
      policyRegistry,
    );
    const transition = transitionAutomationWithLedger(
      policy,
      workOrder,
      initialState,
      event,
      lineageStore,
      policyRegistry,
    );
    const terminalResult = persistedTerminalOutcomes.has(transition.state.outcome)
      ? replayResultFromState(transition.state)
      : null;
    if (!boundCandidate || terminalResult === null) {
      return {
        ...transition,
        replayed: false,
        conflict: false,
        result: terminalResult,
        resultStore: safeResultStore,
      };
    }

    const recorded = recordAutomationResult(safeResultStore, {
      idempotencyKey: workOrder.idempotencyKey,
      inputEvidenceSha256: candidate.inputEvidenceSha256,
      replayIdentity: replayIdentityFromCandidate(candidate),
      result: terminalResult,
      terminalState: transition.state,
    });
    if (recorded.conflict || !(recorded.store instanceof Map)) {
      return failedStartResult(
        policy,
        workOrder,
        transition.lineageStore,
        recorded.store,
        "automation replay result could not be persisted safely",
      );
    }
    return {
      ...transition,
      replayed: recorded.replayed,
      conflict: false,
      result: recorded.result,
      resultStore: recorded.store,
    };
  } catch {
    return failedStartResult(
      policy,
      workOrder,
      lineageStore,
      resultStore,
      "dependency automation start failed closed",
    );
  }
}

function inspectLineageSnapshot(store, lineageKey) {
  if (!(store instanceof Map) || typeof lineageKey !== "string" ||
      !automationIdentityKey.test(lineageKey)) {
    return { valid: false, snapshot: null };
  }
  try {
    if (!store.has(lineageKey)) {
      return { valid: false, snapshot: null };
    }
  } catch {
    return { valid: false, snapshot: null };
  }
  try {
    const value = store.get(lineageKey);
    const attemptErrors = exactObjectErrors(
      value?.attempts,
      "lineage snapshot attempts",
      automationAttemptNames,
    );
    const clonedAttempts = cloneRecord(value?.attempts);
    const valid = isExactObject(value) &&
      Object.keys(value).length === 2 && Object.hasOwn(value, "revision") &&
      Object.hasOwn(value, "attempts") && Number.isSafeInteger(value.revision) &&
      value.revision >= 0 && attemptErrors.length === 0 &&
      isExactObject(clonedAttempts) && automationAttemptNames.every(
        (name) => Number.isSafeInteger(value.attempts[name]) && value.attempts[name] >= 0,
      );
    return {
      valid,
      snapshot: valid ? { revision: value.revision, attempts: clonedAttempts } : null,
    };
  } catch {
    return { valid: false, snapshot: null };
  }
}

export function recordLineageAttempts(store, lineageKey, attempts) {
  const nextStore = copyMap(store);
  if (nextStore === null || typeof lineageKey !== "string" ||
      !automationIdentityKey.test(lineageKey)) {
    return null;
  }
  try {
    const normalized = exactObjectErrors(
      attempts,
      "lineage attempts",
      automationAttemptNames,
    );
    if (!isExactObject(attempts) || normalized.length > 0 ||
        automationAttemptNames.some(
          (name) => !Number.isSafeInteger(attempts[name]) || attempts[name] < 0,
        )) {
      return null;
    }
    if (!nextStore.has(lineageKey)) {
      const clonedAttempts = cloneRecord(attempts);
      if (!isExactObject(clonedAttempts)) return null;
      nextStore.set(lineageKey, { revision: 1, attempts: clonedAttempts });
      return nextStore;
    }
    const inspected = inspectLineageSnapshot(nextStore, lineageKey);
    if (!inspected.valid) return null;
    const existing = inspected.snapshot;
    const monotonic = Object.fromEntries(automationAttemptNames.map((name) => [
      name,
      Math.max(existing.attempts[name], attempts[name]),
    ]));
    const changed = JSON.stringify(monotonic) !== JSON.stringify(existing.attempts);
    nextStore.set(lineageKey, {
      revision: existing.revision + (changed ? 1 : 0),
      attempts: monotonic,
    });
    return nextStore;
  } catch {
    return null;
  }
}

export function readLineageSnapshot(store, lineageKey) {
  return cloneRecord(inspectLineageSnapshot(store, lineageKey).snapshot);
}

export function readLineageAttempts(store, lineageKey) {
  return readLineageSnapshot(store, lineageKey)?.attempts ?? null;
}

export function createAutomationStateFromLedger(
  policy,
  workOrder,
  lineageStore,
  policyRegistry = checkedInAutomationPolicyRegistry(),
) {
  try {
    if (!(lineageStore instanceof Map)) {
      return failedCreation(policy, workOrder, ["lineage ledger must be an explicit Map"]);
    }
    const inspected = inspectLineageSnapshot(lineageStore, workOrder?.lineageKey);
    if (!inspected.valid) {
      return failedCreation(policy, workOrder, ["lineage ledger snapshot is missing or malformed"]);
    }
    return createAutomationStateWithAttempts(
      policy,
      workOrder,
      inspected.snapshot.attempts,
      policyRegistry,
    );
  } catch {
    return failedCreation(policy, workOrder, ["lineage ledger read failed closed"]);
  }
}

export function transitionAutomationWithLedger(
  policy,
  workOrder,
  state,
  event,
  lineageStore,
  policyRegistry = checkedInAutomationPolicyRegistry(),
) {
  try {
    const safeLineageStore = copyMap(lineageStore);
    const lineageKey = isExactObject(state) && typeof state.lineageKey === "string"
      ? state.lineageKey
      : workOrder?.lineageKey;
    const inspectedLedger = inspectLineageSnapshot(lineageStore, lineageKey);
    if (!inspectedLedger.valid || !isExactObject(state) || !isExactObject(state.attempts) ||
        JSON.stringify(state.attempts) !== JSON.stringify(inspectedLedger.snapshot.attempts)) {
      const reason = inspectedLedger.valid ? "lineage-ledger-stale" : "lineage-ledger-invalid";
      const failed = isExactObject(state)
        ? appendTransitionHistory(
          state,
          transitionResult(
            terminalize(state, "failed-terminal", reason),
            [],
            false,
            ["controller state attempts must equal an exact authoritative lineage snapshot"],
          ),
          { schemaVersion: 1, type: "lineage-ledger-conflict", source: "lineage-ledger" },
        )
        : transitionResult(
          failedCreation(policy, workOrder, [reason]),
          [],
          false,
          ["controller state and lineage snapshot must be exact before transition"],
        );
      return { ...failed, lineageStore: safeLineageStore };
    }
    const transition = transitionAutomation(policy, workOrder, state, event, policyRegistry);
    const recordedStore = recordLineageAttempts(
      lineageStore,
      transition.state.lineageKey,
      transition.state.attempts,
    );
    if (!(recordedStore instanceof Map)) {
      return {
        ...transitionResult(
          failedCreation(policy, workOrder, ["lineage ledger write failed closed"]),
          [],
          false,
          ["lineage ledger write failed closed"],
        ),
        lineageStore: safeLineageStore,
      };
    }
    return { ...transition, lineageStore: recordedStore };
  } catch {
    return {
      ...transitionResult(
        failedCreation(policy, workOrder, ["lineage ledger operation failed closed"]),
        [],
        false,
        ["lineage ledger operation failed closed"],
      ),
      lineageStore: copyMap(lineageStore),
    };
  }
}
