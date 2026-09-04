import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const sharedGlobals = {
  ...globals.browser,
  ...globals.node,
};

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", ".tmp/**"],
  },
  {
    ...eslint.configs.recommended,
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      ...eslint.configs.recommended.languageOptions,
      globals: sharedGlobals,
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      ...config.languageOptions,
      globals: sharedGlobals,
    },
  })),
];
