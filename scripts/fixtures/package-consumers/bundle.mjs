import fs from "node:fs/promises";
import { build } from "esbuild";
import { transformAsync } from "@babel/core";
import linker from "@angular/compiler-cli/linker/babel";

// Link Angular's partial declarations before bundling; never enable runtime JIT as a fallback.
await build({ entryPoints: ["compiled/angular.js"], bundle: true, platform: "browser", format: "esm",
  outfile: "bundle.js", plugins: [{ name: "angular-linker", setup(builder) {
    builder.onLoad({ filter: /node_modules[\\/]@angular[\\/].*\.m?js$/ }, async ({ path }) => {
      const result = await transformAsync(await fs.readFile(path, "utf8"), {
        filename: path, configFile: false, babelrc: false, plugins: [[linker, { linkerJitMode: false }]],
      });
      return { contents: result.code, loader: "js" };
    });
  } }] });
