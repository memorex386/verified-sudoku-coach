import { canonicalJson } from "@verified-sudoku/domain";

export type DecodeCode = "size" | "syntax" | "shape" | "semantic" | "reference" | "fingerprint" | "stale" | "invalid-action";
export type DecodeResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: DecodeCode };
export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
export const limits = Object.freeze({
  identity: [4096, 3], action: [4096, 5], puzzle: [16384, 6], board: [32768, 6],
  step: [32768, 8], path: [2097152, 10], trace: [8388608, 12], replay: [8388608, 12],
} as const);
export type ContractKind = keyof typeof limits;
class DecodeFailure extends Error {
  constructor(readonly code: DecodeCode) { super(code); }
}
export function requireCondition(condition: boolean, code: DecodeCode = "semantic"): asserts condition {
  if (!condition) throw new DecodeFailure(code);
}
export function attempt<T>(operation: () => T): DecodeResult<T> {
  try { return Object.freeze({ ok: true, value: operation() }); }
  catch (error) { return Object.freeze({ ok: false, code: error instanceof DecodeFailure ? error.code : "semantic" }); }
}
export function freeze<T>(input: T): DeepReadonly<T> {
  if (input !== null && typeof input === "object") {
    for (const child of Object.values(input)) freeze(child);
    Object.freeze(input);
  }
  return input as DeepReadonly<T>;
}

/** Preflight limits, duplicate keys and exact integer lexemes before constructing the JSON tree. */
export function parseBoundedJson(raw: unknown, kind: ContractKind): unknown {
  requireCondition(typeof raw === "string", "syntax");
  const input = raw;
  const [bytes, maxDepth] = limits[kind];
  requireCondition(input.length <= bytes, "size");
  // V1 wire fields are ASCII. Escapes still pass through JSON decoding and schema validation.
  for (let i = 0; i < input.length; i++) requireCondition(input.charCodeAt(i) <= 127, "syntax");
  let position = 0;
  function whitespace(): void { while (/[\x20\t\r\n]/.test(input[position] ?? "!")) position++; }
  function string(): string {
    requireCondition(input[position] === '"', "syntax");
    const start = position++;
    while (position < input.length) {
      const character = input[position++];
      if (character === "\\") { position++; continue; }
      if (character === '"') {
        try { return JSON.parse(input.slice(start, position)) as string; }
        catch { throw new DecodeFailure("syntax"); }
      }
    }
    throw new DecodeFailure("syntax");
  }
  function value(depth: number): void {
    requireCondition(depth <= maxDepth, "size");
    whitespace();
    const character = input[position];
    if (character === '"') { string(); return; }
    if (character === "{" || character === "[") {
      position++;
      const close = character === "{" ? "}" : "]";
      const keys = new Set<string>();
      whitespace();
      if (input[position] === close) { position++; return; }
      while (position < input.length) {
        if (character === "{") {
          whitespace();
          const key = string();
          requireCondition(!keys.has(key), "syntax"); keys.add(key);
          whitespace(); requireCondition(input[position++] === ":", "syntax");
        }
        value(depth + 1); whitespace();
        if (input[position] === close) { position++; return; }
        requireCondition(input[position++] === ",", "syntax");
      }
      throw new DecodeFailure("syntax");
    }
    for (const literal of ["true", "false", "null"]) {
      if (input.startsWith(literal, position)) { position += literal.length; return; }
    }
    const token = /^-?(?:0|[1-9][0-9]*)/.exec(input.slice(position))?.[0];
    requireCondition(token !== undefined, "syntax");
    const number = Number(token);
    requireCondition(Number.isSafeInteger(number) && !Object.is(number, -0), "syntax");
    position += token.length;
  }
  value(0); whitespace(); requireCondition(position === input.length, "syntax");
  try { return JSON.parse(input) as unknown; }
  catch { throw new DecodeFailure("syntax"); }
}
type Schema<T> = { safeParse(input: unknown): { success: true; data: T } | { success: false } };
export function parseSchema<T>(input: unknown, kind: ContractKind, schema: Schema<T>): T {
  const parsed = schema.safeParse(parseBoundedJson(input, kind));
  requireCondition(parsed.success, "shape");
  canonicalJson(parsed.data); // Reject decoded non-ASCII strings before any fingerprinting.
  return parsed.data;
}
