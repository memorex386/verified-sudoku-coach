export {}; // @ts-expect-error: fixture proves trailing suppression comments cannot hide imports
import "@fixture/replay-web";
import "dev-only-runtime";
import React from "react";
import { escapedRuntime } from "../runtime/index.js";

export const forbiddenFixture = [React.createElement("div"), escapedRuntime];
