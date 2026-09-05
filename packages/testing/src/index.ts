// Fixture utilities are test tooling; none grants a verified proof or accepted showcase.
export { fixtureAttempt, fixtureRandom, boundedDraw } from "./fixtures/random.js";
export { countSolutions } from "./fixtures/solver.js";
export { checkUniquenessReceipt, type UniquenessCheck } from "./fixtures/uniqueness.js";
export { generationPlan, generateCandidate, transformGrid,
  type GenerationPlan, type FixtureCandidate } from "./fixtures/generator.js";
export { classicTransformSuite, normalizeDigits, normalizeDigitD4, fixtureCollisionKeys,
  type ClassicTransformId, type FixtureTransform } from "./fixtures/transforms.js";
