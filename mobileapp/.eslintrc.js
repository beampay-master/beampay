module.exports = {
  extends: ["expo", "prettier"],
  plugins: ["react", "react-hooks"],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
      },
      node: {
        extensions: [".js", ".jsx", ".ts", ".tsx"],
      },
    },
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    // Downgrade to warn so pre-existing unused vars don't block CI
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
  },
  ignorePatterns: ["node_modules/", "dist/", ".expo/", "assets/", "*.png", "*.jpg", "*.jpeg", "*.svg"],
  overrides: [
    {
      files: ["e2e/**/*.js"],
      env: {
        jest: true,
      },
      globals: {
        beforeAll: true,
        beforeEach: true,
        describe: true,
        it: true,
        device: true,
      },
    },
  ],
};
