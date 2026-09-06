import fs from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createTeacher } from "@verified-sudoku/adapter-openai";
import { createLocalGateway } from "../apps/local-gateway/dist/index.js";
import { startTutor } from "./local-tutor-server.mjs";
import { fromRoot, readText } from "./lib/project.mjs";
import { validateRuntimeRegistrationShape, validateRegistrationIdentity, validateArtifactPath,
  validateOutputTokenBound, validateTimeoutBound } from "./lib/runtime-ai.mjs";
import { validateProviderPolicy, validateRuntimeProviderSelection } from "./lib/provider-policy.mjs";

export function loadLocalRegistration() {
  const manifest = JSON.parse(readText("ai/runtime-manifest.json"));
  const entry = manifest.registrations.find(r => r.id === "local-adaptive-teacher-v1");
  const policy = JSON.parse(readText("config/provider-policy.json"));
  const errors = [...validateRuntimeRegistrationShape(entry), ...validateRegistrationIdentity(entry),
    ...validateProviderPolicy(policy), ...validateRuntimeProviderSelection(entry, policy),
    ...validateOutputTokenBound(entry), ...validateTimeoutBound(entry)];
  if (entry?.approvalStatus !== "candidate" || entry?.automaticRetry !== false || entry?.failurePolicy !== "visible-pause") errors.push("admission");
  for (const [kind, file, hash] of [["prompt", "promptPath", "promptSha256"], ["schema", "schemaPath", "schemaSha256"],
    ["renderer manifest", "rendererManifestPath", "rendererManifestSha256"], ["proof policy", "proofPolicyPath", "proofPolicySha256"],
    ["evaluation-suite manifest", "evalSuiteManifestPath", "evalSuiteManifestSha256"], ["comparison report", "comparisonReportPath", "comparisonReportSha256"]]) {
    const issues = validateArtifactPath(kind, entry?.[file]); errors.push(...issues);
    if (!issues.length && createHash("sha256").update(readText(entry[file])).digest("hex") !== entry[hash]) errors.push("artifact-drift");
  }
  if (errors.length) throw new Error("local-registration-invalid");
  return { requestedModel: entry.requestedModel, maxOutputTokens: entry.maxOutputTokens, timeoutMs: entry.timeoutMs,
    prompt: readText(entry.promptPath), schema: JSON.parse(readText(entry.schemaPath)) };
}
export async function startAiTutor({ port = 4174, teacher = null, maxCalls = 0 } = {}) {
  const puzzleSource = fs.readFileSync(fromRoot("apps/replay-web/src/local-puzzle.ts"), "utf8");
  const puzzle = JSON.parse(puzzleSource.match(/export const localPuzzle = (.+);/)[1]);
  const gateway = createLocalGateway(puzzle, teacher, maxCalls);
  return startTutor(port, gateway);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const registration = loadLocalRegistration();
  const grant = process.env['COACH_LOCAL_EVAL_CALLS'] ?? "0";
  if (!/^(0|[1-9]|1[0-9]|20)$/.test(grant)) throw new Error("invalid-call-grant");
  const maxCalls = Number(grant), key = process.env['OPENAI_API_KEY'];
  if (maxCalls > 0 && !key) throw new Error("local-key-required");
  const teacher = maxCalls > 0 ? createTeacher(registration, key) : null;
  const server = await startAiTutor({ teacher, maxCalls });
  console.log(`Local adaptive tutor: ${server.url}; live calls ${maxCalls > 0 ? "enabled with a bounded grant" : "disabled"}.`);
}
