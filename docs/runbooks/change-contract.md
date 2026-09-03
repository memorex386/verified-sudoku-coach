# Change a contract

1. Identify every boundary and consumer from the change matrix. Do not edit a DTO because an
   internal object is convenient.
2. Update the strict Zod schema, JSON Schema snapshot, public TypeScript type, canonical examples,
   size bounds, and boundary-codec mapping in one change.
3. Add valid, malformed, unknown-key, boundary-size, unsupported-version, and compatibility tests.
   Decoders reject; they do not coerce or supply domain defaults.
4. If the wire meaning or accepted payload changes, introduce a new version. Maintain or explicitly
   retire old decoding at the boundary; never reinterpret stored history in place.
5. Update affected work packages, docs, replay/eval fixtures, package API report, and private-host
   compatibility plan. A private host upgrades only from an immutable public release.

No model, HTTP, storage, trace, or replay payload is trusted merely because TypeScript compiled it.
