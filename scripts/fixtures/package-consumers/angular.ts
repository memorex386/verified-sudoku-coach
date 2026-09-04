import { Component, provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import { createTopology, createPuzzle, type Puzzle } from "@verified-sudoku/domain";
import { puzzleDefinitionV1Schema, type PuzzleDefinitionV1 } from "@verified-sudoku/contracts";
import { decodePuzzle, type DecodeResult, type DecodedPuzzle } from "@verified-sudoku/boundary-codecs";
import { probe } from "./probe.mjs";

@Component({ selector: "conformance-app", standalone: true, template: "<pre>{{ result }}</pre>" })
class ConformanceApp {
  // Strict AOT compilation must resolve packed declarations as well as JS exports.
  readonly puzzle: Puzzle = createPuzzle(createTopology(6), []);
  readonly decode: DecodeResult<DecodedPuzzle> = decodePuzzle("{}");
  readonly schema: typeof puzzleDefinitionV1Schema = puzzleDefinitionV1Schema;
  readonly dto: PuzzleDefinitionV1 | undefined = undefined;
  readonly result = JSON.stringify(probe());
}
bootstrapApplication(ConformanceApp, { providers: [provideZonelessChangeDetection()] })
  .catch((error: unknown) => { document.body.textContent = "bootstrap-failed"; throw error; });
