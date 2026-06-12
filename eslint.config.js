import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Request: "readonly",
        URL: "readonly",
        localStorage: "readonly",
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        setImmediate: "readonly",
      },
    },
    rules: {
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/tmp/",
      "**/cli/",
      "**/supabase/",
      "**/tests/",
      "**/api/",
      "App_old.*",
      "*.js",
      "*.mjs",
      "vite.config.ts",
    ],
  }
);
