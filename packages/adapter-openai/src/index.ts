import { decodeLocalCoachDecision } from "@verified-sudoku/boundary-codecs";

export type ProviderOutcome = Readonly<{ type: "ok"; decision: unknown; inputTokens: number;
  outputTokens: number; model: string; serviceTier: string }> | Readonly<{ type: "paused";
  code: "cancelled" | "timeout" | "refusal" | "quota" | "provider" | "invalid" }>;
export type TeacherRegistration = Readonly<{ requestedModel: string; maxOutputTokens: number;
  timeoutMs: number; prompt: string; schema: Record<string, unknown> }>;

/** Node-only, one attempt, bounded body; caller admits the exact candidate registration first. */
export function createTeacher(registration: TeacherRegistration, key: string, transport: typeof fetch = fetch) {
  return async (packet: string, signal: AbortSignal): Promise<ProviderOutcome> => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), registration.timeoutMs);
    const combined = AbortSignal.any([signal, controller.signal]);
    try {
      const body = JSON.stringify({ model: registration.requestedModel, instructions: registration.prompt,
        input: packet, reasoning: { effort: "medium" }, service_tier: "auto", store: false,
        max_output_tokens: registration.maxOutputTokens, tools: [],
        text: { format: { type: "json_schema", name: "local_coach", strict: true, schema: registration.schema } } });
      if (Buffer.byteLength(body) > 16000 || !key || signal.aborted) return { type: "paused", code: signal.aborted ? "cancelled" : "invalid" };
      const response = await transport("https://api.openai.com/v1/responses", { method: "POST", redirect: "error",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal: combined });
      if (!response.ok) { await response.body?.cancel(); return { type: "paused", code: response.status === 429 ? "quota" : "provider" }; }
      const reader = response.body?.getReader(); if (!reader) return { type: "paused", code: "invalid" };
      let size = 0; const chunks: Uint8Array[] = [];
      while (true) { const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength; if (size > 131072) { await reader.cancel(); return { type: "paused", code: "invalid" }; } chunks.push(part.value); }
      const value = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      if (combined.aborted) return { type: "paused", code: signal.aborted ? "cancelled" : "timeout" };
      if (!Array.isArray(value['output'])) return { type: "paused", code: "invalid" };
      const parts = value['output'].flatMap((item: { content?: unknown[] }) => Array.isArray(item?.content) ? item.content : []) as { type?: string; text?: unknown }[];
      if (parts.some(p => p.type === "refusal")) return { type: "paused", code: "refusal" };
      const texts = parts.filter(p => p.type === "output_text");
      if (value['status'] !== "completed" || texts.length !== 1 || typeof texts[0]?.text !== "string" || texts[0].text.length > 2048) return { type: "paused", code: "invalid" };
      const decision = decodeLocalCoachDecision(texts[0].text);
      const usage = value['usage'] as Record<string, unknown> | undefined;
      const input = usage?.['input_tokens'], output = usage?.['output_tokens'];
      if (!decision || typeof value['model'] !== "string" || value['model'] !== registration.requestedModel ||
        typeof value['service_tier'] !== "string" || !Number.isSafeInteger(input) || !Number.isSafeInteger(output) ||
        (input as number) < 0 || (output as number) < 0 || (output as number) > registration.maxOutputTokens) return { type: "paused", code: "invalid" };
      return { type: "ok", decision, inputTokens: input as number, outputTokens: output as number,
        model: value['model'], serviceTier: value['service_tier'] };
    } catch { return { type: "paused", code: signal.aborted ? "cancelled" : controller.signal.aborted ? "timeout" : "provider" }; }
    finally { clearTimeout(deadline); }
  };
}
