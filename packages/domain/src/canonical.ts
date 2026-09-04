/** ASCII-only portable JSON. This validates representation, not a wire schema. */
export function canonicalJson(value: unknown): string {
  const ancestors = new Set<object>();
  function encode(input: unknown, depth: number): string {
    if (depth > 64) throw new Error("canonical-depth");
    if (input === null) return "null";
    if (typeof input === "boolean") return input ? "true" : "false";
    if (typeof input === "number") {
      if (!Number.isSafeInteger(input) || Object.is(input, -0)) throw new Error("canonical-number");
      return String(input);
    }
    if (typeof input === "string") {
      for (let i = 0; i < input.length; i++) {
        if (input.charCodeAt(i) > 127) throw new Error("canonical-ascii");
      }
      return JSON.stringify(input);
    }
    if (typeof input !== "object") throw new Error("canonical-value");
    if (ancestors.has(input)) throw new Error("canonical-cycle");
    ancestors.add(input);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(input);
      if (Object.getOwnPropertySymbols(input).length) throw new Error("canonical-symbol");
      if (Array.isArray(input)) {
        if (Object.getPrototypeOf(input) !== Array.prototype) throw new Error("canonical-prototype");
        if (Object.keys(descriptors).length !== input.length + 1) throw new Error("canonical-array");
        const encoded: string[] = [];
        for (let i = 0; i < input.length; i++) {
          const descriptor = descriptors[String(i)];
          if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("canonical-array");
          encoded.push(encode(descriptor.value, depth + 1));
        }
        return `[${encoded.join(",")}]`;
      }
      const prototype = Object.getPrototypeOf(input);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("canonical-prototype");
      return `{${Object.keys(descriptors).sort().map((key) => {
        const descriptor = descriptors[key];
        if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("canonical-property");
        return `${encode(key, depth + 1)}:${encode(descriptor.value, depth + 1)}`;
      }).join(",")}}`;
    } finally {
      ancestors.delete(input);
    }
  }
  return encode(value, 0);
}

/** Canonical output is ASCII, whose code units are also its UTF-8 bytes. */
export function canonicalBytes(value: unknown): Uint8Array {
  const json = canonicalJson(value);
  return Uint8Array.from(json, (character) => character.charCodeAt(0));
}
