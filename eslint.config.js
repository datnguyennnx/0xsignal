import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import effectPlugin from "@effect/eslint-plugin";
import reactCompiler from "eslint-plugin-react-compiler";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "react-compiler": reactCompiler,
      "@effect": effectPlugin,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.browser,
        ...globals.es2020,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-compiler/react-compiler": "error",
      "@effect/no-import-from-barrel-package": "error",
      "@effect/dprint": "off", // Optional: based on project preference
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-empty-object-type": "off",
    },
  },
];
